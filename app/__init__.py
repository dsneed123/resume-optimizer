import os
from flask import Flask


_MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
_MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']


def _format_date(date_str, fmt='MMM YYYY'):
    if not date_str:
        return date_str
    s = str(date_str).strip()
    if not s or s.lower() == 'present':
        return s
    month = None
    year = None
    for i, (full, short) in enumerate(zip(_MONTHS_FULL, _MONTHS_SHORT)):
        if s.lower().startswith(full.lower()) or s.lower().startswith(short.lower()):
            month = i + 1
            rest = s[len(full):].strip() if s.lower().startswith(full.lower()) else s[len(short):].strip()
            try:
                year = int(rest)
            except (ValueError, TypeError):
                year = None
            break
    if month is None:
        import re
        m = re.match(r'^(\d{1,2})/(\d{4})$', s)
        if m:
            month, year = int(m.group(1)), int(m.group(2))
        else:
            m = re.match(r'^(\d{4})-(\d{2})$', s)
            if m:
                year, month = int(m.group(1)), int(m.group(2))
            else:
                m = re.match(r'^(\d{4})$', s)
                if m:
                    year = int(m.group(1))
    if not year:
        return s
    if fmt == 'MMM YYYY':
        return (_MONTHS_SHORT[month - 1] + ' ' + str(year)) if month else str(year)
    if fmt == 'MMMM YYYY':
        return (_MONTHS_FULL[month - 1] + ' ' + str(year)) if month else str(year)
    if fmt == 'MM/YYYY':
        return (str(month).zfill(2) + '/' + str(year)) if month else str(year)
    if fmt == 'YYYY':
        return str(year)
    return s


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

    app.jinja_env.filters['format_date'] = _format_date

    from app.routes import bp
    app.register_blueprint(bp)

    return app
