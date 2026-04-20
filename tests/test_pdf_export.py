import pytest

try:
    from app.services.pdf_export import export_pdf
    _WEASYPRINT_AVAILABLE = True
except OSError:
    _WEASYPRINT_AVAILABLE = False

from app import create_app
from app.models import default_resume, default_typography

weasyprint_required = pytest.mark.skipif(
    not _WEASYPRINT_AVAILABLE,
    reason="WeasyPrint system libraries (libgobject) not installed",
)


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


@weasyprint_required
def test_export_pdf_returns_bytes(ctx):
    data = default_resume()
    data['header']['name'] = 'Jane Doe'
    data['header']['email'] = 'jane@example.com'
    pdf = export_pdf(data, default_typography())
    assert isinstance(pdf, bytes)
    assert len(pdf) > 0


@weasyprint_required
def test_export_pdf_is_valid_pdf(ctx):
    data = default_resume()
    data['header']['name'] = 'Jane Doe'
    data['header']['email'] = 'jane@example.com'
    pdf = export_pdf(data, default_typography())
    assert pdf[:4] == b'%PDF'


@weasyprint_required
def test_export_pdf_with_full_resume(ctx):
    data = default_resume()
    data['header']['name'] = 'John Smith'
    data['header']['email'] = 'john@example.com'
    data['header']['phone'] = '555-1234'
    data['header']['location'] = 'New York, NY'
    data['summary'] = 'Experienced software engineer.'
    data['experience'] = [{
        'company': 'Acme Corp',
        'title': 'Senior Engineer',
        'location': 'New York, NY',
        'start_date': 'Jan 2020',
        'end_date': 'Present',
        'bullets': ['Built scalable APIs', 'Led team of 5'],
    }]
    data['education'] = [{
        'school': 'State University',
        'degree': 'B.S.',
        'field': 'Computer Science',
        'graduation_date': 'May 2018',
        'gpa': '3.8',
        'honors': 'Magna Cum Laude',
    }]
    data['skills'] = [{'category': 'Languages', 'items': ['Python', 'Go', 'TypeScript']}]
    pdf = export_pdf(data, default_typography())
    assert pdf[:4] == b'%PDF'


@weasyprint_required
def test_export_pdf_respects_typography(ctx):
    data = default_resume()
    data['header']['name'] = 'Test User'
    data['header']['email'] = 'test@example.com'
    typo = default_typography()
    typo['font_family'] = 'Georgia'
    typo['font_size_body'] = 11
    pdf = export_pdf(data, typo)
    assert pdf[:4] == b'%PDF'
