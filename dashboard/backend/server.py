import os
import json
import re
import shutil
import subprocess
import logging
from datetime import datetime
from io import StringIO

# Gevent monkey-patch MUST be first — enables concurrent WS + HTTP
try:
    from gevent import monkey
    monkey.patch_all()
    _HAS_GEVENT = True
except ImportError:
    _HAS_GEVENT = False

from flask import Flask, request, jsonify
from flask_cors import CORS
from ruamel.yaml import YAML

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('xmeow-ui')

# WebSocket support (optional — install with: pip install flask-sock)
try:
    from flask_sock import Sock
    sock = Sock(app)
    logger.info('flask-sock loaded, WebSocket log streaming enabled')
except ImportError:
    sock = None
    logger.warning('flask-sock not installed, WebSocket log streaming disabled')

yaml = YAML()
yaml.preserve_quotes = True

# Environment-based configuration paths
MIHOMO_CONFIG_PATH = os.environ.get(
    'MIHOMO_CONFIG_PATH', '/opt/etc/mihomo/config.yaml'
)
XKEEN_DIR = os.environ.get('XKEEN_DIR', '/opt/etc/xkeen')
BACKUP_DIR = os.environ.get('BACKUP_DIR', '/opt/etc/mihomo/backups')
XKEEN_BIN = os.environ.get('XKEEN_BIN', '/opt/sbin/xkeen')
XKEEN_LOG_DIR = os.environ.get('XKEEN_LOG_DIR', '/opt/var/log/xray')
ALLOWED_LOGS = {'error': 'error.log', 'access': 'access.log'}

# Allowed xkeen files mapping: route name -> actual filename
XKEEN_FILES = {
    'ip_exclude': 'ip_exclude.lst',
    'port_exclude': 'port_exclude.lst',
    'port_proxying': 'port_proxying.lst',
}


def _create_backup(source_path, backup_name, extension):
    """Create a timestamped backup of the given file.

    Args:
        source_path: Path to the file to back up.
        backup_name: Base name for the backup (e.g. 'config', 'ip_exclude').
        extension: File extension including dot (e.g. '.yaml', '.lst').

    Returns the backup path if created, or None if source does not exist.
    """
    if not os.path.exists(source_path):
        return None
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = os.path.join(BACKUP_DIR, f'{backup_name}_{timestamp}{extension}')
    shutil.copy2(source_path, backup_path)
    return backup_path


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok'}), 200


# ---------------------------------------------------------------------------
# Service Management
# ---------------------------------------------------------------------------

LOG_MAX_LINES = 200


def _trim_log_file(path, max_lines=LOG_MAX_LINES):
    """Keep only the last max_lines in the log file."""
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()
        if len(lines) > max_lines:
            with open(path, 'w', encoding='utf-8') as f:
                f.writelines(lines[-max_lines:])
    except FileNotFoundError:
        pass


@app.route('/api/service/<action>', methods=['POST'])
def service_action(action):
    """Start, stop, or restart the xkeen service via `xkeen -<action>`.

    All actions redirect stdout/stderr to error.log (append mode)
    so that xkeen output is captured. History is preserved across
    actions, trimmed to LOG_MAX_LINES before each new write.
    """
    if action not in ('start', 'stop', 'restart'):
        return jsonify({'error': 'Invalid action. Must be start, stop, or restart'}), 400

    cmd = f'xkeen -{action}'
    app.logger.info('Executing: %s', cmd)

    try:
        log_path = os.path.join(XKEEN_LOG_DIR, ALLOWED_LOGS['error'])
        os.makedirs(XKEEN_LOG_DIR, exist_ok=True)
        _trim_log_file(log_path)
        with open(log_path, 'a') as log_file:
            proc = subprocess.Popen(
                cmd, shell=True,
                stdout=log_file, stderr=subprocess.STDOUT,
            )
            proc.wait(timeout=60)
        app.logger.info('Service %s completed (exit %d)', action, proc.returncode)
        if proc.returncode != 0:
            return jsonify({'error': f'Command exited with code {proc.returncode}'}), 500
        return jsonify({'status': 'ok'}), 200
    except subprocess.TimeoutExpired:
        app.logger.error('Service %s timed out', action)
        return jsonify({'error': 'Command timed out'}), 500
    except Exception as exc:
        app.logger.error('Service %s error: %s', action, exc)
        return jsonify({'error': str(exc)}), 500


@app.route('/api/logs/<name>', methods=['GET'])
def get_log_file(name):
    """Return last N lines of a log file (error.log or access.log).

    Query params:
      lines - number of lines to return (default 200, max 2000)
      offset - byte offset to read from (for polling new content)
    """
    if name not in ALLOWED_LOGS:
        return jsonify({'error': f'Unknown log: {name}. Allowed: {list(ALLOWED_LOGS.keys())}'}), 404

    log_path = os.path.join(XKEEN_LOG_DIR, ALLOWED_LOGS[name])
    max_lines = min(int(request.args.get('lines', 200)), 2000)
    offset = int(request.args.get('offset', 0))

    try:
        if not os.path.exists(log_path):
            return jsonify({'content': '', 'size': 0}), 200

        file_size = os.path.getsize(log_path)

        if offset > 0:
            if offset >= file_size:
                # No new content since last poll
                return jsonify({'content': '', 'size': file_size}), 200
            # Read only new content since last poll
            with open(log_path, 'r', encoding='utf-8', errors='replace') as f:
                f.seek(offset)
                new_content = f.read()
            return jsonify({'content': new_content, 'size': file_size}), 200

        # Read last N lines (tail)
        with open(log_path, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()
        tail = lines[-max_lines:] if len(lines) > max_lines else lines
        return jsonify({'content': ''.join(tail), 'size': file_size}), 200
    except Exception as exc:
        app.logger.error('Error reading log %s: %s', name, exc)
        return jsonify({'error': str(exc)}), 500


@app.route('/api/logs/<name>/parsed', methods=['GET'])
def get_parsed_log(name):
    """Return last N parsed log lines (same format as WS initial)."""
    if name not in ALLOWED_LOGS:
        return jsonify({'error': f'Unknown log: {name}'}), 404
    max_lines = min(int(request.args.get('lines', 500)), 2000)
    lines, size = _read_log_tail(name, max_lines)
    return jsonify({'lines': lines, 'size': size}), 200


@app.route('/api/logs/<name>/clear', methods=['POST'])
def clear_log_file(name):
    """Truncate a log file (HTTP fallback for when WS is disconnected)."""
    if name not in ALLOWED_LOGS:
        return jsonify({'error': f'Unknown log: {name}'}), 404
    _clear_log(name)
    return jsonify({'status': 'ok'}), 200


@app.route('/api/service/status', methods=['GET'])
def service_status():
    """Check if the xkeen (mihomo/xray) service is running."""
    for proc_name in ('mihomo', 'xray'):
        try:
            result = subprocess.run(
                ['pidof', proc_name],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                pid = int(result.stdout.strip().split()[0])
                return jsonify({'running': True, 'pid': pid}), 200
        except Exception:
            continue
    return jsonify({'running': False, 'pid': None}), 200


@app.route('/api/versions', methods=['GET'])
def get_versions():
    """Return xkeen and dashboard versions."""
    # xkeen version
    xkeen_version = 'unknown'
    try:
        result = subprocess.run(
            ['xkeen', '-v'],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            xkeen_version = result.stdout.strip().splitlines()[0]
    except Exception as exc:
        app.logger.error('Error getting xkeen version: %s', exc)

    # Dashboard version (hardcoded, will be updated in Phase 10)
    dashboard_version = '0.1.0'

    return jsonify({
        'xkeen': xkeen_version,
        'dashboard': dashboard_version,
    }), 200


# ---------------------------------------------------------------------------
# Config API: GET/PUT /api/config
# ---------------------------------------------------------------------------

@app.route('/api/config', methods=['GET'])
def get_config():
    """Return the mihomo config.yaml content as text."""
    try:
        with open(MIHOMO_CONFIG_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({'content': content}), 200
    except FileNotFoundError:
        return jsonify({'error': 'Config file not found'}), 404
    except Exception as exc:
        app.logger.error('Error reading config: %s', exc)
        return jsonify({'error': str(exc)}), 500


@app.route('/api/config', methods=['PUT'])
def put_config():
    """Validate YAML, create backup, and save new config."""
    data = request.get_json(silent=True)
    if data is None or 'content' not in data:
        return jsonify({'error': 'Missing "content" field in request body'}), 400

    content = data['content']

    # Step 1: Validate YAML via ruamel.yaml
    try:
        yaml.load(StringIO(content))
    except Exception as exc:
        return jsonify({'error': f'Invalid YAML: {exc}'}), 400

    # Step 2: Backup existing config
    try:
        backup_path = _create_backup(MIHOMO_CONFIG_PATH, 'config', '.yaml')
    except Exception as exc:
        app.logger.error('Error creating backup: %s', exc)
        return jsonify({'error': f'Backup failed: {exc}'}), 500

    # Step 3: Write new config
    try:
        os.makedirs(os.path.dirname(MIHOMO_CONFIG_PATH), exist_ok=True)
        with open(MIHOMO_CONFIG_PATH, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as exc:
        app.logger.error('Error writing config: %s', exc)
        return jsonify({'error': f'Write failed: {exc}'}), 500

    return jsonify({'message': 'Config saved', 'backup': backup_path}), 200


# ---------------------------------------------------------------------------
# Xkeen Files API: GET/PUT /api/xkeen/<filename>
# ---------------------------------------------------------------------------

@app.route('/api/xkeen/<filename>', methods=['GET'])
def get_xkeen_file(filename):
    """Return the content of an xkeen list file."""
    if filename not in XKEEN_FILES:
        return jsonify({'error': 'Unknown file'}), 404

    actual_filename = XKEEN_FILES[filename]
    filepath = os.path.join(XKEEN_DIR, actual_filename)

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({'content': content, 'filename': actual_filename}), 200
    except FileNotFoundError:
        # File not found is not an error -- return empty content
        return jsonify({'content': '', 'filename': actual_filename}), 200
    except Exception as exc:
        app.logger.error('Error reading xkeen file %s: %s', filename, exc)
        return jsonify({'error': str(exc)}), 500


@app.route('/api/xkeen/<filename>', methods=['PUT'])
def put_xkeen_file(filename):
    """Create backup and save xkeen list file."""
    if filename not in XKEEN_FILES:
        return jsonify({'error': 'Unknown file'}), 404

    data = request.get_json(silent=True)
    if data is None or 'content' not in data:
        return jsonify({'error': 'Missing "content" field in request body'}), 400

    content = data['content']
    actual_filename = XKEEN_FILES[filename]
    filepath = os.path.join(XKEEN_DIR, actual_filename)

    # Backup existing file
    try:
        _create_backup(filepath, filename, '.lst')
    except Exception as exc:
        app.logger.error('Error creating backup for %s: %s', filename, exc)
        return jsonify({'error': f'Backup failed: {exc}'}), 500

    # Write new content
    try:
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as exc:
        app.logger.error('Error writing xkeen file %s: %s', filename, exc)
        return jsonify({'error': f'Write failed: {exc}'}), 500

    return jsonify({'message': f'{filename} saved'}), 200


# ---------------------------------------------------------------------------
# System Metrics
# ---------------------------------------------------------------------------

# Store previous CPU reading for delta calculation
_prev_cpu = {'idle': 0, 'total': 0}


@app.route('/api/system/cpu', methods=['GET'])
def system_cpu():
    """Return current CPU usage percentage from /proc/stat."""
    try:
        with open('/proc/stat', 'r') as f:
            line = f.readline()  # cpu  user nice system idle iowait irq softirq steal
        parts = line.split()
        values = [int(v) for v in parts[1:]]
        idle = values[3]
        total = sum(values)

        prev_idle = _prev_cpu['idle']
        prev_total = _prev_cpu['total']

        _prev_cpu['idle'] = idle
        _prev_cpu['total'] = total

        if prev_total == 0:
            return jsonify({'cpu': 0}), 200

        d_total = total - prev_total
        d_idle = idle - prev_idle

        if d_total == 0:
            return jsonify({'cpu': 0}), 200

        usage = round((1 - d_idle / d_total) * 100, 1)
        return jsonify({'cpu': usage}), 200
    except Exception as exc:
        app.logger.error('CPU usage error: %s', exc)
        return jsonify({'cpu': 0, 'error': str(exc)}), 200


@app.route('/api/system/network', methods=['GET'])
def system_network():
    """Return external IP and basic network info."""
    result = {'ip': None, 'info': None}

    # Try to get external IP via curl (-f = fail on HTTP errors)
    import re
    ip_pattern = re.compile(r'^[\d.]+$|^[0-9a-fA-F:]+$')
    for service in ['ifconfig.me', 'icanhazip.com', 'api.ipify.org', 'ip.sb']:
        try:
            proc = subprocess.run(
                ['curl', '-sf', '-m', '3', f'https://{service}'],
                capture_output=True, text=True, timeout=5
            )
            ip_text = proc.stdout.strip()
            if proc.returncode == 0 and ip_text and ip_pattern.match(ip_text):
                result['ip'] = ip_text
                break
        except Exception:
            continue

    # Try to get IP info (country, ISP) via ip-api.com
    if result['ip']:
        try:
            proc = subprocess.run(
                ['curl', '-s', '-m', '3',
                 f'http://ip-api.com/json/{result["ip"]}?fields=country,city,isp,query'],
                capture_output=True, text=True, timeout=5
            )
            if proc.returncode == 0 and proc.stdout.strip():
                import json
                result['info'] = json.loads(proc.stdout.strip())
        except Exception:
            pass

    # Get uptime from /proc/uptime
    try:
        with open('/proc/uptime', 'r') as f:
            uptime_seconds = float(f.readline().split()[0])
        result['uptime'] = int(uptime_seconds)
    except Exception:
        result['uptime'] = None

    return jsonify(result), 200


# ---------------------------------------------------------------------------
# Proxy Server Addresses
# ---------------------------------------------------------------------------

@app.route('/api/proxies/servers', methods=['GET'])
def proxy_servers():
    """Extract proxy name -> server:port from mihomo config."""
    try:
        with open(MIHOMO_CONFIG_PATH, 'r', encoding='utf-8') as f:
            config = yaml.load(f)
    except Exception as exc:
        app.logger.error('Error reading config for proxies: %s', exc)
        return jsonify({'error': str(exc)}), 500

    proxies = config.get('proxies', []) or []
    result = {}
    for p in proxies:
        if not isinstance(p, dict):
            continue
        name = p.get('name')
        server = p.get('server')
        port = p.get('port')
        if name and server:
            addr = f'{server}:{port}' if port else str(server)
            result[name] = addr

    return jsonify(result), 200


# ---------------------------------------------------------------------------
# WebSocket Log Streaming
# ---------------------------------------------------------------------------

# ANSI escape code stripping
_STRIP_ANSI = re.compile(r'(?:\x1b\[|0\[)\d+m')
# Format 1 (xray v5): time="2026-02-16T07:37:00Z" level=info msg="..."
_LOG_V5 = re.compile(r'time="([^"]+)"\s+level=(\w+)\s+msg="(.+)"$')
# Format 2 (mihomo/xray plain): 2026/02/26 23:45:44.861019 INFO  message
_LOG_PLAIN = re.compile(
    r'^(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+)\s+'
    r'(INFO|WARN|WARNING|ERROR|DEBUG)\s+(.+)$',
    re.IGNORECASE,
)

_MAX_WS_LINES = 1000


def _parse_log_line(raw):
    """Parse a raw log line into {time, level, msg} dict."""
    clean = _STRIP_ANSI.sub('', raw).strip()
    if not clean:
        return None

    m = _LOG_V5.search(clean)
    if m:
        ts = m.group(1)
        short = ts[11:19] if 'T' in ts else ts
        return {'time': short, 'level': m.group(2).lower(), 'msg': m.group(3)}

    m = _LOG_PLAIN.match(clean)
    if m:
        time_part = m.group(1).split()[-1][:8]
        return {'time': time_part, 'level': m.group(2).lower(), 'msg': m.group(3)}

    # For unstructured lines (xkeen status), keep ANSI codes for frontend rendering
    raw_stripped = raw.strip()
    if '\x1b[' in raw_stripped:
        return {'time': None, 'level': None, 'msg': raw_stripped}
    return {'time': None, 'level': None, 'msg': clean}


def _read_log_tail(name, max_lines=_MAX_WS_LINES):
    """Read last max_lines from a log file. Returns (parsed_lines, file_size)."""
    log_path = os.path.join(XKEEN_LOG_DIR, ALLOWED_LOGS.get(name, 'error.log'))
    if not os.path.exists(log_path):
        return [], 0
    size = os.path.getsize(log_path)
    with open(log_path, 'r', encoding='utf-8', errors='replace') as f:
        all_lines = f.readlines()
    tail = all_lines[-max_lines:]
    parsed = [_parse_log_line(l) for l in tail]
    return [p for p in parsed if p], size


def _read_from_offset(name, offset):
    """Read new lines from byte offset. Returns (parsed_lines, new_size, truncated)."""
    log_path = os.path.join(XKEEN_LOG_DIR, ALLOWED_LOGS.get(name, 'error.log'))
    if not os.path.exists(log_path):
        return [], 0, False
    size = os.path.getsize(log_path)
    if size < offset:
        return [], size, True
    if size == offset:
        return [], size, False
    with open(log_path, 'r', encoding='utf-8', errors='replace') as f:
        f.seek(offset)
        new_data = f.read()
    lines = new_data.splitlines()
    parsed = [_parse_log_line(l) for l in lines]
    return [p for p in parsed if p], size, False


def _clear_log(name):
    """Truncate a log file."""
    log_path = os.path.join(XKEEN_LOG_DIR, ALLOWED_LOGS.get(name, 'error.log'))
    if os.path.exists(log_path):
        open(log_path, 'w').close()


if sock:
    @sock.route('/ws/logs')
    def ws_log_stream(ws):
        """WebSocket endpoint for real-time log streaming.

        Protocol:
          Client -> Server: {type: "switchFile", file: "access"}
          Client -> Server: {type: "reload"}
          Client -> Server: {type: "clear"}
          Client -> Server: {type: "ping"}
          Server -> Client: {type: "initial", lines: [...], file: "error"}
          Server -> Client: {type: "append", lines: [...]}
          Server -> Client: {type: "clear"}
          Server -> Client: {type: "pong"}
        """
        current_file = 'error'
        logger.info('[WS] Client connected')

        # Send initial content
        lines, offset = _read_log_tail(current_file)
        try:
            ws.send(json.dumps({'type': 'initial', 'lines': lines, 'file': current_file}))
            logger.info('[WS] Sent initial %d lines for %s', len(lines), current_file)
        except Exception as e:
            logger.error('[WS] Failed to send initial: %s', e)
            return

        # Simple single-threaded loop: receive with timeout, then poll file
        while True:
            # 1) Check for client message (0.5s timeout)
            try:
                data = ws.receive(timeout=0.5)
            except Exception:
                # Connection closed or error
                logger.info('[WS] Connection closed')
                break

            if data is not None:
                try:
                    msg = json.loads(data)
                    cmd = msg.get('type')

                    if cmd == 'switchFile':
                        f = msg.get('file', 'error').replace('.log', '')
                        if f in ALLOWED_LOGS:
                            current_file = f
                        lines, offset = _read_log_tail(current_file)
                        ws.send(json.dumps({
                            'type': 'initial', 'lines': lines,
                            'file': current_file,
                        }))

                    elif cmd == 'reload':
                        lines, offset = _read_log_tail(current_file)
                        ws.send(json.dumps({
                            'type': 'initial', 'lines': lines,
                            'file': current_file,
                        }))

                    elif cmd == 'clear':
                        _clear_log(current_file)
                        ws.send(json.dumps({'type': 'clear'}))
                        offset = 0

                    elif cmd == 'ping':
                        ws.send(json.dumps({'type': 'pong'}))

                except Exception as e:
                    logger.error('[WS] Error handling cmd: %s', e)

            # 2) Poll for new file content
            try:
                new_lines, new_size, truncated = _read_from_offset(
                    current_file, offset,
                )
                if truncated:
                    lines, offset = _read_log_tail(current_file)
                    ws.send(json.dumps({
                        'type': 'initial', 'lines': lines,
                        'file': current_file,
                    }))
                elif new_lines:
                    ws.send(json.dumps({
                        'type': 'append', 'lines': new_lines,
                    }))
                    offset = new_size
                else:
                    offset = new_size
            except Exception as e:
                logger.error('[WS] Poll error: %s', e)

        logger.info('[WS] Client handler exited')


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    if _HAS_GEVENT:
        from gevent.pywsgi import WSGIServer
        logger.info('Starting with gevent WSGIServer on :%d', port)
        server = WSGIServer(('0.0.0.0', port), app)
        server.serve_forever()
    else:
        logger.info('Starting with werkzeug (threaded) on :%d', port)
        app.run(host='0.0.0.0', port=port, threaded=True)
