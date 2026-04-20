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


def test_page_check_not_found(client):
    resp = client.get('/api/resume/nonexistent/page-check')
    assert resp.status_code == 404
    assert resp.get_json()['error'] == 'Resume not found'


def test_page_check_returns_expected_keys(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    with patch('app.services.page_fit._render_page_count', return_value=1), \
         patch('app.services.page_fit.calculate_content_height', return_value=650.0):
        resp = client.get(f'/api/resume/{resume_id}/page-check')

    assert resp.status_code == 200
    body = resp.get_json()
    assert 'fits' in body
    assert 'page_count' in body
    assert 'content_height_pct' in body


def test_page_check_fits_true_when_one_page(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    with patch('app.services.page_fit._render_page_count', return_value=1), \
         patch('app.services.page_fit.calculate_content_height', return_value=650.0):
        resp = client.get(f'/api/resume/{resume_id}/page-check')

    body = resp.get_json()
    assert body['fits'] is True
    assert body['page_count'] == 1


def test_page_check_fits_false_when_overflows(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    with patch('app.services.page_fit._render_page_count', return_value=2), \
         patch('app.services.page_fit.calculate_content_height', return_value=800.0):
        resp = client.get(f'/api/resume/{resume_id}/page-check')

    body = resp.get_json()
    assert body['fits'] is False
    assert body['page_count'] == 2


def test_page_check_content_height_pct(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    typo = default_typography()
    available = 792.0 - typo.get('margin_top', 0.5) * 72.0 - typo.get('margin_bottom', 0.5) * 72.0
    content = available * 0.942

    with patch('app.services.page_fit._render_page_count', return_value=1), \
         patch('app.services.page_fit.calculate_content_height', return_value=content):
        resp = client.get(f'/api/resume/{resume_id}/page-check')

    body = resp.get_json()
    assert body['content_height_pct'] == pytest.approx(94.2, abs=0.1)


def test_page_check_fallback_when_render_fails(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    with patch('app.services.page_fit._render_page_count', side_effect=Exception('weasyprint error')), \
         patch('app.services.page_fit.fits_one_page', return_value=True), \
         patch('app.services.page_fit.calculate_content_height', return_value=600.0):
        resp = client.get(f'/api/resume/{resume_id}/page-check')

    body = resp.get_json()
    assert body['fits'] is True
    assert body['page_count'] == 1
