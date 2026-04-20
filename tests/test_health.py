import pytest

from app import create_app


@pytest.fixture
def client(tmp_path):
    app = create_app()
    app.instance_path = str(tmp_path)
    app.config['TESTING'] = True
    return app.test_client()


def test_health_returns_ok(client):
    resp = client.get('/health')
    assert resp.status_code == 200
    body = resp.get_json()
    assert body['status'] == 'ok'
    assert body['version'] == '1.0.0'


def test_health_includes_disk_info(client):
    resp = client.get('/health')
    body = resp.get_json()
    disk = body['disk']
    assert 'free_bytes' in disk
    assert 'total_bytes' in disk
    assert isinstance(disk['ok'], bool)
