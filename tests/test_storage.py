import pytest
from app import create_app
from app.models import default_resume, default_typography
from app.services import storage


@pytest.fixture
def app(tmp_path):
    app = create_app()
    app.instance_path = str(tmp_path)
    app.config['TESTING'] = True
    return app


@pytest.fixture
def ctx(app):
    with app.app_context():
        yield


def test_create_new_resume_returns_id(ctx):
    resume_id = storage.create_new_resume()
    assert isinstance(resume_id, str) and len(resume_id) == 36


def test_create_new_resume_generates_unique_ids(ctx):
    id1 = storage.create_new_resume()
    id2 = storage.create_new_resume()
    assert id1 != id2


def test_save_and_load_roundtrip(ctx):
    data = default_resume()
    data['header']['name'] = 'Alice'
    typo = default_typography()
    typo['font_family'] = 'Georgia'

    storage.save_resume('test-id', data, typo)
    loaded_data, loaded_typo = storage.load_resume('test-id')

    assert loaded_data['header']['name'] == 'Alice'
    assert loaded_typo['font_family'] == 'Georgia'


def test_load_missing_raises(ctx):
    with pytest.raises(FileNotFoundError):
        storage.load_resume('nonexistent-id')


def test_list_resumes(ctx):
    storage.save_resume('r1', default_resume(), default_typography())
    storage.save_resume('r2', default_resume(), default_typography())
    items = storage.list_resumes()
    ids = [r['id'] for r in items]
    assert 'r1' in ids and 'r2' in ids


def test_list_resumes_includes_name_and_date(ctx):
    data = default_resume()
    data['header']['name'] = 'Bob'
    storage.save_resume('named-resume', data, default_typography())
    items = storage.list_resumes()
    match = next(r for r in items if r['id'] == 'named-resume')
    assert match['name'] == 'Bob'
    assert match['updated_at']


def test_delete_resume(ctx):
    storage.save_resume('del-me', default_resume(), default_typography())
    storage.delete_resume('del-me')
    with pytest.raises(FileNotFoundError):
        storage.load_resume('del-me')


def test_delete_missing_raises(ctx):
    with pytest.raises(FileNotFoundError):
        storage.delete_resume('ghost')
