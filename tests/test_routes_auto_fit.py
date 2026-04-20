from unittest.mock import patch

import pytest

from app import create_app
from app.models import default_typography
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


def test_auto_fit_not_found(client):
    resp = client.post('/api/resume/nonexistent/auto-fit')
    assert resp.status_code == 404
    assert resp.get_json()['error'] == 'Resume not found'


def test_auto_fit_returns_expected_keys(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    adjusted_typo = dict(default_typography(), font_size_body=9.0)

    with patch('app.services.page_fit.auto_fit', return_value=adjusted_typo), \
         patch('app.services.page_fit._render_page_count', return_value=1):
        resp = client.post(f'/api/resume/{resume_id}/auto-fit')

    assert resp.status_code == 200
    body = resp.get_json()
    assert 'typography' in body
    assert 'fits' in body
    assert 'page_count' in body


def test_auto_fit_fits_true_when_one_page(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    adjusted_typo = default_typography()

    with patch('app.services.page_fit.auto_fit', return_value=adjusted_typo), \
         patch('app.services.page_fit._render_page_count', return_value=1):
        resp = client.post(f'/api/resume/{resume_id}/auto-fit')

    body = resp.get_json()
    assert body['fits'] is True
    assert body['page_count'] == 1


def test_auto_fit_fits_false_when_overflows(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    adjusted_typo = default_typography()

    with patch('app.services.page_fit.auto_fit', return_value=adjusted_typo), \
         patch('app.services.page_fit._render_page_count', return_value=2):
        resp = client.post(f'/api/resume/{resume_id}/auto-fit')

    body = resp.get_json()
    assert body['fits'] is False
    assert body['page_count'] == 2


def test_auto_fit_saves_adjusted_typography(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    adjusted_typo = dict(default_typography(), font_size_body=8.5)

    with patch('app.services.page_fit.auto_fit', return_value=adjusted_typo), \
         patch('app.services.page_fit._render_page_count', return_value=1):
        client.post(f'/api/resume/{resume_id}/auto-fit')

    with app.app_context():
        _, saved_typo = storage.load_resume(resume_id)

    assert saved_typo['font_size_body'] == 8.5


def test_auto_fit_fallback_when_render_fails(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    adjusted_typo = default_typography()

    with patch('app.services.page_fit.auto_fit', return_value=adjusted_typo), \
         patch('app.services.page_fit._render_page_count', side_effect=Exception('weasyprint error')), \
         patch('app.services.page_fit.fits_one_page', return_value=True):
        resp = client.post(f'/api/resume/{resume_id}/auto-fit')

    body = resp.get_json()
    assert body['fits'] is True
    assert body['page_count'] == 1
