import io
import pytest

try:
    import pdfplumber
    _PDFPLUMBER_AVAILABLE = True
except ImportError:
    _PDFPLUMBER_AVAILABLE = False

from app.services.pdf_import import (
    import_pdf,
    import_text,
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
    _is_bullet,
    _words_to_lines,
    _detect_two_columns,
    _HEADER_MARKER,
    _DATE_RANGE,
    _group_words_by_line,
    _get_median_font_size,
    _line_is_bold_or_large,
    _extract_degree_and_field,
    EmptyFileError,
    CorruptedFileError,
    PasswordProtectedError,
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


def test_classify_section_trailing_colon():
    assert _classify_section("Experience:") == "experience"
    assert _classify_section("Education:") == "education"
    assert _classify_section("Skills:") == "skills"
    assert _classify_section("SUMMARY:") == "summary"


def test_classify_section_professional_experience():
    assert _classify_section("PROFESSIONAL EXPERIENCE") == "experience"
    assert _classify_section("Professional Experience") == "experience"
    assert _classify_section("Relevant Experience") == "experience"
    assert _classify_section("Technical Experience") == "experience"


def test_classify_section_work_history():
    assert _classify_section("Work History") == "experience"
    assert _classify_section("WORK HISTORY") == "experience"
    assert _classify_section("Employment History") == "experience"
    assert _classify_section("Career History") == "experience"


def test_classify_section_career_summary_and_objective():
    assert _classify_section("Career Summary") == "summary"
    assert _classify_section("Career Objective") == "summary"
    assert _classify_section("Objective") == "summary"
    assert _classify_section("Executive Summary") == "summary"
    assert _classify_section("Professional Profile") == "summary"


def test_classify_section_skills_variants():
    assert _classify_section("Core Skills") == "skills"
    assert _classify_section("Key Skills") == "skills"
    assert _classify_section("Technologies") == "skills"
    assert _classify_section("Core Competencies") == "skills"


def test_classify_section_certifications_variants():
    assert _classify_section("Certifications") == "certifications"
    assert _classify_section("Certification") == "certifications"
    assert _classify_section("Licenses & Certifications") == "certifications"
    assert _classify_section("Credentials") == "certifications"


def test_classify_section_awards_variants():
    assert _classify_section("Honors") == "awards"
    assert _classify_section("Achievements") == "awards"
    assert _classify_section("Accomplishments") == "awards"
    assert _classify_section("Awards & Honors") == "awards"


def test_classify_section_header_marker():
    assert _classify_section(f"{_HEADER_MARKER}SKILLS") == "skills"
    assert _classify_section(f"{_HEADER_MARKER}Experience") == "experience"
    assert _classify_section(f"{_HEADER_MARKER}EDUCATION") == "education"


def test_group_words_by_line_sorts_left_to_right():
    words = [
        {"text": "World", "top": 10.0, "x0": 50.0, "x1": 90.0},
        {"text": "Hello", "top": 10.0, "x0": 5.0, "x1": 45.0},
    ]
    groups = _group_words_by_line(words)
    assert len(groups) == 1
    assert [w["text"] for w in groups[0]] == ["Hello", "World"]


def test_get_median_font_size():
    chars = [{"size": 10.0}, {"size": 12.0}, {"size": 14.0}, {"size": 0}]
    assert _get_median_font_size(chars) == 12.0


def test_get_median_font_size_empty():
    assert _get_median_font_size([]) == 0.0


def test_line_is_bold_or_large_bold_font():
    chars_by_top = {
        10: [{"text": "E", "fontname": "Arial-Bold", "size": 10.0, "top": 10.0},
             {"text": "X", "fontname": "Arial-Bold", "size": 10.0, "top": 10.0}]
    }
    assert _line_is_bold_or_large(10.0, chars_by_top, median_size=10.0) is True


def test_line_is_bold_or_large_larger_font():
    chars_by_top = {
        10: [{"text": "S", "fontname": "Arial", "size": 14.0, "top": 10.0}]
    }
    assert _line_is_bold_or_large(10.0, chars_by_top, median_size=10.0) is True


def test_line_is_bold_or_large_normal_font():
    chars_by_top = {
        10: [{"text": "a", "fontname": "Arial", "size": 10.0, "top": 10.0}]
    }
    assert _line_is_bold_or_large(10.0, chars_by_top, median_size=10.0) is False


def test_line_is_bold_or_large_no_chars():
    assert _line_is_bold_or_large(10.0, {}, median_size=10.0) is False


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


def test_parse_skills_block_plain_uses_general_category():
    lines = ["Python, JavaScript, React"]
    skills = _parse_skills_block(lines)
    assert skills[0]["category"] == "General"


def test_parse_skills_block_pipe_separated():
    lines = ["Languages: Python | Go | TypeScript"]
    skills = _parse_skills_block(lines)
    assert len(skills) == 1
    assert skills[0]["category"] == "Languages"
    assert "Go" in skills[0]["items"]
    assert "TypeScript" in skills[0]["items"]


def test_parse_skills_block_bullet_points():
    lines = ["• Python", "• JavaScript", "• React"]
    skills = _parse_skills_block(lines)
    assert len(skills) == 1
    assert skills[0]["category"] == "General"
    items = skills[0]["items"]
    assert "Python" in items
    assert "JavaScript" in items
    assert "React" in items


def test_parse_skills_block_multiple_uncategorized_merged():
    lines = ["Python, Go", "React, Vue"]
    skills = _parse_skills_block(lines)
    assert len(skills) == 1
    assert skills[0]["category"] == "General"
    assert "Python" in skills[0]["items"]
    assert "React" in skills[0]["items"]


def test_parse_skills_block_tools_and_frameworks():
    lines = ["Tools: Git, Docker", "Frameworks: Django, Flask"]
    skills = _parse_skills_block(lines)
    cats = {s["category"] for s in skills}
    assert "Tools" in cats
    assert "Frameworks" in cats
    tools = next(s for s in skills if s["category"] == "Tools")
    assert "Docker" in tools["items"]


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


def test_parse_experience_block_year_only_range():
    lines = [
        "Software Engineer  |  Startup Inc  2020-2023",
        "• Shipped product features",
    ]
    entries = _parse_experience_block(lines)
    assert len(entries) == 1
    assert entries[0]["start_date"] == "2020"
    assert entries[0]["end_date"] == "2023"
    assert entries[0]["title"] == "Software Engineer"


def test_parse_experience_block_to_separator():
    lines = [
        "Engineer  |  Corp  January 2020 to March 2023",
        "• Did work",
    ]
    entries = _parse_experience_block(lines)
    assert len(entries) == 1
    assert "january" in entries[0]["start_date"].lower()
    assert "march" in entries[0]["end_date"].lower()


def test_parse_experience_block_date_on_separate_line():
    lines = [
        "Software Engineer",
        "Acme Corp",
        "Jan 2020 - Present",
        "• Built APIs",
    ]
    entries = _parse_experience_block(lines)
    assert len(entries) == 1
    assert entries[0]["title"] == "Software Engineer"
    assert entries[0]["company"] == "Acme Corp"
    assert entries[0]["start_date"].lower().startswith("jan")
    assert entries[0]["end_date"].lower() == "present"
    assert len(entries[0]["bullets"]) == 1


def test_parse_experience_block_multiple_positions_bold_header():
    lines = [
        f"{_HEADER_MARKER}Google",
        "Senior Engineer  Jan 2021 - Present",
        "• Led infrastructure work",
        "Junior Engineer  Jan 2019 - Dec 2020",
        "• Built backend services",
    ]
    entries = _parse_experience_block(lines)
    assert len(entries) == 2
    assert entries[0]["company"] == "Google"
    assert entries[0]["title"] == "Senior Engineer"
    assert entries[1]["company"] == "Google"
    assert entries[1]["title"] == "Junior Engineer"


def test_parse_experience_block_bold_marker_stripped_from_title():
    lines = [
        f"{_HEADER_MARKER}Senior Engineer  Acme Corp  Jan 2020 - Present",
        "• Built things",
    ]
    entries = _parse_experience_block(lines)
    assert len(entries) == 1
    assert "\x02" not in entries[0]["title"]
    assert entries[0]["title"] == "Senior Engineer"


def test_parse_education_block():
    lines = ["State University, B.S., Computer Science  May 2018", "GPA: 3.8"]
    entries = _parse_education_block(lines)
    assert len(entries) >= 1
    assert entries[0]["school"] == "State University"
    assert entries[0]["gpa"] == "3.8"


def test_parse_education_block_degree_and_field_combined():
    lines = ["MIT  B.S. in Computer Science  May 2021"]
    entries = _parse_education_block(lines)
    assert entries[0]["school"] == "MIT"
    assert entries[0]["degree"] == "B.S."
    assert entries[0]["field"] == "Computer Science"
    assert entries[0]["graduation_date"] == "May 2021"


def test_parse_education_block_expected_date():
    lines = ["State University  B.A. in Economics  Expected May 2025"]
    entries = _parse_education_block(lines)
    assert entries[0]["school"] == "State University"
    assert entries[0]["degree"] == "B.A."
    assert entries[0]["field"] == "Economics"
    assert entries[0]["graduation_date"] == "Expected May 2025"


def test_parse_education_block_full_degree_name():
    lines = ["Stanford University, Bachelor of Science in Computer Science, May 2020"]
    entries = _parse_education_block(lines)
    assert entries[0]["school"] == "Stanford University"
    assert "Bachelor" in entries[0]["degree"]
    assert entries[0]["field"] == "Computer Science"


def test_parse_education_block_phd():
    lines = ["MIT  PhD  Computer Science  2018-2023"]
    entries = _parse_education_block(lines)
    assert entries[0]["school"] == "MIT"
    assert entries[0]["degree"] == "PhD"
    assert entries[0]["field"] == "Computer Science"


def test_extract_degree_and_field_abbreviations():
    assert _extract_degree_and_field("B.S. in Computer Science") == ("B.S.", "Computer Science")
    assert _extract_degree_and_field("MBA") == ("MBA", "")
    assert _extract_degree_and_field("Ph.D. in Physics") == ("Ph.D.", "Physics")
    assert _extract_degree_and_field("M.S. in Data Science") == ("M.S.", "Data Science")


def test_extract_degree_and_field_no_match():
    degree, field = _extract_degree_and_field("Computer Science")
    assert degree == "Computer Science"
    assert field == ""


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
def test_import_pdf_bad_bytes_raises_corrupted():
    with pytest.raises(CorruptedFileError):
        import_pdf(b"not a pdf")


@pdfplumber_required
def test_import_pdf_empty_bytes_raises_empty():
    with pytest.raises(EmptyFileError):
        import_pdf(b"")


# --- Unit tests for _is_bullet ---

def test_is_bullet_bullet_char():
    assert _is_bullet("• Python")
    assert _is_bullet("  • indented")


def test_is_bullet_dash():
    assert _is_bullet("- item")
    assert _is_bullet("– item")
    assert _is_bullet("— item")


def test_is_bullet_asterisk_and_other_markers():
    assert _is_bullet("* item")
    assert _is_bullet("▪ item")
    assert _is_bullet("◦ item")
    assert _is_bullet("‣ item")
    assert _is_bullet("⁃ item")


def test_is_bullet_not_bullet():
    assert not _is_bullet("Plain text")
    assert not _is_bullet("2020-2023")
    assert not _is_bullet("-no space after dash")
    assert not _is_bullet("")


# --- Unit tests for _DATE_RANGE ---

def test_date_range_month_year():
    assert _DATE_RANGE.search("Jan 2020")
    assert _DATE_RANGE.search("December 2019")
    assert _DATE_RANGE.search("Feb 2022")


def test_date_range_month_year_range_to_present():
    m = _DATE_RANGE.search("Jan 2020 - Present")
    assert m is not None
    assert "Jan 2020" in m.group()
    assert "Present" in m.group()


def test_date_range_month_year_to_month_year():
    m = _DATE_RANGE.search("March 2018 to June 2021")
    assert m is not None


def test_date_range_year_only_range():
    m = _DATE_RANGE.search("2019-2022")
    assert m is not None
    assert "2019" in m.group()
    assert "2022" in m.group()


def test_date_range_year_to_present():
    m = _DATE_RANGE.search("2020 to Present")
    assert m is not None


def test_date_range_expected_prefix():
    m = _DATE_RANGE.search("Expected May 2025")
    assert m is not None


def test_date_range_no_match():
    assert _DATE_RANGE.search("John Smith") is None
    assert _DATE_RANGE.search("Software Engineer") is None
    assert _DATE_RANGE.search("") is None


# --- Unit tests for _parse_projects_block ---

def test_parse_projects_block_basic():
    lines = [
        "Resume Optimizer",
        "• Built a web app to optimize resumes using NLP",
        "• Deployed on AWS",
    ]
    projects = _parse_projects_block(lines)
    assert len(projects) == 1
    assert projects[0]["name"] == "Resume Optimizer"
    assert "NLP" in projects[0]["description"]


def test_parse_projects_block_with_tech():
    lines = [
        "My Project",
        "• A cool project",
        "Tech: Python, Flask, PostgreSQL",
    ]
    projects = _parse_projects_block(lines)
    assert len(projects) == 1
    assert "Python" in projects[0]["technologies"]


def test_parse_projects_block_multiple():
    lines = [
        "Project Alpha",
        "• Description of alpha",
        "",
        "Project Beta",
        "• Description of beta",
    ]
    projects = _parse_projects_block(lines)
    assert len(projects) == 2
    assert projects[0]["name"] == "Project Alpha"
    assert projects[1]["name"] == "Project Beta"


# --- Unit tests for import_text ---

def test_import_text_full_resume():
    text = """Jane Doe
jane@example.com
555-987-6543

SUMMARY
Experienced data engineer.

EXPERIENCE
Data Engineer  Acme Corp  Jan 2021 - Present
• Built ETL pipelines

SKILLS
Languages: Python, SQL
"""
    result = import_text(text)
    assert result["header"]["name"] == "Jane Doe"
    assert result["header"]["email"] == "jane@example.com"
    assert len(result["experience"]) >= 1
    assert len(result["skills"]) >= 1


def test_import_text_empty_returns_fallback():
    result = import_text("")
    assert isinstance(result, dict)
    assert result["experience"] == []


def test_import_text_whitespace_only_returns_fallback():
    result = import_text("   \n  ")
    assert isinstance(result, dict)
    assert result["experience"] == []


# --- Integration tests: import_pdf() with a real PDF ---

def _make_simple_pdf_bytes(lines: list[str]) -> bytes:
    """Build a minimal single-page PDF with given text lines (Type1/Helvetica)."""
    ops = []
    y = 720
    for line in lines:
        safe = (
            line.replace("\\", "\\\\")
                .replace("(", "\\(")
                .replace(")", "\\)")
                .replace("\r", "")
        )
        ops.append(f"BT /F1 10 Tf 50 {y} Td ({safe}) Tj ET")
        y -= 14
        if y < 50:
            break
    stream = ("\n".join(ops) + "\n").encode("latin-1", errors="replace")

    buf = io.BytesIO()

    def w(s):
        buf.write(s.encode() if isinstance(s, str) else s)

    offsets: dict[int, int] = {}

    w(b"%PDF-1.4\n")

    offsets[1] = buf.tell()
    w("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")

    offsets[2] = buf.tell()
    w("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")

    offsets[3] = buf.tell()
    w(
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]"
        " /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
    )

    offsets[4] = buf.tell()
    w(f"4 0 obj\n<< /Length {len(stream)} >>\nstream\n")
    w(stream)
    w("\nendstream\nendobj\n")

    offsets[5] = buf.tell()
    w("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")

    xref_pos = buf.tell()
    n = 6
    w(f"xref\n0 {n}\n")
    w("0000000000 65535 f \n")
    for i in range(1, n):
        w(f"{offsets[i]:010d} 00000 n \n")

    w(f"trailer\n<< /Size {n} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n")

    return buf.getvalue()


@pdfplumber_required
def test_import_pdf_extracts_text_from_sample_pdf():
    pdf = _make_simple_pdf_bytes(["John Smith", "john@example.com", "Software Engineer"])
    result = import_pdf(pdf)
    assert isinstance(result, dict)
    assert "header" in result
    assert "experience" in result


@pdfplumber_required
def test_import_pdf_detects_section_headers():
    pdf = _make_simple_pdf_bytes([
        "Alice Brown",
        "alice@example.com",
        "EXPERIENCE",
        "Engineer  Acme  Jan 2020 - Present",
        "EDUCATION",
        "State University  B.S.  May 2018",
        "SKILLS",
        "Python, Go",
    ])
    result = import_pdf(pdf)
    assert isinstance(result, dict)
    assert len(result["experience"]) >= 1
    assert len(result["education"]) >= 1
    assert len(result["skills"]) >= 1


@pdfplumber_required
def test_import_pdf_parses_bullet_points():
    pdf = _make_simple_pdf_bytes([
        "Bob Lee",
        "bob@example.com",
        "EXPERIENCE",
        "Engineer  WidgetCo  2021-2023",
        "- Built REST APIs",
        "- Improved test coverage",
    ])
    result = import_pdf(pdf)
    exp = result.get("experience", [])
    assert len(exp) >= 1
    all_bullets = [b for e in exp for b in e.get("bullets", [])]
    assert len(all_bullets) >= 1


@pdfplumber_required
def test_import_pdf_parses_date_ranges():
    pdf = _make_simple_pdf_bytes([
        "Carol Kim",
        "carol@example.com",
        "EXPERIENCE",
        "Senior Engineer  TechCorp  Jan 2019 - Dec 2022",
        "- Led backend team",
    ])
    result = import_pdf(pdf)
    exp = result.get("experience", [])
    assert len(exp) >= 1
    assert exp[0]["start_date"] != "" or exp[0]["end_date"] != ""


@pdfplumber_required
def test_import_pdf_invalid_bytes_raises_corrupted():
    with pytest.raises(CorruptedFileError):
        import_pdf(b"%PDF-1.4 broken content here that is not a real pdf object")


@pdfplumber_required
def test_import_pdf_empty_bytes_raises_empty_file_error():
    with pytest.raises(EmptyFileError):
        import_pdf(b"")
