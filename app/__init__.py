import os
from flask import Flask


def create_app():
    app = Flask(__name__)
    app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-change-in-production')
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB upload limit

    upload_dir = os.path.join(app.instance_path, 'uploads')
    export_dir = os.path.join(app.instance_path, 'exports')
    os.makedirs(upload_dir, exist_ok=True)
    os.makedirs(export_dir, exist_ok=True)
    app.config['UPLOAD_FOLDER'] = upload_dir
    app.config['EXPORT_FOLDER'] = export_dir

    from app.routes import bp
    app.register_blueprint(bp)

    return app
