import sys
from unittest.mock import MagicMock, patch

import pytest

from app import create_app
from app.services import storage


@pytest.fixture
def app(tmp_path):
    app = create_app()
    app.instance_path = str(tmp_path)
    app.config['TESTING'] = True
    return app


@pytest.fixture
def client(app):
    return app.test_client()


def test_get_resume_docx_not_found(client):
    resp = client.get('/api/resume/nonexistent/docx')
    assert resp.status_code == 404
    assert resp.get_json()['error'] == 'Resume not found'


def test_get_resume_docx_success(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    fake_docx = b'PK\x03\x04fake-docx'
    fake_module = MagicMock()
    fake_module.export_docx.return_value = fake_docx

    with patch.dict(sys.modules, {'app.services.docx_export': fake_module}):
        resp = client.get(f'/api/resume/{resume_id}/docx')

    assert resp.status_code == 200
    assert resp.content_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    assert resp.data == fake_docx
    fake_module.export_docx.assert_called_once()


def test_get_resume_docx_filename_uses_name(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()
        data, typography = storage.load_resume(resume_id)
        data['header']['name'] = 'Jane Doe'
        storage.save_resume(resume_id, data, typography)

    fake_module = MagicMock()
    fake_module.export_docx.return_value = b'PK\x03\x04fake'

    with patch.dict(sys.modules, {'app.services.docx_export': fake_module}):
        resp = client.get(f'/api/resume/{resume_id}/docx')

    assert resp.status_code == 200
    assert resp.headers['Content-Disposition'] == 'attachment; filename="Jane Doe-resume.docx"'


def test_get_resume_docx_generation_failure(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    fake_module = MagicMock()
    fake_module.export_docx.side_effect = RuntimeError('render failed')

    with patch.dict(sys.modules, {'app.services.docx_export': fake_module}):
        resp = client.get(f'/api/resume/{resume_id}/docx')

    assert resp.status_code == 500
    assert resp.get_json()['error'] == 'DOCX generation failed'
