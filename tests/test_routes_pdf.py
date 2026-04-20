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


def test_get_resume_pdf_not_found(client):
    resp = client.get('/api/resume/nonexistent/pdf')
    assert resp.status_code == 404
    assert resp.get_json()['error'] == 'Resume not found'


def test_get_resume_pdf_success(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    fake_pdf = b'%PDF-fake'
    fake_module = MagicMock()
    fake_module.export_pdf.return_value = fake_pdf

    with patch.dict(sys.modules, {'app.services.pdf_export': fake_module}):
        resp = client.get(f'/api/resume/{resume_id}/pdf')

    assert resp.status_code == 200
    assert resp.content_type == 'application/pdf'
    assert resp.headers['Content-Disposition'] == 'attachment; filename="resume.pdf"'
    assert resp.data == fake_pdf
    fake_module.export_pdf.assert_called_once()


def test_get_resume_pdf_generation_failure(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    fake_module = MagicMock()
    fake_module.export_pdf.side_effect = RuntimeError('render failed')

    with patch.dict(sys.modules, {'app.services.pdf_export': fake_module}):
        resp = client.get(f'/api/resume/{resume_id}/pdf')

    assert resp.status_code == 500
    assert resp.get_json()['error'] == 'PDF generation failed'
