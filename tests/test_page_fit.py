import copy
from unittest import mock

import pytest

try:
    from app.services.page_fit import (
        auto_fit,
        calculate_content_height,
        fits_one_page,
        suggest_typography_adjustments,
    )
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


def _full_resume():
    data = default_resume()
    data['header']['name'] = 'Jane Doe'
    data['header']['email'] = 'jane@example.com'
    data['header']['phone'] = '555-1234'
    data['header']['location'] = 'New York, NY'
    data['summary'] = 'Experienced software engineer with 10 years in distributed systems.'
    data['experience'] = [
        {
            'company': 'Acme Corp',
            'title': 'Senior Engineer',
            'location': 'New York, NY',
            'start_date': 'Jan 2020',
            'end_date': 'Present',
            'bullets': ['Built scalable APIs', 'Led team of 5 engineers', 'Reduced latency by 40%'],
        },
        {
            'company': 'Beta LLC',
            'title': 'Software Engineer',
            'location': 'Remote',
            'start_date': 'Jun 2017',
            'end_date': 'Dec 2019',
            'bullets': ['Developed microservices', 'Improved test coverage to 90%'],
        },
    ]
    data['education'] = [{
        'school': 'State University',
        'degree': 'B.S.',
        'field': 'Computer Science',
        'graduation_date': 'May 2017',
        'gpa': '3.8',
        'honors': 'Magna Cum Laude',
    }]
    data['skills'] = [
        {'category': 'Languages', 'items': ['Python', 'Go', 'TypeScript']},
        {'category': 'Tools', 'items': ['Docker', 'Kubernetes', 'Postgres']},
    ]
    return data


def _minimal_resume():
    data = default_resume()
    data['header']['name'] = 'Jane Doe'
    data['header']['email'] = 'jane@example.com'
    data['experience'] = []
    data['education'] = []
    data['skills'] = []
    data['certifications'] = []
    data['projects'] = []
    data['awards'] = []
    return data


# --- calculate_content_height ---

def test_calculate_content_height_returns_positive_float():
    height = calculate_content_height(default_resume(), default_typography())
    assert isinstance(height, float)
    assert height > 0


def test_calculate_content_height_increases_with_content():
    h_minimal = calculate_content_height(_minimal_resume(), default_typography())
    h_full = calculate_content_height(_full_resume(), default_typography())
    assert h_full > h_minimal


def test_calculate_content_height_increases_with_font_size():
    data = _full_resume()
    typo_small = {**default_typography(), 'font_size_body': 8}
    typo_large = {**default_typography(), 'font_size_body': 14}
    assert calculate_content_height(data, typo_large) > calculate_content_height(data, typo_small)


def test_calculate_content_height_increases_with_line_height():
    data = _full_resume()
    typo_tight = {**default_typography(), 'line_height': 1.0}
    typo_loose = {**default_typography(), 'line_height': 1.5}
    assert calculate_content_height(data, typo_loose) > calculate_content_height(data, typo_tight)


def test_calculate_content_height_no_crash_empty_resume():
    data = default_resume()
    data['experience'] = []
    data['education'] = []
    data['skills'] = []
    data['certifications'] = []
    data['projects'] = []
    data['awards'] = []
    height = calculate_content_height(data, default_typography())
    assert height >= 0


# --- fits_one_page ---

@weasyprint_required
def test_fits_one_page_minimal_resume(ctx):
    assert fits_one_page(_minimal_resume(), default_typography()) is True


@weasyprint_required
def test_fits_one_page_returns_bool(ctx):
    result = fits_one_page(_full_resume(), default_typography())
    assert isinstance(result, bool)


@weasyprint_required
def test_fits_one_page_false_for_massive_content(ctx):
    data = _full_resume()
    # Stack enough experience entries to overflow
    data['experience'] = data['experience'] * 8
    assert fits_one_page(data, default_typography()) is False


def test_fits_one_page_falls_back_to_estimate_on_error():
    # When WeasyPrint raises, the fallback estimation should still return a bool
    with mock.patch('app.services.page_fit._render_page_count', side_effect=RuntimeError("no render")):
        result = fits_one_page(_minimal_resume(), default_typography())
    assert isinstance(result, bool)


# --- suggest_typography_adjustments ---

@weasyprint_required
def test_suggest_adjustments_empty_when_fits(ctx):
    result = suggest_typography_adjustments(_minimal_resume(), default_typography())
    assert result == {}


def test_suggest_adjustments_returns_smaller_values_when_overflow():
    typo = default_typography()
    with mock.patch('app.services.page_fit.fits_one_page', return_value=False):
        result = suggest_typography_adjustments(_full_resume(), typo)
    assert result['font_size_body'] < typo['font_size_body']
    assert result['font_size_detail'] < typo['font_size_detail']
    assert result['line_height'] < typo['line_height']
    assert result['section_spacing'] < typo['section_spacing']
    assert result['margin_top'] < typo['margin_top']


def test_suggest_adjustments_respects_minimums():
    # Start at or near the minimum and ensure we don't go below
    typo = {**default_typography(), 'font_size_body': 8.0, 'line_height': 1.0}
    with mock.patch('app.services.page_fit.fits_one_page', return_value=False):
        result = suggest_typography_adjustments(_full_resume(), typo)
    assert result['font_size_body'] >= 8.0
    assert result['line_height'] >= 1.0


def test_suggest_adjustments_does_not_change_font_family():
    typo = {**default_typography(), 'font_family': 'Georgia'}
    with mock.patch('app.services.page_fit.fits_one_page', return_value=False):
        result = suggest_typography_adjustments(_full_resume(), typo)
    assert result['font_family'] == 'Georgia'


# --- auto_fit ---

@weasyprint_required
def test_auto_fit_returns_dict(ctx):
    result = auto_fit(_full_resume(), default_typography())
    assert isinstance(result, dict)
    assert 'font_size_body' in result


@weasyprint_required
def test_auto_fit_result_fits_one_page(ctx):
    data = _full_resume()
    adjusted = auto_fit(data, default_typography())
    assert fits_one_page(data, adjusted) is True


@weasyprint_required
def test_auto_fit_unchanged_when_already_fits(ctx):
    typo = default_typography()
    result = auto_fit(_minimal_resume(), typo)
    assert result == typo


def test_auto_fit_never_exceeds_minimums():
    # Simulate content that never fits
    with mock.patch('app.services.page_fit.fits_one_page', return_value=False):
        result = auto_fit(_full_resume(), default_typography())
    assert result['font_size_body'] >= 8.0
    assert result['font_size_detail'] >= 7.5
    assert result['font_size_section_header'] >= 10.0
    assert result['line_height'] >= 1.0
    assert result['paragraph_spacing'] >= 2.0
    assert result['section_spacing'] >= 6.0
    assert result['margin_top'] >= 0.4
    assert result['margin_bottom'] >= 0.4
    assert result['margin_left'] >= 0.4
    assert result['margin_right'] >= 0.4


def test_auto_fit_preserves_non_adjustable_keys():
    typo = {**default_typography(), 'font_family': 'Georgia', 'font_size_name': 18}
    with mock.patch('app.services.page_fit.fits_one_page', return_value=False):
        result = auto_fit(_full_resume(), typo)
    assert result['font_family'] == 'Georgia'
    assert result['font_size_name'] == 18
