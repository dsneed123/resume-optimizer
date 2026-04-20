import io
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


@pytest.fixture
def resume_id(app):
    with app.app_context():
        return storage.create_new_resume()


def _sample_data():
    return {'header': {'name': 'John Doe', 'email': 'john@example.com'}}


def _sample_typography():
    from app.models import default_typography
    return default_typography()


# --- GET /api/resume/<id> ---

def test_get_resume_returns_resume(client, resume_id):
    resp = client.get(f'/api/resume/{resume_id}')
    assert resp.status_code == 200
    body = resp.get_json()
    assert body['id'] == resume_id
    assert 'data' in body
    assert 'typography' in body


def test_get_resume_includes_metadata(client, resume_id):
    resp = client.get(f'/api/resume/{resume_id}')
    body = resp.get_json()
    assert 'resume_name' in body
    assert 'created_at' in body
    assert 'updated_at' in body


def test_get_resume_not_found(client):
    resp = client.get('/api/resume/nonexistent-id')
    assert resp.status_code == 404
    assert resp.get_json()['error'] == 'Resume not found'


# --- POST /api/resume/<id> (update) ---

def test_update_resume_saves_changes(client, resume_id):
    data = _sample_data()
    typography = _sample_typography()
    resp = client.post(
        f'/api/resume/{resume_id}',
        json={'data': data, 'typography': typography},
    )
    assert resp.status_code == 200
    assert resp.get_json()['id'] == resume_id


def test_update_resume_persists_data(client, app, resume_id):
    data = _sample_data()
    typography = _sample_typography()
    client.post(
        f'/api/resume/{resume_id}',
        json={'data': data, 'typography': typography},
    )
    resp = client.get(f'/api/resume/{resume_id}')
    assert resp.get_json()['data']['header']['name'] == 'John Doe'


def test_update_resume_missing_body(client, resume_id):
    resp = client.post(f'/api/resume/{resume_id}', data='', content_type='application/json')
    assert resp.status_code == 400
    assert 'error' in resp.get_json()


def test_update_resume_missing_data_field(client, resume_id):
    resp = client.post(f'/api/resume/{resume_id}', json={'typography': _sample_typography()})
    assert resp.status_code == 400
    assert 'error' in resp.get_json()


def test_update_resume_missing_typography_field(client, resume_id):
    resp = client.post(f'/api/resume/{resume_id}', json={'data': _sample_data()})
    assert resp.status_code == 400
    assert 'error' in resp.get_json()


def test_update_resume_accepts_resume_name(client, resume_id):
    resp = client.post(
        f'/api/resume/{resume_id}',
        json={'data': _sample_data(), 'typography': _sample_typography(), 'resume_name': 'My Resume'},
    )
    assert resp.status_code == 200


# --- POST /api/resume/new ---

def test_new_resume_creates_resume(client):
    resp = client.post('/api/resume/new')
    assert resp.status_code == 201
    body = resp.get_json()
    assert 'id' in body
    assert isinstance(body['id'], str)
    assert len(body['id']) > 0


def test_new_resume_creates_retrievable_resume(client):
    new_resp = client.post('/api/resume/new')
    resume_id = new_resp.get_json()['id']
    get_resp = client.get(f'/api/resume/{resume_id}')
    assert get_resp.status_code == 200


def test_new_resume_creates_unique_ids(client):
    id1 = client.post('/api/resume/new').get_json()['id']
    id2 = client.post('/api/resume/new').get_json()['id']
    assert id1 != id2


# --- DELETE /api/resume/<id> ---

def test_delete_resume_removes_resume(client, resume_id):
    resp = client.delete(f'/api/resume/{resume_id}')
    assert resp.status_code == 200
    assert resp.get_json()['id'] == resume_id


def test_delete_resume_makes_it_unretrievable(client, resume_id):
    client.delete(f'/api/resume/{resume_id}')
    resp = client.get(f'/api/resume/{resume_id}')
    assert resp.status_code == 404


def test_delete_resume_not_found(client):
    resp = client.delete('/api/resume/nonexistent-id')
    assert resp.status_code == 404
    assert resp.get_json()['error'] == 'Resume not found'


# --- GET /api/resume/<id>/pdf ---

def test_get_pdf_returns_pdf(client, app, resume_id):
    fake_pdf = b'%PDF-fake'
    fake_module = MagicMock()
    fake_module.export_pdf.return_value = fake_pdf

    with patch.dict(sys.modules, {'app.services.pdf_export': fake_module}):
        resp = client.get(f'/api/resume/{resume_id}/pdf')

    assert resp.status_code == 200
    assert resp.content_type == 'application/pdf'
    assert resp.data == fake_pdf


def test_get_pdf_content_disposition(client, app, resume_id):
    fake_module = MagicMock()
    fake_module.export_pdf.return_value = b'%PDF-fake'

    with patch.dict(sys.modules, {'app.services.pdf_export': fake_module}):
        resp = client.get(f'/api/resume/{resume_id}/pdf')

    assert resp.headers['Content-Disposition'] == 'attachment; filename="resume.pdf"'


def test_get_pdf_not_found(client):
    resp = client.get('/api/resume/nonexistent-id/pdf')
    assert resp.status_code == 404
    assert resp.get_json()['error'] == 'Resume not found'


def test_get_pdf_generation_failure(client, resume_id):
    fake_module = MagicMock()
    fake_module.export_pdf.side_effect = RuntimeError('render failed')

    with patch.dict(sys.modules, {'app.services.pdf_export': fake_module}):
        resp = client.get(f'/api/resume/{resume_id}/pdf')

    assert resp.status_code == 500
    assert resp.get_json()['error'] == 'PDF generation failed'


# --- POST /api/import ---

def _post_file(client, filename, content, content_type='application/octet-stream'):
    data = {'file': (io.BytesIO(content), filename, content_type)}
    return client.post('/api/import', data=data, content_type='multipart/form-data')


def test_import_accepts_pdf_upload(client):
    fake_module = MagicMock()
    fake_module.import_pdf.return_value = _sample_data()

    with patch.dict(sys.modules, {'app.services.pdf_import': fake_module}):
        resp = _post_file(client, 'resume.pdf', b'%PDF-fake', 'application/pdf')

    assert resp.status_code == 201
    body = resp.get_json()
    assert 'id' in body
    assert 'data' in body


def test_import_accepts_docx_upload(client):
    fake_module = MagicMock()
    fake_module.import_docx.return_value = _sample_data()
    docx_mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    with patch.dict(sys.modules, {'app.services.docx_import': fake_module}):
        resp = _post_file(client, 'resume.docx', b'PK\x03\x04fake', docx_mime)

    assert resp.status_code == 201
    body = resp.get_json()
    assert 'id' in body


def test_import_creates_retrievable_resume(client):
    fake_module = MagicMock()
    fake_module.import_pdf.return_value = _sample_data()

    with patch.dict(sys.modules, {'app.services.pdf_import': fake_module}):
        import_resp = _post_file(client, 'resume.pdf', b'%PDF-fake', 'application/pdf')

    resume_id = import_resp.get_json()['id']
    get_resp = client.get(f'/api/resume/{resume_id}')
    assert get_resp.status_code == 200


def test_import_no_file(client):
    resp = client.post('/api/import', data={}, content_type='multipart/form-data')
    assert resp.status_code == 400
    assert 'error' in resp.get_json()


def test_import_unsupported_type(client):
    resp = _post_file(client, 'resume.txt', b'hello', 'text/plain')
    assert resp.status_code == 415
    assert 'Unsupported' in resp.get_json()['error']


def test_import_returns_parse_meta(client):
    fake_module = MagicMock()
    fake_module.import_pdf.return_value = _sample_data()

    with patch.dict(sys.modules, {'app.services.pdf_import': fake_module}):
        resp = _post_file(client, 'resume.pdf', b'%PDF-fake', 'application/pdf')

    body = resp.get_json()
    assert 'parse_meta' in body


# --- 404 for non-existent resume (all relevant endpoints) ---

def test_404_on_get_nonexistent(client):
    assert client.get('/api/resume/does-not-exist').status_code == 404


def test_404_on_delete_nonexistent(client):
    assert client.delete('/api/resume/does-not-exist').status_code == 404


def test_404_on_pdf_nonexistent(client):
    assert client.get('/api/resume/does-not-exist/pdf').status_code == 404
