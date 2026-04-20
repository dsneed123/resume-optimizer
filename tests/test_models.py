from app.models import default_resume, default_typography, validate_resume


def test_default_resume_returns_dict():
    data = default_resume()
    assert isinstance(data, dict)


def test_default_resume_has_required_keys():
    data = default_resume()
    for key in ("header", "summary", "experience", "education", "skills",
                "certifications", "projects", "awards", "section_order"):
        assert key in data, f"missing key: {key}"


def test_default_resume_header_structure():
    header = default_resume()["header"]
    assert isinstance(header, dict)
    for field in ("name", "email", "phone", "location", "linkedin", "website"):
        assert field in header
        assert isinstance(header[field], str)


def test_default_resume_summary_is_none():
    assert default_resume()["summary"] is None


def test_default_resume_list_sections_are_lists():
    data = default_resume()
    for section in ("experience", "education", "skills", "certifications", "projects", "awards"):
        assert isinstance(data[section], list), f"{section} should be a list"


def test_default_resume_experience_entry_structure():
    exp = default_resume()["experience"][0]
    assert isinstance(exp, dict)
    for field in ("company", "title", "location", "start_date", "end_date"):
        assert field in exp
        assert isinstance(exp[field], str)
    assert isinstance(exp["bullets"], list)


def test_default_resume_education_entry_structure():
    edu = default_resume()["education"][0]
    assert isinstance(edu, dict)
    for field in ("school", "degree", "field", "graduation_date", "gpa", "honors"):
        assert field in edu
        assert isinstance(edu[field], str)


def test_default_resume_skills_entry_structure():
    skill = default_resume()["skills"][0]
    assert isinstance(skill, dict)
    assert isinstance(skill["category"], str)
    assert isinstance(skill["items"], list)


def test_default_resume_certifications_entry_structure():
    cert = default_resume()["certifications"][0]
    assert isinstance(cert, dict)
    for field in ("name", "issuer", "date"):
        assert field in cert
        assert isinstance(cert[field], str)


def test_default_resume_projects_entry_structure():
    proj = default_resume()["projects"][0]
    assert isinstance(proj, dict)
    for field in ("name", "description", "technologies", "url"):
        assert field in proj
        assert isinstance(proj[field], str)


def test_default_resume_awards_entry_structure():
    award = default_resume()["awards"][0]
    assert isinstance(award, dict)
    for field in ("name", "issuer", "date", "description"):
        assert field in award
        assert isinstance(award[field], str)


def test_default_resume_section_order_is_list_of_strings():
    section_order = default_resume()["section_order"]
    assert isinstance(section_order, list)
    assert all(isinstance(s, str) for s in section_order)
    assert len(section_order) > 0


def test_default_resume_returns_independent_copies():
    a = default_resume()
    b = default_resume()
    a["header"]["name"] = "Alice"
    assert b["header"]["name"] == ""


# --- default_typography ---

def test_default_typography_returns_dict():
    assert isinstance(default_typography(), dict)


def test_default_typography_has_all_keys():
    typ = default_typography()
    expected_keys = (
        "font_family", "font_size_name", "font_size_section_header",
        "font_size_body", "font_size_detail", "line_height",
        "paragraph_spacing", "section_spacing", "margin_top", "margin_bottom",
        "margin_left", "margin_right", "bullet_indent", "date_format",
        "header_layout", "contact_separator", "section_divider_style",
        "skills_layout", "bullet_style",
    )
    for key in expected_keys:
        assert key in typ, f"missing key: {key}"


def test_default_typography_string_fields():
    typ = default_typography()
    for field in ("font_family", "date_format", "header_layout",
                  "contact_separator", "section_divider_style",
                  "skills_layout", "bullet_style"):
        assert isinstance(typ[field], str), f"{field} should be str"


def test_default_typography_numeric_fields():
    typ = default_typography()
    for field in ("font_size_name", "font_size_section_header", "font_size_body",
                  "font_size_detail", "line_height", "paragraph_spacing",
                  "section_spacing", "margin_top", "margin_bottom",
                  "margin_left", "margin_right", "bullet_indent"):
        assert isinstance(typ[field], (int, float)), f"{field} should be numeric"


def test_default_typography_font_family_default():
    assert default_typography()["font_family"] == "Helvetica"


def test_default_typography_returns_independent_copies():
    a = default_typography()
    b = default_typography()
    a["font_family"] = "Arial"
    assert b["font_family"] == "Helvetica"


# --- validate_resume ---

def _valid_resume():
    data = default_resume()
    data["header"]["name"] = "Jane Doe"
    data["header"]["email"] = "jane@example.com"
    data["experience"][0]["company"] = "Acme"
    data["experience"][0]["title"] = "Engineer"
    data["education"][0]["school"] = "State University"
    return data


def test_validate_resume_valid_data_returns_no_errors():
    assert validate_resume(_valid_resume()) == []


def test_validate_resume_missing_header_name():
    data = _valid_resume()
    data["header"]["name"] = ""
    errors = validate_resume(data)
    assert any("header.name" in e for e in errors)


def test_validate_resume_missing_header_email():
    data = _valid_resume()
    data["header"]["email"] = ""
    errors = validate_resume(data)
    assert any("header.email" in e for e in errors)


def test_validate_resume_header_not_dict():
    data = _valid_resume()
    data["header"] = "not a dict"
    errors = validate_resume(data)
    assert any("header must be a dict" in e for e in errors)


def test_validate_resume_missing_experience_company():
    data = _valid_resume()
    data["experience"][0]["company"] = ""
    errors = validate_resume(data)
    assert any("experience[0].company" in e for e in errors)


def test_validate_resume_missing_experience_title():
    data = _valid_resume()
    data["experience"][0]["title"] = ""
    errors = validate_resume(data)
    assert any("experience[0].title" in e for e in errors)


def test_validate_resume_experience_bullets_not_list():
    data = _valid_resume()
    data["experience"][0]["bullets"] = "not a list"
    errors = validate_resume(data)
    assert any("bullets must be a list" in e for e in errors)


def test_validate_resume_experience_entry_not_dict():
    data = _valid_resume()
    data["experience"] = ["not a dict"]
    errors = validate_resume(data)
    assert any("experience[0] must be a dict" in e for e in errors)


def test_validate_resume_missing_education_school():
    data = _valid_resume()
    data["education"][0]["school"] = ""
    errors = validate_resume(data)
    assert any("education[0].school" in e for e in errors)


def test_validate_resume_education_entry_not_dict():
    data = _valid_resume()
    data["education"] = ["not a dict"]
    errors = validate_resume(data)
    assert any("education[0] must be a dict" in e for e in errors)


def test_validate_resume_skills_items_not_list():
    data = _valid_resume()
    data["skills"][0]["items"] = "not a list"
    errors = validate_resume(data)
    assert any("skills[0].items must be a list" in e for e in errors)


def test_validate_resume_skills_entry_not_dict():
    data = _valid_resume()
    data["skills"] = ["not a dict"]
    errors = validate_resume(data)
    assert any("skills[0] must be a dict" in e for e in errors)


def test_validate_resume_multiple_errors_collected():
    data = _valid_resume()
    data["header"]["name"] = ""
    data["header"]["email"] = ""
    errors = validate_resume(data)
    assert len(errors) >= 2


def test_validate_resume_no_experience_no_errors():
    data = _valid_resume()
    data["experience"] = []
    assert validate_resume(data) == []


def test_validate_resume_no_education_no_errors():
    data = _valid_resume()
    data["education"] = []
    assert validate_resume(data) == []


def test_validate_resume_returns_list():
    assert isinstance(validate_resume(_valid_resume()), list)
