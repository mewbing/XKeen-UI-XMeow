import os
import shutil
import subprocess
from datetime import datetime
from io import StringIO

from flask import Flask, request, jsonify
from flask_cors import CORS
from ruamel.yaml import YAML

app = Flask(__name__)
CORS(app)

yaml = YAML()
yaml.preserve_quotes = True

# Environment-based configuration paths
MIHOMO_CONFIG_PATH = os.environ.get(
    'MIHOMO_CONFIG_PATH', '/opt/etc/xkeen/config.yaml'
)
XKEEN_DIR = os.environ.get('XKEEN_DIR', '/opt/etc/xkeen')
BACKUP_DIR = os.environ.get('BACKUP_DIR', '/opt/etc/xkeen/backups')
XKEEN_INIT = os.environ.get('XKEEN_INIT_SCRIPT', '/opt/etc/init.d/S24xray')

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

@app.route('/api/service/<action>', methods=['POST'])
def service_action(action):
    """Start, stop, or restart the xkeen service."""
    if action not in ('start', 'stop', 'restart'):
        return jsonify({'error': 'Invalid action. Must be start, stop, or restart'}), 400

    try:
        result = subprocess.run(
            [XKEEN_INIT, action],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            error_msg = result.stderr.strip() or 'Command failed'
            app.logger.error('Service %s failed: %s', action, error_msg)
            return jsonify({'error': error_msg}), 500
        return jsonify({'status': 'ok'}), 200
    except subprocess.TimeoutExpired:
        app.logger.error('Service %s timed out', action)
        return jsonify({'error': 'Command timed out'}), 500
    except Exception as exc:
        app.logger.error('Service %s error: %s', action, exc)
        return jsonify({'error': str(exc)}), 500


@app.route('/api/service/status', methods=['GET'])
def service_status():
    """Check if the mihomo process is running."""
    try:
        result = subprocess.run(
            ['pidof', 'mihomo'],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            pid = int(result.stdout.strip())
            return jsonify({'running': True, 'pid': pid}), 200
        return jsonify({'running': False, 'pid': None}), 200
    except Exception as exc:
        app.logger.error('Service status error: %s', exc)
        return jsonify({'running': False, 'pid': None, 'error': str(exc)}), 200


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


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
