import sys
from unittest.mock import MagicMock, patch

import pytest

from app.services.linkedin_import import (
    import_linkedin,
    _parse_date_line,
    _strip_employment_type,
    _should_skip,
    _parse_li_experience,
    _parse_li_education,
    _parse_li_skills,
    _extract_li_header,
)


# --- _parse_date_line ---

def test_parse_date_line_full():
    result = _parse_date_line("Jan 2020 - Present · 4 yrs 3 mos")
    assert result is not None
    start, end = result
    assert start == "Jan 2020"
    assert end.lower() == "present"


def test_parse_date_line_year_only():
    result = _parse_date_line("2018 - 2022")
    assert result is not None
    assert result[0] == "2018"
    assert result[1] == "2022"


def test_parse_date_line_no_end():
    result = _parse_date_line("Jun 2023")
    assert result is not None
    assert result[0] == "Jun 2023"
    assert result[1] == ""


def test_parse_date_line_with_duration():
    result = _parse_date_line("Mar 2019 - Dec 2021 · 2 yrs 9 mos")
    assert result is not None
    assert result[0] == "Mar 2019"
    assert result[1] == "Dec 2021"


def test_parse_date_line_not_a_date():
    assert _parse_date_line("Software Engineer") is None
    assert _parse_date_line("Google") is None


# --- _strip_employment_type ---

def test_strip_employment_type():
    assert _strip_employment_type("Google · Full-time") == "Google"
    assert _strip_employment_type("Acme Corp · Contract") == "Acme Corp"
    assert _strip_employment_type("Startup · Part-time") == "Startup"
    assert _strip_employment_type("Plain Company") == "Plain Company"


# --- _should_skip ---

def test_should_skip_connections():
    assert _should_skip("500 connections")
    assert _should_skip("234 endorsements")
    assert _should_skip("show all 12")
    assert _should_skip("Contact info")


def test_should_skip_duration_only():
    assert _should_skip("4 years 3 months")
    assert _should_skip("· 2 yrs")
    assert _should_skip("1 yr 6 mos")


def test_should_skip_false():
    assert not _should_skip("Software Engineer")
    assert not _should_skip("Google")
    assert not _should_skip("Jan 2020 - Present")


# --- _extract_li_header ---

def test_extract_li_header_basic():
    lines = [
        "Jane Doe",
        "Senior Software Engineer at Google",
        "San Francisco Bay Area · 500+ connections · Contact info",
        "jane@example.com",
    ]
    header, headline = _extract_li_header(lines)
    assert header["name"] == "Jane Doe"
    assert header["email"] == "jane@example.com"
    assert "San Francisco" in header["location"]
    assert headline == "Senior Software Engineer at Google"


def test_extract_li_header_with_linkedin_url():
    lines = [
        "John Smith",
        "Data Scientist",
        "linkedin.com/in/johnsmith",
    ]
    header, headline = _extract_li_header(lines)
    assert header["name"] == "John Smith"
    assert "linkedin" in header["linkedin"].lower()


# --- _parse_li_experience ---

def test_parse_li_experience_basic():
    lines = [
        "Software Engineer",
        "Google · Full-time",
        "Jan 2020 - Present · 4 yrs 3 mos",
        "Mountain View, CA",
        "• Designed and built distributed systems",
        "• Improved API performance by 40%",
    ]
    entries = _parse_li_experience(lines)
    assert len(entries) == 1
    e = entries[0]
    assert e["title"] == "Software Engineer"
    assert e["company"] == "Google"
    assert e["start_date"] == "Jan 2020"
    assert e["end_date"].lower() == "present"
    assert e["location"] == "Mountain View, CA"
    assert len(e["bullets"]) == 2


def test_parse_li_experience_multiple_entries():
    lines = [
        "Senior Engineer",
        "Meta",
        "Jun 2022 - Present · 1 yr 10 mos",
        "Software Engineer",
        "Amazon",
        "Mar 2019 - May 2022 · 3 yrs 2 mos",
        "• Built recommendation engine",
    ]
    entries = _parse_li_experience(lines)
    assert len(entries) == 2
    assert entries[0]["title"] == "Senior Engineer"
    assert entries[0]["company"] == "Meta"
    assert entries[1]["title"] == "Software Engineer"
    assert entries[1]["company"] == "Amazon"
    assert len(entries[1]["bullets"]) == 1


def test_parse_li_experience_strips_employment_type():
    lines = [
        "Data Scientist",
        "Startup Inc · Contract",
        "2021 - 2022",
    ]
    entries = _parse_li_experience(lines)
    assert entries[0]["company"] == "Startup Inc"


# --- _parse_li_education ---

def test_parse_li_education_basic():
    lines = [
        "University of California, Berkeley",
        "Bachelor of Science, Computer Science",
        "2016 - 2020",
    ]
    entries = _parse_li_education(lines)
    assert len(entries) == 1
    e = entries[0]
    assert "Berkeley" in e["school"]
    assert "Bachelor" in e["degree"] or "B.S" in e["degree"]
    assert "Computer Science" in e["field"]


def test_parse_li_education_with_gpa():
    lines = [
        "MIT",
        "M.S., Electrical Engineering",
        "2018 - 2020",
        "GPA: 3.9",
    ]
    entries = _parse_li_education(lines)
    assert len(entries) == 1
    assert entries[0]["gpa"] == "3.9"


# --- _parse_li_skills ---

def test_parse_li_skills_list():
    lines = ["Python", "JavaScript", "React", "AWS", "Docker"]
    result = _parse_li_skills(lines)
    assert len(result) == 1
    assert result[0]["category"] == "General"
    assert "Python" in result[0]["items"]
    assert "React" in result[0]["items"]


def test_parse_li_skills_empty():
    result = _parse_li_skills([])
    assert result == []


# --- import_linkedin (integration) ---

SAMPLE_LINKEDIN = """Jane Doe

Senior Software Engineer

San Francisco Bay Area · 312 connections · Contact info

About
Passionate engineer with 8 years of experience building scalable systems.

Experience

Software Engineer
Google · Full-time
Jan 2018 - Present · 6 yrs 3 mos
Mountain View, CA
• Led development of core infrastructure
• Reduced latency by 30%

Junior Developer
Acme Corp
Jun 2015 - Dec 2017 · 2 yrs 7 mos
San Jose, CA

Education

Stanford University
B.S., Computer Science
2011 - 2015

Skills

Python
Go
Kubernetes
"""


def test_import_linkedin_full_profile():
    result = import_linkedin(SAMPLE_LINKEDIN)
    assert result["header"]["name"] == "Jane Doe"
    assert result["summary"] is not None
    assert "passionate" in result["summary"].lower()
    assert len(result["experience"]) >= 1
    exp = result["experience"][0]
    assert exp["title"] == "Software Engineer"
    assert exp["company"] == "Google"
    assert exp["start_date"] == "Jan 2018"
    assert len(result["education"]) >= 1
    edu = result["education"][0]
    assert "Stanford" in edu["school"]
    assert len(result["skills"]) >= 1
    assert "Python" in result["skills"][0]["items"]


def test_import_linkedin_empty():
    result = import_linkedin("")
    assert result is not None
    assert result["experience"] == []


def test_import_linkedin_garbage_input():
    result = import_linkedin("asdfjkl;asdfjkl;")
    assert result is not None


# --- Route test ---

@pytest.fixture
def app(tmp_path):
    from app import create_app
    a = create_app()
    a.instance_path = str(tmp_path)
    a.config['TESTING'] = True
    return a


@pytest.fixture
def client(app):
    return app.test_client()


def test_route_linkedin_import_success(client):
    fake_module = MagicMock()
    fake_module.import_linkedin.return_value = {'header': {'name': 'Jane Doe'}}
    with patch.dict(sys.modules, {'app.services.linkedin_import': fake_module}):
        resp = client.post(
            '/api/import/linkedin',
            json={'text': 'Jane Doe\n\nExperience\n'},
        )
    assert resp.status_code == 201
    body = resp.get_json()
    assert 'id' in body
    assert 'parse_meta' in body


def test_route_linkedin_import_empty(client):
    resp = client.post('/api/import/linkedin', json={'text': '   '})
    assert resp.status_code == 400


def test_route_linkedin_import_no_body(client):
    resp = client.post('/api/import/linkedin', json={})
    assert resp.status_code == 400
