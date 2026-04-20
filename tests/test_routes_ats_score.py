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


def test_get_ats_score_not_found(client):
    resp = client.get('/api/resume/nonexistent/ats-score')
    assert resp.status_code == 404
    assert resp.get_json()['error'] == 'Resume not found'


def test_get_ats_score_success(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    fake_module = MagicMock()
    fake_module.analyze_ats_score.return_value = {
        'score': 80,
        'issues': ['Missing phone number in contact info'],
    }
    fake_module.suggest_improvements.return_value = [
        'Add a LinkedIn URL to your contact info — many ATS systems extract it.',
        'Expand your skills list to at least 5 items so ATS keyword matching has more signals.',
    ]

    with patch.dict(__import__('sys').modules, {'app.services.ats_optimizer': fake_module}):
        resp = client.get(f'/api/resume/{resume_id}/ats-score')

    assert resp.status_code == 200
    body = resp.get_json()
    assert body['score'] == 80

    assert len(body['issues']) == 1
    issue = body['issues'][0]
    assert issue['severity'] in ('warning', 'error')
    assert issue['message'] == 'Missing phone number in contact info'
    assert 'section' in issue

    assert len(body['suggestions']) == 2
    for s in body['suggestions']:
        assert 'message' in s
        assert 'section' in s
        assert s['priority'] in ('high', 'medium')


def test_get_ats_score_issue_severity_error(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    fake_module = MagicMock()
    fake_module.analyze_ats_score.return_value = {
        'score': 60,
        'issues': ['Missing email in contact info'],
    }
    fake_module.suggest_improvements.return_value = []

    with patch.dict(__import__('sys').modules, {'app.services.ats_optimizer': fake_module}):
        resp = client.get(f'/api/resume/{resume_id}/ats-score')

    body = resp.get_json()
    assert body['issues'][0]['severity'] == 'error'
    assert body['issues'][0]['section'] == 'contact'


def test_get_ats_score_suggestion_priority_high_for_first_two(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    fake_module = MagicMock()
    fake_module.analyze_ats_score.return_value = {'score': 100, 'issues': []}
    fake_module.suggest_improvements.return_value = ['First suggestion.', 'Second suggestion.', 'Third suggestion.']

    with patch.dict(__import__('sys').modules, {'app.services.ats_optimizer': fake_module}):
        resp = client.get(f'/api/resume/{resume_id}/ats-score')

    suggestions = resp.get_json()['suggestions']
    assert suggestions[0]['priority'] == 'high'
    assert suggestions[1]['priority'] == 'high'
    assert suggestions[2]['priority'] == 'medium'


def test_get_ats_score_empty_issues_and_suggestions(client, app):
    with app.app_context():
        resume_id = storage.create_new_resume()

    fake_module = MagicMock()
    fake_module.analyze_ats_score.return_value = {'score': 100, 'issues': []}
    fake_module.suggest_improvements.return_value = []

    with patch.dict(__import__('sys').modules, {'app.services.ats_optimizer': fake_module}):
        resp = client.get(f'/api/resume/{resume_id}/ats-score')

    body = resp.get_json()
    assert body['score'] == 100
    assert body['issues'] == []
    assert body['suggestions'] == []
