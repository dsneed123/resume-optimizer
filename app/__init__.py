import hmac
import os
import re
import secrets

from flask import Flask, abort, jsonify, request, session
from markupsafe import Markup, escape


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


def _render_inline_md(text):
    """Convert **bold** and *italic* markdown to HTML. Returns a Markup to avoid double-escaping."""
    s = str(text or '')
    # Escape HTML first, then apply markdown substitutions on the escaped string
    s = str(escape(s))
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'\*(.+?)\*', r'<em>\1</em>', s)
    return Markup(s)


def create_app():
    app = Flask(__name__)
    app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-change-in-production')
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB upload limit
    app.config.setdefault('WTF_CSRF_ENABLED', True)

    upload_dir = os.path.join(app.instance_path, 'uploads')
    export_dir = os.path.join(app.instance_path, 'exports')
    os.makedirs(upload_dir, exist_ok=True)
    os.makedirs(export_dir, exist_ok=True)
    app.config['UPLOAD_FOLDER'] = upload_dir
    app.config['EXPORT_FOLDER'] = export_dir

    app.jinja_env.filters['format_date'] = _format_date
    app.jinja_env.filters['render_inline_md'] = _render_inline_md

    @app.context_processor
    def _inject_csrf_token():
        def csrf_token():
            if 'csrf_token' not in session:
                session['csrf_token'] = secrets.token_hex(32)
            return session['csrf_token']
        return {'csrf_token': csrf_token}

    @app.before_request
    def _csrf_protect():
        if app.config.get('TESTING') or not app.config.get('WTF_CSRF_ENABLED', True):
            return
        if request.method not in ('POST', 'PUT', 'PATCH', 'DELETE'):
            return
        token = session.get('csrf_token')
        request_token = (
            request.headers.get('X-CSRFToken')
            or request.form.get('csrf_token')
        )
        if not token or not request_token:
            abort(403)
        if not hmac.compare_digest(str(token), str(request_token)):
            abort(403)

    from app.limiter import limiter
    limiter.init_app(app)

    from app.routes import bp
    app.register_blueprint(bp)

    @app.errorhandler(403)
    def csrf_error(e):
        return jsonify({'error': 'CSRF validation failed'}), 403

    @app.errorhandler(413)
    def request_entity_too_large(e):
        return jsonify({'error': 'File exceeds size limit'}), 413

    @app.errorhandler(429)
    def rate_limit_exceeded(e):
        resp = jsonify({'error': 'Rate limit exceeded'})
        resp.status_code = 429
        retry_after = getattr(e, 'retry_after', None)
        if retry_after is not None:
            resp.headers['Retry-After'] = str(int(retry_after.total_seconds()))
        else:
            resp.headers['Retry-After'] = '60'
        return resp

    return app
