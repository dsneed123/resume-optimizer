import pytest

from app.services.ats_optimizer import (
    analyze_ats_score,
    suggest_improvements,
    _has_standard_sections,
    _has_contact_info,
    _check_name_present,
    _check_email_present,
    _check_phone_present,
    _check_date_formats,
    _check_no_numeric_dates,
    _check_summary_present,
    _check_skills_present,
    _check_experience_bullets,
    _check_section_headings,
    _check_date_consistency,
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


# --- _check_name_present ---

def test_name_present_valid():
    passed, issues = _check_name_present(_full_resume())
    assert passed
    assert issues == []


def test_name_missing_fails():
    data = _full_resume()
    data["header"]["name"] = ""
    passed, issues = _check_name_present(data)
    assert not passed
    assert any("name" in i.lower() for i in issues)


def test_name_single_word_fails():
    data = _full_resume()
    data["header"]["name"] = "Jane"
    passed, issues = _check_name_present(data)
    assert not passed
    assert any("incomplete" in i.lower() for i in issues)


def test_name_with_email_chars_fails():
    data = _full_resume()
    data["header"]["name"] = "jane@smith.com"
    passed, issues = _check_name_present(data)
    assert not passed
    assert any("malformed" in i.lower() for i in issues)


def test_name_with_digits_fails():
    data = _full_resume()
    data["header"]["name"] = "Jane Smith 123"
    passed, issues = _check_name_present(data)
    assert not passed
    assert any("malformed" in i.lower() for i in issues)


def test_name_penalizes_score():
    data = _full_resume()
    data["header"]["name"] = ""
    result = analyze_ats_score(data)
    assert result["score"] == 95  # -5 for missing name
    assert any("name" in i.lower() for i in result["issues"])


# --- _check_email_present ---

def test_email_present():
    passed, issues = _check_email_present(_full_resume())
    assert passed
    assert issues == []


def test_email_missing_fails():
    data = _full_resume()
    data["header"]["email"] = ""
    passed, issues = _check_email_present(data)
    assert not passed
    assert any("email" in i.lower() for i in issues)


def test_email_missing_penalizes_ten():
    data = _full_resume()
    data["header"]["email"] = ""
    result = analyze_ats_score(data)
    assert result["score"] == 90  # -10 for missing email
    assert any("email" in i.lower() for i in result["issues"])


# --- _check_phone_present ---

def test_phone_present():
    passed, issues = _check_phone_present(_full_resume())
    assert passed
    assert issues == []


def test_phone_missing_fails():
    data = _full_resume()
    data["header"]["phone"] = ""
    passed, issues = _check_phone_present(data)
    assert not passed
    assert any("phone" in i.lower() for i in issues)


def test_phone_missing_penalizes_five():
    data = _full_resume()
    data["header"]["phone"] = ""
    result = analyze_ats_score(data)
    assert result["score"] == 95  # -5 for missing phone
    assert any("phone" in i.lower() for i in result["issues"])


# --- contact suggestions ---

def test_suggest_improvements_missing_location():
    data = _full_resume()
    data["header"]["location"] = ""
    suggestions = suggest_improvements(data)
    assert any("location" in s.lower() for s in suggestions)


def test_suggest_improvements_has_location_no_location_suggestion():
    suggestions = suggest_improvements(_full_resume())
    assert not any("location" in s.lower() for s in suggestions)


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


# --- _check_section_headings ---

def test_section_headings_no_field_passes():
    passed, issues = _check_section_headings(_full_resume())
    assert passed
    assert issues == []


def test_section_headings_standard_passes():
    data = _full_resume()
    data["section_headings"] = {"experience": "Experience", "education": "Education"}
    passed, issues = _check_section_headings(data)
    assert passed
    assert issues == []


def test_section_headings_non_standard_flagged():
    data = _full_resume()
    data["section_headings"] = {"experience": "What I Do"}
    passed, issues = _check_section_headings(data)
    assert not passed
    assert len(issues) == 1
    assert "What I Do" in issues[0]
    assert "Experience" in issues[0]


def test_section_headings_multiple_non_standard():
    data = _full_resume()
    data["section_headings"] = {"experience": "What I Do", "skills": "My Toolkit"}
    passed, issues = _check_section_headings(data)
    assert not passed
    assert len(issues) == 2


def test_section_headings_case_insensitive_match():
    data = _full_resume()
    data["section_headings"] = {"experience": "EXPERIENCE"}
    passed, issues = _check_section_headings(data)
    assert passed


def test_section_headings_penalty_five_per_heading():
    data = _full_resume()
    data["section_headings"] = {"experience": "What I Do", "skills": "My Toolkit"}
    result = analyze_ats_score(data)
    assert result["score"] == 90  # 2 non-standard headings → -10


def test_section_headings_unknown_section_key_ignored():
    data = _full_resume()
    data["section_headings"] = {"custom_block": "Random Heading"}
    passed, issues = _check_section_headings(data)
    assert passed


def test_suggest_improvements_long_bullets():
    data = _full_resume()
    data["experience"][0]["bullets"] = ["x" * 250]
    suggestions = suggest_improvements(data)
    assert any("bullet" in s.lower() or "long" in s.lower() for s in suggestions)


# --- _check_date_consistency ---

def test_date_consistency_valid_resume_passes():
    passed, issues = _check_date_consistency(_full_resume())
    assert passed
    assert issues == []


def test_date_consistency_future_start_date_fails():
    data = _full_resume()
    data["experience"][0]["start_date"] = "January 2099"
    data["experience"][0]["end_date"] = "Present"
    passed, issues = _check_date_consistency(data)
    assert not passed
    assert any("future" in i.lower() for i in issues)


def test_date_consistency_future_end_date_fails():
    data = _full_resume()
    data["experience"][0]["start_date"] = "January 2020"
    data["experience"][0]["end_date"] = "December 2099"
    passed, issues = _check_date_consistency(data)
    assert not passed
    assert any("future" in i.lower() for i in issues)


def test_date_consistency_end_before_start_fails():
    data = _full_resume()
    data["experience"][0]["start_date"] = "January 2020"
    data["experience"][0]["end_date"] = "June 2019"
    passed, issues = _check_date_consistency(data)
    assert not passed
    assert any("before start" in i.lower() for i in issues)


def test_date_consistency_overlapping_experiences_fails():
    data = _full_resume()
    data["experience"] = [
        {
            "company": "Acme Corp",
            "title": "Engineer",
            "location": "",
            "start_date": "January 2018",
            "end_date": "June 2021",
            "bullets": ["Did stuff."],
        },
        {
            "company": "Beta Inc",
            "title": "Engineer",
            "location": "",
            "start_date": "March 2020",
            "end_date": "December 2022",
            "bullets": ["Did more stuff."],
        },
    ]
    passed, issues = _check_date_consistency(data)
    assert not passed
    assert any("overlap" in i.lower() for i in issues)


def test_date_consistency_gap_over_six_months_fails():
    data = _full_resume()
    data["experience"] = [
        {
            "company": "Acme Corp",
            "title": "Engineer",
            "location": "",
            "start_date": "January 2018",
            "end_date": "January 2019",
            "bullets": ["Did stuff."],
        },
        {
            "company": "Beta Inc",
            "title": "Engineer",
            "location": "",
            "start_date": "October 2019",
            "end_date": "December 2022",
            "bullets": ["Did more stuff."],
        },
    ]
    passed, issues = _check_date_consistency(data)
    assert not passed
    assert any("gap" in i.lower() for i in issues)


def test_date_consistency_gap_under_six_months_passes():
    data = _full_resume()
    data["experience"] = [
        {
            "company": "Acme Corp",
            "title": "Engineer",
            "location": "",
            "start_date": "January 2018",
            "end_date": "January 2019",
            "bullets": ["Did stuff."],
        },
        {
            "company": "Beta Inc",
            "title": "Engineer",
            "location": "",
            "start_date": "April 2019",
            "end_date": "December 2022",
            "bullets": ["Did more stuff."],
        },
    ]
    passed, issues = _check_date_consistency(data)
    assert passed
    assert issues == []


def test_date_consistency_future_graduation_without_expected_fails():
    data = _full_resume()
    data["education"][0]["graduation_date"] = "May 2099"
    passed, issues = _check_date_consistency(data)
    assert not passed
    assert any("future" in i.lower() or "expected" in i.lower() for i in issues)


def test_date_consistency_future_graduation_with_expected_passes():
    data = _full_resume()
    data["education"][0]["graduation_date"] = "Expected May 2099"
    passed, issues = _check_date_consistency(data)
    assert passed
    assert issues == []


def test_date_consistency_present_end_date_not_future():
    data = _full_resume()
    data["experience"][0]["end_date"] = "Present"
    passed, issues = _check_date_consistency(data)
    assert passed
    assert issues == []


def test_date_consistency_penalty_three_per_issue():
    data = _full_resume()
    # Two issues: future start date + future end date on same entry
    data["experience"] = [
        {
            "company": "Future Corp",
            "title": "Engineer",
            "location": "",
            "start_date": "January 2090",
            "end_date": "December 2095",
            "bullets": ["Future work."],
        }
    ]
    result = analyze_ats_score(data)
    # Two date consistency issues (-6) + missing bullets check passes (has bullets)
    base = analyze_ats_score(_full_resume())["score"]
    assert result["score"] == base - 6


def test_date_consistency_no_dates_passes():
    data = _full_resume()
    data["experience"][0]["start_date"] = ""
    data["experience"][0]["end_date"] = ""
    passed, issues = _check_date_consistency(data)
    assert passed
