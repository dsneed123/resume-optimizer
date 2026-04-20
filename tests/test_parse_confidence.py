from app.services.parse_confidence import compute_parse_confidence


def _make_data(**overrides):
    data = {
        "header": {"name": "Jane Doe", "email": "jane@example.com", "phone": "555-1234",
                   "location": "", "linkedin": "", "website": ""},
        "summary": "Experienced software engineer with 10+ years building scalable systems.",
        "experience": [
            {"company": "Acme Corp", "title": "Engineer", "start_date": "Jan 2020",
             "end_date": "Present", "bullets": ["Did things"]},
        ],
        "education": [
            {"school": "State U", "degree": "B.S.", "field": "CS",
             "graduation_date": "May 2015", "gpa": "", "honors": ""},
        ],
        "skills": [{"category": "Languages", "items": ["Python", "Go"]}],
        "certifications": [],
        "projects": [],
        "awards": [],
    }
    data.update(overrides)
    return data


def test_high_confidence_full_data():
    meta = compute_parse_confidence(_make_data())
    for key in ("header", "summary", "experience", "education", "skills"):
        assert meta[key]["confidence"] == "high", f"{key} should be high"


def test_header_low_confidence_missing_name_and_email():
    data = _make_data(header={"name": "", "email": "", "phone": "", "location": "", "linkedin": "", "website": ""})
    meta = compute_parse_confidence(data)
    assert meta["header"]["confidence"] == "low"
    assert any("Name" in n for n in meta["header"]["notes"])
    assert any("Email" in n for n in meta["header"]["notes"])


def test_header_high_if_name_and_email_present():
    data = _make_data(header={"name": "Jane", "email": "j@x.com", "phone": "", "location": "", "linkedin": "", "website": ""})
    meta = compute_parse_confidence(data)
    assert meta["header"]["confidence"] == "high"


def test_summary_low_confidence_when_very_short():
    data = _make_data(summary="Short")
    meta = compute_parse_confidence(data)
    assert meta["summary"]["confidence"] == "low"


def test_summary_absent_is_high():
    data = _make_data(summary=None)
    meta = compute_parse_confidence(data)
    assert meta["summary"]["confidence"] == "high"


def test_experience_low_when_mostly_empty_entries():
    data = _make_data(experience=[
        {"company": "", "title": "", "start_date": "", "end_date": "", "bullets": []},
        {"company": "", "title": "", "start_date": "", "end_date": "", "bullets": []},
    ])
    meta = compute_parse_confidence(data)
    assert meta["experience"]["confidence"] == "low"


def test_experience_notes_missing_company():
    data = _make_data(experience=[
        {"company": "", "title": "Dev", "start_date": "Jan 2020", "end_date": "", "bullets": ["x"]},
    ])
    meta = compute_parse_confidence(data)
    assert any("company" in n.lower() for n in meta["experience"]["notes"])


def test_education_low_when_no_school_or_degree():
    data = _make_data(education=[
        {"school": "", "degree": "", "field": "", "graduation_date": "May 2020", "gpa": "", "honors": ""},
    ])
    meta = compute_parse_confidence(data)
    assert meta["education"]["confidence"] == "low"


def test_skills_low_when_no_items():
    data = _make_data(skills=[{"category": "General", "items": []}])
    meta = compute_parse_confidence(data)
    assert meta["skills"]["confidence"] == "low"


def test_optional_sections_absent_is_high():
    data = _make_data(certifications=[], projects=[], awards=[])
    meta = compute_parse_confidence(data)
    assert meta["certifications"]["confidence"] == "high"
    assert meta["projects"]["confidence"] == "high"
    assert meta["awards"]["confidence"] == "high"


def test_optional_section_low_when_entry_missing_name():
    data = _make_data(certifications=[{"name": "", "issuer": "AWS", "date": "2022"}])
    meta = compute_parse_confidence(data)
    assert meta["certifications"]["confidence"] == "low"


def test_all_sections_present_in_output():
    meta = compute_parse_confidence(_make_data())
    expected = {"header", "summary", "experience", "education", "skills",
                "certifications", "projects", "awards"}
    assert expected == set(meta.keys())
