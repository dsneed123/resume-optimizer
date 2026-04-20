import io
import sys
from unittest.mock import MagicMock, patch

import pytest

from app import create_app


@pytest.fixture
def app(tmp_path):
    app = create_app()
    app.instance_path = str(tmp_path)
    app.config['TESTING'] = True
    return app


@pytest.fixture
def client(app):
    return app.test_client()


def _fake_data():
    return {'header': {'name': 'Jane Doe', 'email': 'jane@example.com'}}


def _post_file(client, filename, content, content_type='application/octet-stream'):
    data = {'file': (io.BytesIO(content), filename, content_type)}
    return client.post('/api/import', data=data, content_type='multipart/form-data')


def test_import_no_file(client):
    resp = client.post('/api/import', data={}, content_type='multipart/form-data')
    assert resp.status_code == 400
    assert 'error' in resp.get_json()


def test_import_unsupported_type(client):
    resp = _post_file(client, 'resume.txt', b'hello', 'text/plain')
    assert resp.status_code == 415
    assert 'Unsupported' in resp.get_json()['error']


def test_import_file_too_large(client):
    big = b'x' * (10 * 1024 * 1024 + 1)
    resp = _post_file(client, 'resume.pdf', big, 'application/pdf')
    assert resp.status_code == 413
    assert '10 MB' in resp.get_json()['error']


def test_import_pdf_success(client):
    fake_module = MagicMock()
    fake_module.import_pdf.return_value = _fake_data()

    with patch.dict(sys.modules, {'app.services.pdf_import': fake_module}):
        resp = _post_file(client, 'resume.pdf', b'%PDF-fake', 'application/pdf')

    assert resp.status_code == 201
    body = resp.get_json()
    assert 'id' in body
    assert body['data'] == _fake_data()
    fake_module.import_pdf.assert_called_once_with(b'%PDF-fake')


def test_import_docx_success(client):
    fake_module = MagicMock()
    fake_module.import_docx.return_value = _fake_data()
    docx_mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    with patch.dict(sys.modules, {'app.services.docx_import': fake_module}):
        resp = _post_file(client, 'resume.docx', b'PK\x03\x04fake', docx_mime)

    assert resp.status_code == 201
    body = resp.get_json()
    assert 'id' in body
    assert body['data'] == _fake_data()
    fake_module.import_docx.assert_called_once()


def test_import_pdf_parse_failure(client):
    fake_module = MagicMock()
    fake_module.import_pdf.side_effect = ValueError('bad pdf')

    with patch.dict(sys.modules, {'app.services.pdf_import': fake_module}):
        resp = _post_file(client, 'resume.pdf', b'%PDF-fake', 'application/pdf')

    assert resp.status_code == 422
    assert 'error' in resp.get_json()


def test_import_returns_parse_meta(client):
    fake_module = MagicMock()
    fake_module.import_pdf.return_value = _fake_data()

    with patch.dict(sys.modules, {'app.services.pdf_import': fake_module}):
        resp = _post_file(client, 'resume.pdf', b'%PDF-fake', 'application/pdf')

    assert resp.status_code == 201
    body = resp.get_json()
    assert 'parse_meta' in body
    meta = body['parse_meta']
    assert 'header' in meta
    assert meta['header']['confidence'] in ('high', 'low')


def test_import_pdf_detected_by_mimetype(client):
    fake_module = MagicMock()
    fake_module.import_pdf.return_value = _fake_data()

    with patch.dict(sys.modules, {'app.services.pdf_import': fake_module}):
        resp = _post_file(client, 'resume.bin', b'%PDF-fake', 'application/pdf')

    assert resp.status_code == 201
    fake_module.import_pdf.assert_called_once()
