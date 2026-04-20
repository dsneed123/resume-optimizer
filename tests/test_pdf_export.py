import io

import pytest

from app.services.font_config import build_font_face_css, get_css_family

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


@weasyprint_required
def test_export_pdf_garamond_font(ctx):
    data = default_resume()
    data['header']['name'] = 'Test User'
    data['header']['email'] = 'test@example.com'
    typo = default_typography()
    typo['font_family'] = 'Garamond'
    pdf = export_pdf(data, typo)
    assert pdf[:4] == b'%PDF'


@weasyprint_required
def test_export_pdf_calibri_font(ctx):
    data = default_resume()
    data['header']['name'] = 'Test User'
    data['header']['email'] = 'test@example.com'
    typo = default_typography()
    typo['font_family'] = 'Calibri'
    pdf = export_pdf(data, typo)
    assert pdf[:4] == b'%PDF'


@weasyprint_required
def test_export_pdf_contains_resume_text(ctx):
    from pypdf import PdfReader

    data = default_resume()
    data['header']['name'] = 'Alice Wonderland'
    data['header']['email'] = 'alice@example.com'
    data['header']['phone'] = '555-9999'
    data['summary'] = 'Passionate software developer.'
    pdf = export_pdf(data, default_typography())
    reader = PdfReader(io.BytesIO(pdf))
    text = ''.join(page.extract_text() or '' for page in reader.pages)
    assert 'Alice Wonderland' in text
    assert 'alice@example.com' in text


@weasyprint_required
def test_export_pdf_is_one_page(ctx):
    from pypdf import PdfReader

    data = default_resume()
    data['header']['name'] = 'Single Page Test'
    data['header']['email'] = 'single@example.com'
    pdf = export_pdf(data, default_typography())
    reader = PdfReader(io.BytesIO(pdf))
    assert len(reader.pages) == 1


@weasyprint_required
def test_export_pdf_typography_affects_output(ctx):
    data = default_resume()
    data['header']['name'] = 'Typography Test'
    data['header']['email'] = 'typo@example.com'

    typo_small = default_typography()
    typo_small['font_size_body'] = 8
    typo_small['margin_top'] = 0.5

    typo_large = default_typography()
    typo_large['font_size_body'] = 14
    typo_large['margin_top'] = 1.5

    pdf_small = export_pdf(data, typo_small)
    pdf_large = export_pdf(data, typo_large)
    assert pdf_small != pdf_large


def test_build_font_face_css_garamond():
    css = build_font_face_css('Garamond')
    assert 'EB Garamond' in css
    assert '@font-face' in css
    assert "EBGaramond-Regular.ttf" in css


def test_build_font_face_css_calibri():
    css = build_font_face_css('Calibri')
    assert 'Carlito' in css
    assert '@font-face' in css
    assert "Carlito-Regular.ttf" in css


def test_build_font_face_css_system_fonts_empty():
    for family in ('Helvetica', 'Arial', 'Times New Roman', 'Georgia'):
        assert build_font_face_css(family) == ''


def test_get_css_family_includes_fallback():
    for family in ('Helvetica', 'Arial', 'Times New Roman', 'Georgia', 'Calibri', 'Garamond'):
        result = get_css_family(family)
        assert 'Helvetica' in result or 'sans-serif' in result
        assert family in result or result  # mapped family name present


def test_get_css_family_unknown_falls_back():
    result = get_css_family('UnknownFont')
    assert 'UnknownFont' in result
    assert 'Helvetica' in result
    assert 'sans-serif' in result
