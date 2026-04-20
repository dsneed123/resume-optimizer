import pytest

from app.services.ats_optimizer import analyze_ats_score, suggest_improvements


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


def test_analyze_ats_score_returns_score_in_range():
    result = analyze_ats_score(_full_resume())
    assert "score" in result
    assert 0 <= result["score"] <= 100


def test_analyze_ats_score_returns_issues_list():
    result = analyze_ats_score({})
    assert "issues" in result
    assert isinstance(result["issues"], list)
    assert 0 <= result["score"] <= 100


def test_perfect_resume_gets_high_score():
    result = analyze_ats_score(_full_resume())
    assert result["score"] >= 90, f"Expected high score, got {result['score']}"


def test_missing_email_lowers_score():
    baseline = analyze_ats_score(_full_resume())["score"]
    data = _full_resume()
    data["header"]["email"] = ""
    result = analyze_ats_score(data)
    assert result["score"] < baseline
    assert any("email" in issue.lower() for issue in result["issues"])


def test_non_standard_headings_are_flagged():
    data = _full_resume()
    data["section_headings"] = {"experience": "Job History", "skills": "What I Know"}
    result = analyze_ats_score(data)
    assert any("non-standard" in issue.lower() for issue in result["issues"])
    assert any("Job History" in issue for issue in result["issues"])


def test_suggestions_are_actionable():
    data = _full_resume()
    data["header"]["email"] = ""
    data["header"]["location"] = ""
    data["header"]["linkedin"] = ""
    suggestions = suggest_improvements(data)
    assert isinstance(suggestions, list)
    assert len(suggestions) > 0
    for suggestion in suggestions:
        assert isinstance(suggestion, str)
        assert len(suggestion) > 10, f"Suggestion too short to be actionable: '{suggestion}'"
