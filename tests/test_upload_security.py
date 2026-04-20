import io
import os
import time

import pytest

from app import create_app
from app.services.upload_security import cleanup_old_uploads, save_upload, validate_magic_bytes


def test_validate_magic_bytes_pdf_valid():
    assert validate_magic_bytes(b'%PDF-1.4 content', is_pdf=True) is True


def test_validate_magic_bytes_pdf_invalid():
    assert validate_magic_bytes(b'PK\x03\x04notpdf', is_pdf=True) is False


def test_validate_magic_bytes_docx_valid():
    assert validate_magic_bytes(b'PK\x03\x04content', is_pdf=False) is True


def test_validate_magic_bytes_docx_invalid():
    assert validate_magic_bytes(b'%PDF-1.4', is_pdf=False) is False


def test_validate_magic_bytes_too_short():
    assert validate_magic_bytes(b'%PD', is_pdf=True) is False
    assert validate_magic_bytes(b'PK\x03', is_pdf=False) is False


def test_save_upload_creates_randomized_file(tmp_path):
    upload_dir = str(tmp_path / 'uploads')
    path = save_upload(upload_dir, b'%PDF-test', 'pdf')
    assert os.path.exists(path)
    assert path.endswith('.pdf')
    name_part = os.path.basename(path)[:-4]  # strip .pdf
    assert len(name_part) == 32
    assert name_part.isalnum()


def test_save_upload_two_files_have_different_names(tmp_path):
    upload_dir = str(tmp_path / 'uploads')
    path1 = save_upload(upload_dir, b'%PDF-test', 'pdf')
    path2 = save_upload(upload_dir, b'%PDF-test', 'pdf')
    assert path1 != path2


def test_save_upload_creates_directory(tmp_path):
    upload_dir = str(tmp_path / 'deep' / 'uploads')
    path = save_upload(upload_dir, b'PK\x03\x04test', 'docx')
    assert os.path.isdir(upload_dir)
    assert os.path.exists(path)


def test_cleanup_old_uploads_removes_stale_files(tmp_path):
    upload_dir = str(tmp_path / 'uploads')
    os.makedirs(upload_dir)
    old_file = os.path.join(upload_dir, 'old.pdf')
    with open(old_file, 'wb') as f:
        f.write(b'%PDF-old')
    old_time = time.time() - 7200  # 2 hours ago
    os.utime(old_file, (old_time, old_time))

    removed = cleanup_old_uploads(upload_dir, max_age_seconds=3600)
    assert removed == 1
    assert not os.path.exists(old_file)


def test_cleanup_old_uploads_keeps_recent_files(tmp_path):
    upload_dir = str(tmp_path / 'uploads')
    os.makedirs(upload_dir)
    recent_file = os.path.join(upload_dir, 'recent.pdf')
    with open(recent_file, 'wb') as f:
        f.write(b'%PDF-recent')

    removed = cleanup_old_uploads(upload_dir, max_age_seconds=3600)
    assert removed == 0
    assert os.path.exists(recent_file)


def test_cleanup_old_uploads_missing_dir():
    removed = cleanup_old_uploads('/nonexistent/path/uploads')
    assert removed == 0


def test_cleanup_old_uploads_mixed(tmp_path):
    upload_dir = str(tmp_path / 'uploads')
    os.makedirs(upload_dir)

    old_file = os.path.join(upload_dir, 'old.pdf')
    with open(old_file, 'wb') as f:
        f.write(b'old')
    old_time = time.time() - 7200
    os.utime(old_file, (old_time, old_time))

    new_file = os.path.join(upload_dir, 'new.pdf')
    with open(new_file, 'wb') as f:
        f.write(b'new')

    removed = cleanup_old_uploads(upload_dir, max_age_seconds=3600)
    assert removed == 1
    assert not os.path.exists(old_file)
    assert os.path.exists(new_file)


# --- Integration tests via the /api/import endpoint ---

@pytest.fixture
def app(tmp_path):
    app = create_app()
    app.instance_path = str(tmp_path)
    app.config['TESTING'] = True
    return app


@pytest.fixture
def client(app):
    return app.test_client()


def _post_file(client, filename, content, content_type):
    data = {'file': (io.BytesIO(content), filename, content_type)}
    return client.post('/api/import', data=data, content_type='multipart/form-data')


def test_import_rejects_pdf_with_wrong_magic_bytes(client):
    resp = _post_file(client, 'resume.pdf', b'PK\x03\x04notapdf', 'application/pdf')
    assert resp.status_code == 415
    assert 'content' in resp.get_json()['error'].lower()


def test_import_rejects_docx_with_wrong_magic_bytes(client):
    docx_mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    resp = _post_file(client, 'resume.docx', b'%PDF-notadocx', docx_mime)
    assert resp.status_code == 415
    assert 'content' in resp.get_json()['error'].lower()


def test_import_saves_upload_with_random_name(client, app):
    import sys
    from unittest.mock import MagicMock, patch

    fake_module = MagicMock()
    fake_module.import_pdf.return_value = {'header': {'name': 'Test'}}

    with patch.dict(sys.modules, {'app.services.pdf_import': fake_module}):
        resp = _post_file(client, 'resume.pdf', b'%PDF-test', 'application/pdf')

    assert resp.status_code == 201
    upload_dir = os.path.join(app.instance_path, 'uploads')
    files = os.listdir(upload_dir)
    assert len(files) == 1
    assert files[0].endswith('.pdf')
    assert len(files[0]) == 36  # 32 hex chars + ".pdf"
