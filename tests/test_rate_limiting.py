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


def test_import_rate_limit(client):
    fake_module = MagicMock()
    fake_module.import_linkedin.return_value = {'header': {'name': 'Test'}}

    with patch.dict(sys.modules, {'app.services.linkedin_import': fake_module}):
        # First 5 requests should succeed
        for _ in range(5):
            resp = client.post(
                '/api/import/linkedin',
                json={'text': 'some linkedin text'},
            )
            assert resp.status_code in (201, 422)

        # 6th request should be rate-limited
        resp = client.post(
            '/api/import/linkedin',
            json={'text': 'some linkedin text'},
        )
        assert resp.status_code == 429
        assert resp.get_json()['error'] == 'Rate limit exceeded'


def test_pdf_export_rate_limit(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    fake_module = MagicMock()
    fake_module.export_pdf.return_value = b'%PDF-fake'

    with patch.dict(sys.modules, {'app.services.pdf_export': fake_module}):
        # First 10 requests should succeed
        for _ in range(10):
            resp = client.get(f'/api/resume/{resume_id}/pdf')
            assert resp.status_code == 200

        # 11th request should be rate-limited
        resp = client.get(f'/api/resume/{resume_id}/pdf')
        assert resp.status_code == 429
        assert resp.get_json()['error'] == 'Rate limit exceeded'
        assert 'Retry-After' in resp.headers


def test_save_rate_limit(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    body = {'data': {}, 'typography': {}}

    # First 30 requests should succeed
    for _ in range(30):
        resp = client.post(f'/api/resume/{resume_id}', json=body)
        assert resp.status_code == 200

    # 31st request should be rate-limited
    resp = client.post(f'/api/resume/{resume_id}', json=body)
    assert resp.status_code == 429
    assert resp.get_json()['error'] == 'Rate limit exceeded'


def test_rate_limit_response_is_json(client):
    fake_module = MagicMock()
    fake_module.import_linkedin.return_value = {'header': {'name': 'Test'}}

    with patch.dict(sys.modules, {'app.services.linkedin_import': fake_module}):
        for _ in range(5):
            client.post('/api/import/linkedin', json={'text': 'text'})

        resp = client.post('/api/import/linkedin', json={'text': 'text'})
        assert resp.status_code == 429
        assert resp.content_type == 'application/json'
