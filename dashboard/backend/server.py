import os
from flask import Flask, jsonify
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


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok'}), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
