import pytest

from app.services.ats_optimizer import (
    analyze_ats_score,
    suggest_improvements,
    _has_standard_sections,
    _has_contact_info,
    _check_date_formats,
    _check_no_numeric_dates,
    _check_summary_present,
    _check_skills_present,
    _check_experience_bullets,
)


def _full_resume():
    return {
        "header": {
            "name": "Jane Smith",
            "email": "jane@example.com",
            "phone": "555-123-4567",
            "location": "New York, NY",
            "linkedin": "linkedin.com/in/janesmith",
            "website": "",
        },
        "summary": "Experienced software engineer with 8 years in backend systems.",
        "experience": [
            {
                "company": "Acme Corp",
                "title": "Senior Engineer",
                "location": "New York, NY",
                "start_date": "January 2020",
                "end_date": "Present",
                "bullets": [
                    "Led migration of monolith to microservices, reducing latency by 40%.",
                    "Mentored team of 5 engineers across two product squads.",
                ],
            }
        ],
        "education": [
            {
                "school": "State University",
                "degree": "B.S.",
                "field": "Computer Science",
                "graduation_date": "May 2015",
                "gpa": "",
                "honors": "",
            }
        ],
        "skills": [
            {"category": "Languages", "items": ["Python", "Go", "SQL", "JavaScript", "Bash"]}
        ],
        "certifications": [],
        "projects": [],
        "awards": [],
    }


# --- analyze_ats_score ---

def test_perfect_resume_scores_100():
    result = analyze_ats_score(_full_resume())
    assert result["score"] == 100
    assert result["issues"] == []


def test_score_is_between_0_and_100():
    result = analyze_ats_score({})
    assert 0 <= result["score"] <= 100


def test_empty_resume_has_issues():
    result = analyze_ats_score({})
    assert result["score"] < 100
    assert len(result["issues"]) > 0


def test_missing_experience_section_penalizes():
    data = _full_resume()
    data["experience"] = []
    result = analyze_ats_score(data)
    assert result["score"] < 100
    assert any("experience" in i.lower() for i in result["issues"])


def test_missing_email_penalizes():
    data = _full_resume()
    data["header"]["email"] = ""
    result = analyze_ats_score(data)
    assert result["score"] < 100
    assert any("email" in i.lower() for i in result["issues"])


def test_bad_date_format_penalizes():
    data = _full_resume()
    data["experience"][0]["start_date"] = "01/2020"
    result = analyze_ats_score(data)
    assert result["score"] < 100


def test_numeric_date_format_penalizes():
    data = _full_resume()
    data["experience"][0]["start_date"] = "01/2020"
    result = analyze_ats_score(data)
    assert result["score"] < 100


def test_missing_summary_penalizes():
    data = _full_resume()
    data["summary"] = None
    result = analyze_ats_score(data)
    assert result["score"] < 100
    assert any("summary" in i.lower() or "objective" in i.lower() for i in result["issues"])


def test_empty_skills_penalizes():
    data = _full_resume()
    data["skills"] = [{"category": "Languages", "items": []}]
    result = analyze_ats_score(data)
    assert result["score"] < 100


def test_no_bullets_penalizes():
    data = _full_resume()
    data["experience"][0]["bullets"] = []
    result = analyze_ats_score(data)
    assert result["score"] < 100
    assert any("bullet" in i.lower() for i in result["issues"])


# --- _has_standard_sections ---

def test_standard_sections_all_present():
    passed, issues = _has_standard_sections(_full_resume())
    assert passed
    assert issues == []


def test_standard_sections_missing_skills():
    data = _full_resume()
    data["skills"] = []
    passed, issues = _has_standard_sections(data)
    assert not passed
    assert any("skills" in i.lower() for i in issues)


# --- _has_contact_info ---

def test_contact_info_full():
    passed, issues = _has_contact_info(_full_resume())
    assert passed


def test_contact_info_missing_phone():
    data = _full_resume()
    data["header"]["phone"] = ""
    passed, issues = _has_contact_info(data)
    assert not passed
    assert any("phone" in i.lower() for i in issues)


def test_contact_info_not_dict():
    passed, issues = _has_contact_info({"header": "invalid"})
    assert not passed


# --- _check_date_formats ---

def test_date_format_month_year_ok():
    data = _full_resume()
    passed, issues = _check_date_formats(data)
    assert passed


def test_date_format_numeric_fails():
    data = _full_resume()
    data["experience"][0]["start_date"] = "01/2020"
    passed, issues = _check_date_formats(data)
    assert not passed


def test_date_format_present_ignored():
    data = _full_resume()
    data["experience"][0]["end_date"] = "Present"
    passed, issues = _check_date_formats(data)
    assert passed


# --- _check_no_numeric_dates ---

def test_no_numeric_dates_passes():
    passed, issues = _check_no_numeric_dates(_full_resume())
    assert passed


def test_numeric_date_detected():
    data = _full_resume()
    data["experience"][0]["start_date"] = "2020-01"
    passed, issues = _check_no_numeric_dates(data)
    assert not passed


# --- _check_summary_present ---

def test_summary_present():
    passed, issues = _check_summary_present(_full_resume())
    assert passed


def test_summary_none_fails():
    passed, issues = _check_summary_present({"summary": None})
    assert not passed


def test_summary_empty_string_fails():
    passed, issues = _check_summary_present({"summary": "   "})
    assert not passed


# --- _check_skills_present ---

def test_skills_present():
    passed, issues = _check_skills_present(_full_resume())
    assert passed


def test_skills_empty_items_fails():
    data = _full_resume()
    data["skills"] = [{"category": "Tech", "items": []}]
    passed, issues = _check_skills_present(data)
    assert not passed


# --- _check_experience_bullets ---

def test_experience_bullets_present():
    passed, issues = _check_experience_bullets(_full_resume())
    assert passed


def test_experience_no_bullets_fails():
    data = _full_resume()
    data["experience"][0]["bullets"] = []
    passed, issues = _check_experience_bullets(data)
    assert not passed
    assert any("bullet" in i.lower() for i in issues)


# --- suggest_improvements ---

def test_suggest_improvements_perfect_resume():
    suggestions = suggest_improvements(_full_resume())
    assert isinstance(suggestions, list)


def test_suggest_improvements_missing_linkedin():
    data = _full_resume()
    data["header"]["linkedin"] = ""
    suggestions = suggest_improvements(data)
    assert any("linkedin" in s.lower() for s in suggestions)


def test_suggest_improvements_few_skills():
    data = _full_resume()
    data["skills"] = [{"category": "Tech", "items": ["Python"]}]
    suggestions = suggest_improvements(data)
    assert any("skills" in s.lower() or "5" in s for s in suggestions)


def test_suggest_improvements_short_summary():
    data = _full_resume()
    data["summary"] = "Engineer."
    suggestions = suggest_improvements(data)
    assert any("summary" in s.lower() or "20" in s for s in suggestions)


def test_suggest_improvements_long_bullets():
    data = _full_resume()
    data["experience"][0]["bullets"] = ["x" * 250]
    suggestions = suggest_improvements(data)
    assert any("bullet" in s.lower() or "long" in s.lower() for s in suggestions)
