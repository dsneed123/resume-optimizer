from flask import Blueprint, jsonify, render_template, request

from app.services.storage import (
    create_new_resume,
    delete_resume,
    list_resumes,
    load_resume,
    save_resume,
)

bp = Blueprint('main', __name__)


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


@bp.route('/api/resume/<resume_id>', methods=['DELETE'])
def remove_resume(resume_id):
    try:
        delete_resume(resume_id)
    except FileNotFoundError:
        return jsonify({'error': 'Resume not found'}), 404
    return jsonify({'id': resume_id})
