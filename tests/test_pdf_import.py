import io
import pytest

try:
    import pdfplumber
    _PDFPLUMBER_AVAILABLE = True
except ImportError:
    _PDFPLUMBER_AVAILABLE = False

from app.services.pdf_import import (
    import_pdf,
    _classify_section,
    _extract_header_fields,
    _parse_skills_block,
    _parse_experience_block,
    _parse_education_block,
    _parse_certifications_block,
    _parse_projects_block,
    _parse_resume_text,
    _fallback_resume,
    _is_header_footer_line,
    _words_to_lines,
    _detect_two_columns,
)

pdfplumber_required = pytest.mark.skipif(
    not _PDFPLUMBER_AVAILABLE,
    reason="pdfplumber not installed",
)


# --- Unit tests for parsing helpers (no PDF needed) ---

def test_classify_section_experience():
    assert _classify_section("EXPERIENCE") == "experience"
    assert _classify_section("Work Experience") == "experience"


def test_classify_section_education():
    assert _classify_section("Education") == "education"


def test_classify_section_skills():
    assert _classify_section("Skills") == "skills"
    assert _classify_section("Technical Skills") == "skills"


def test_classify_section_none():
    assert _classify_section("John Smith") is None
    assert _classify_section("") is None


def test_extract_header_fields_basic():
    lines = ["John Smith", "john@example.com", "555-123-4567", "New York, NY"]
    header = _extract_header_fields(lines)
    assert header["name"] == "John Smith"
    assert header["email"] == "john@example.com"
    assert "555" in header["phone"]


def test_extract_header_fields_linkedin():
    lines = ["Jane Doe", "jane@example.com", "linkedin.com/in/janedoe"]
    header = _extract_header_fields(lines)
    assert "linkedin" in header["linkedin"].lower()


def test_parse_skills_block_colon_format():
    lines = ["Languages: Python, Go, TypeScript", "Databases: PostgreSQL, Redis"]
    skills = _parse_skills_block(lines)
    assert len(skills) == 2
    cats = {s["category"] for s in skills}
    assert "Languages" in cats
    assert "Databases" in cats
    lang = next(s for s in skills if s["category"] == "Languages")
    assert "Python" in lang["items"]


def test_parse_skills_block_plain():
    lines = ["Python, JavaScript, React"]
    skills = _parse_skills_block(lines)
    assert len(skills) == 1
    assert "Python" in skills[0]["items"]


def test_parse_experience_block_with_dates():
    lines = [
        "Senior Engineer  |  Acme Corp  |  New York, NY  Jan 2020 - Present",
        "• Built scalable APIs",
        "• Led a team of five engineers",
    ]
    entries = _parse_experience_block(lines)
    assert len(entries) == 1
    assert entries[0]["start_date"].lower().startswith("jan")
    assert entries[0]["end_date"].lower() == "present"
    assert len(entries[0]["bullets"]) == 2


def test_parse_education_block():
    lines = ["State University, B.S., Computer Science  May 2018", "GPA: 3.8"]
    entries = _parse_education_block(lines)
    assert len(entries) >= 1
    assert entries[0]["school"] == "State University"
    assert entries[0]["gpa"] == "3.8"


def test_parse_certifications_block():
    lines = ["AWS Certified Solutions Architect, Amazon, Jan 2023"]
    certs = _parse_certifications_block(lines)
    assert len(certs) == 1
    assert "AWS" in certs[0]["name"]
    assert certs[0]["issuer"] == "Amazon"


def test_parse_resume_text_full():
    text = """John Smith
john@example.com
555-123-4567

SUMMARY
Experienced software engineer with 10 years in Python.

EXPERIENCE
Senior Engineer  Acme Corp  New York  Jan 2020 - Present
• Built APIs
• Led team

EDUCATION
State University  B.S.  Computer Science  May 2018

SKILLS
Languages: Python, Go
"""
    result = _parse_resume_text(text)
    assert result["header"]["name"] == "John Smith"
    assert result["header"]["email"] == "john@example.com"
    assert result["summary"] is not None
    assert len(result["experience"]) >= 1
    assert len(result["education"]) >= 1
    assert len(result["skills"]) >= 1


def test_fallback_resume_puts_text_in_summary():
    result = _fallback_resume("some raw text")
    assert result["summary"] == "some raw text"
    assert result["experience"] == []
    assert result["education"] == []


def test_fallback_resume_empty_text():
    result = _fallback_resume("")
    assert result["summary"] is None


def test_is_header_footer_line_page_numbers():
    assert _is_header_footer_line("1")
    assert _is_header_footer_line("  2  ")
    assert _is_header_footer_line("Page 3")
    assert _is_header_footer_line("page 1 of 4")


def test_is_header_footer_line_normal_text():
    assert not _is_header_footer_line("John Smith")
    assert not _is_header_footer_line("Senior Software Engineer")
    assert not _is_header_footer_line("")


def test_words_to_lines_sorts_left_to_right():
    words = [
        {"text": "World", "top": 10.0, "x0": 50.0, "x1": 90.0},
        {"text": "Hello", "top": 10.0, "x0": 5.0, "x1": 45.0},
    ]
    lines = _words_to_lines(words)
    assert lines == ["Hello World"]


def test_words_to_lines_groups_by_y():
    words = [
        {"text": "Line1", "top": 10.0, "x0": 5.0, "x1": 50.0},
        {"text": "Line2", "top": 25.0, "x0": 5.0, "x1": 50.0},
    ]
    lines = _words_to_lines(words)
    assert len(lines) == 2
    assert lines[0] == "Line1"
    assert lines[1] == "Line2"


def test_words_to_lines_empty():
    assert _words_to_lines([]) == []


def test_detect_two_columns_sparse_middle():
    # Words only on left (<35%) and right (>65%) — middle is empty
    words = [{"text": "a", "x0": 10.0, "x1": 50.0} for _ in range(5)] + \
            [{"text": "b", "x0": 400.0, "x1": 440.0} for _ in range(5)]
    assert _detect_two_columns(words, 500.0) is True


def test_detect_two_columns_single_column():
    # Words span the full width including the middle
    words = [{"text": str(i), "x0": float(i * 10), "x1": float(i * 10 + 8)} for i in range(50)]
    assert _detect_two_columns(words, 500.0) is False


def test_detect_two_columns_empty():
    assert _detect_two_columns([], 500.0) is False


@pdfplumber_required
def test_import_pdf_bad_bytes_returns_fallback():
    result = import_pdf(b"not a pdf")
    assert isinstance(result, dict)
    assert "header" in result
    assert "experience" in result


@pdfplumber_required
def test_import_pdf_empty_bytes_returns_fallback():
    result = import_pdf(b"")
    assert isinstance(result, dict)
    assert result["experience"] == []
