import uuid

from flask import Blueprint, Response, jsonify, render_template, request

from app.models import default_typography
from app.services.storage import (
    create_new_resume,
    delete_resume,
    list_resumes,
    load_resume,
    save_resume,
)

_MAX_IMPORT_BYTES = 10 * 1024 * 1024  # 10 MB
_ALLOWED_EXTENSIONS = {'pdf', 'docx'}
_ALLOWED_MIMETYPES = {
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

bp = Blueprint('main', __name__)


@bp.route('/api/import', methods=['POST'])
def import_resume():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400

    filename = file.filename.lower()
    ext = filename.rsplit('.', 1)[-1] if '.' in filename else ''
    mimetype = file.mimetype or ''

    if ext not in _ALLOWED_EXTENSIONS and mimetype not in _ALLOWED_MIMETYPES:
        return jsonify({'error': 'Unsupported file type; must be PDF or DOCX'}), 400

    file_bytes = file.read()
    if len(file_bytes) > _MAX_IMPORT_BYTES:
        return jsonify({'error': 'File exceeds 10 MB limit'}), 400

    is_pdf = ext == 'pdf' or mimetype == 'application/pdf'

    try:
        if is_pdf:
            from app.services.pdf_import import import_pdf
            data = import_pdf(file_bytes)
        else:
            from app.services.docx_import import import_docx
            data = import_docx(file_bytes)
    except Exception:
        return jsonify({'error': 'Failed to parse file'}), 422

    resume_id = str(uuid.uuid4())
    save_resume(resume_id, data, default_typography())
    return jsonify({'id': resume_id, 'data': data}), 201


@bp.route('/')
def index():
    return render_template('editor.html')


@bp.route('/api/resumes')
def get_resumes():
    return jsonify(list_resumes())


@bp.route('/api/resume/new', methods=['POST'])
def new_resume():
    resume_id = create_new_resume()
    return jsonify({'id': resume_id}), 201


@bp.route('/api/resume/<resume_id>', methods=['GET'])
def get_resume(resume_id):
    try:
        data, typography = load_resume(resume_id)
    except FileNotFoundError:
        return jsonify({'error': 'Resume not found'}), 404
    return jsonify({'id': resume_id, 'data': data, 'typography': typography})


@bp.route('/api/resume/<resume_id>', methods=['POST'])
def update_resume(resume_id):
    body = request.get_json(silent=True)
    if not body:
        return jsonify({'error': 'Invalid or missing JSON body'}), 400
    data = body.get('data')
    typography = body.get('typography')
    if data is None or typography is None:
        return jsonify({'error': 'Body must include "data" and "typography"'}), 400
    save_resume(resume_id, data, typography)
    return jsonify({'id': resume_id})


@bp.route('/api/resume/<resume_id>/pdf', methods=['GET'])
def get_resume_pdf(resume_id):
    try:
        data, typography = load_resume(resume_id)
    except FileNotFoundError:
        return jsonify({'error': 'Resume not found'}), 404
    try:
        from app.services.pdf_export import export_pdf
        pdf_bytes = export_pdf(data, typography)
    except Exception:
        return jsonify({'error': 'PDF generation failed'}), 500
    return Response(
        pdf_bytes,
        status=200,
        headers={
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="resume.pdf"',
        },
    )


@bp.route('/api/resume/<resume_id>/ats-score', methods=['GET'])
def get_ats_score(resume_id):
    try:
        data, _ = load_resume(resume_id)
    except FileNotFoundError:
        return jsonify({'error': 'Resume not found'}), 404

    from app.services.ats_optimizer import analyze_ats_score, suggest_improvements

    result = analyze_ats_score(data)
    raw_suggestions = suggest_improvements(data)

    issues = [_classify_issue(msg) for msg in result['issues']]
    suggestions = [_classify_suggestion(msg, i) for i, msg in enumerate(raw_suggestions)]

    return jsonify({'score': result['score'], 'issues': issues, 'suggestions': suggestions})


def _classify_issue(message: str) -> dict:
    msg_lower = message.lower()
    if any(w in msg_lower for w in ('experience', 'bullet', 'employment')):
        section = 'experience'
    elif 'education' in msg_lower:
        section = 'education'
    elif 'skill' in msg_lower:
        section = 'skills'
    elif any(w in msg_lower for w in ('contact', 'name', 'email', 'phone')):
        section = 'contact'
    elif 'summary' in msg_lower:
        section = 'summary'
    else:
        section = 'general'

    severity = 'error' if any(w in msg_lower for w in ('missing', 'malformed')) else 'warning'
    return {'severity': severity, 'message': message, 'section': section}


def _classify_suggestion(message: str, index: int) -> dict:
    msg_lower = message.lower()
    if any(w in msg_lower for w in ('experience', 'bullet', 'role')):
        section = 'experience'
    elif 'education' in msg_lower:
        section = 'education'
    elif 'skill' in msg_lower:
        section = 'skills'
    elif any(w in msg_lower for w in ('linkedin', 'contact', 'email', 'phone')):
        section = 'contact'
    elif 'summary' in msg_lower:
        section = 'summary'
    else:
        section = 'general'

    priority = 'high' if index < 2 else 'medium'
    return {'message': message, 'section': section, 'priority': priority}


@bp.route('/api/resume/<resume_id>', methods=['DELETE'])
def remove_resume(resume_id):
    try:
        delete_resume(resume_id)
    except FileNotFoundError:
        return jsonify({'error': 'Resume not found'}), 404
    return jsonify({'id': resume_id})
