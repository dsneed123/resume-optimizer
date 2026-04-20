import pytest

from app.services.job_match import (
    analyze_job_match,
    _extract_keywords,
    _keyword_in_text,
    _suggest_section,
)


def _full_resume():
    return {
        "header": {
            "name": "Jane Smith",
            "email": "jane@example.com",
            "phone": "555-123-4567",
            "location": "New York, NY",
        },
        "summary": "Experienced software engineer with 8 years in backend systems using Python and Go.",
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
                    "Built REST APIs consumed by 3 mobile applications.",
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
            {"category": "Languages", "items": ["Python", "Go", "SQL", "JavaScript", "Bash"]},
            {"category": "Tools", "items": ["Docker", "Git", "PostgreSQL"]},
        ],
        "certifications": [],
        "projects": [],
        "awards": [],
    }


# --- analyze_job_match ---

def test_empty_job_description_returns_zero():
    result = analyze_job_match(_full_resume(), "")
    assert result["match_percentage"] == 0
    assert result["matched_keywords"] == []
    assert result["missing_keywords"] == []


def test_whitespace_job_description_returns_zero():
    result = analyze_job_match(_full_resume(), "   \n  ")
    assert result["match_percentage"] == 0


def test_non_string_job_description_returns_zero():
    result = analyze_job_match(_full_resume(), None)
    assert result["match_percentage"] == 0


def test_result_has_required_keys():
    result = analyze_job_match(_full_resume(), "We need a Python developer.")
    assert "match_percentage" in result
    assert "matched_keywords" in result
    assert "missing_keywords" in result


def test_match_percentage_in_range():
    result = analyze_job_match(_full_resume(), "Python Go SQL Docker Kubernetes React Java")
    assert 0 <= result["match_percentage"] <= 100


def test_known_skill_in_resume_is_matched():
    result = analyze_job_match(_full_resume(), "Python developer needed.")
    matched_kws = [m["keyword"] for m in result["matched_keywords"]]
    assert "python" in matched_kws


def test_missing_skill_is_in_missing_list():
    result = analyze_job_match(_full_resume(), "Kubernetes experience required.")
    missing_kws = [m["keyword"] for m in result["missing_keywords"]]
    assert "kubernetes" in missing_kws


def test_matched_keyword_has_locations():
    result = analyze_job_match(_full_resume(), "Python developer with SQL skills.")
    matched = {m["keyword"]: m["locations"] for m in result["matched_keywords"]}
    assert "python" in matched
    assert isinstance(matched["python"], list)
    assert len(matched["python"]) > 0


def test_python_found_in_skills_and_summary():
    result = analyze_job_match(_full_resume(), "Python backend engineer.")
    matched = {m["keyword"]: m["locations"] for m in result["matched_keywords"]}
    assert "python" in matched
    assert "skills" in matched["python"]
    assert "summary" in matched["python"]


def test_missing_keyword_has_suggestion():
    result = analyze_job_match(_full_resume(), "Kubernetes orchestration required.")
    missing = {m["keyword"]: m["suggestion"] for m in result["missing_keywords"]}
    assert "kubernetes" in missing
    assert isinstance(missing["kubernetes"], str)
    assert len(missing["kubernetes"]) > 0


def test_perfect_jd_match_high_percentage():
    jd = "Python Go SQL Docker Git PostgreSQL microservices REST APIs"
    result = analyze_job_match(_full_resume(), jd)
    assert result["match_percentage"] > 50


def test_completely_unrelated_jd_low_percentage():
    jd = "Certified nurse practitioner with pediatric experience and HIPAA compliance."
    result = analyze_job_match(_full_resume(), jd)
    assert result["match_percentage"] < 50


def test_empty_resume_against_jd():
    result = analyze_job_match({}, "Python developer with SQL and Docker.")
    assert result["match_percentage"] == 0
    assert len(result["missing_keywords"]) > 0


def test_case_insensitive_matching():
    resume = _full_resume()
    resume["skills"][0]["items"] = ["Python", "Go"]
    result = analyze_job_match(resume, "PYTHON and GO experience required.")
    matched_kws = [m["keyword"] for m in result["matched_keywords"]]
    assert "python" in matched_kws
    assert "go" in matched_kws


def test_multi_word_phrase_detected():
    jd = "Experience with machine learning and deep learning frameworks."
    result = analyze_job_match(_full_resume(), jd)
    all_kws = [m["keyword"] for m in result["matched_keywords"]] + \
              [m["keyword"] for m in result["missing_keywords"]]
    assert "machine learning" in all_kws or "deep learning" in all_kws


def test_docker_found_in_skills():
    result = analyze_job_match(_full_resume(), "Docker containerization experience.")
    matched = {m["keyword"]: m["locations"] for m in result["matched_keywords"]}
    assert "docker" in matched
    assert "skills" in matched["docker"]


# --- _extract_keywords ---

def test_extract_keywords_removes_stop_words():
    keywords = _extract_keywords("we need a strong developer who can work with teams")
    assert "we" not in keywords
    assert "a" not in keywords
    assert "the" not in keywords


def test_extract_keywords_finds_tech_terms():
    keywords = _extract_keywords("Python Django REST API development")
    assert "python" in keywords
    assert "django" in keywords


def test_extract_keywords_empty_string():
    assert _extract_keywords("") == []


def test_extract_keywords_deduplicates():
    keywords = _extract_keywords("Python python PYTHON developer")
    assert keywords.count("python") == 1


def test_extract_keywords_multi_word_phrase():
    keywords = _extract_keywords("machine learning and data science experience")
    assert "machine learning" in keywords
    assert "data science" in keywords


def test_extract_keywords_ignores_pure_numbers():
    keywords = _extract_keywords("5 years of experience with 3 technologies")
    assert "5" not in keywords
    assert "3" not in keywords


# --- _keyword_in_text ---

def test_keyword_in_text_exact_match():
    assert _keyword_in_text("python", "I use Python daily") is True


def test_keyword_in_text_case_insensitive():
    assert _keyword_in_text("python", "PYTHON developer") is True


def test_keyword_in_text_word_boundary():
    assert _keyword_in_text("go", "Go is a language") is True
    assert _keyword_in_text("go", "Django is a framework") is False


def test_keyword_in_text_multi_word():
    assert _keyword_in_text("machine learning", "machine learning engineer") is True
    assert _keyword_in_text("machine learning", "no relevant content here") is False


def test_keyword_not_in_text():
    assert _keyword_in_text("kubernetes", "I use Docker and Python") is False


# --- _suggest_section ---

def test_suggest_section_known_skill():
    suggestion = _suggest_section("python")
    assert "Skills" in suggestion


def test_suggest_section_soft_skill():
    suggestion = _suggest_section("leadership")
    assert "Summary" in suggestion or "experience" in suggestion.lower()


def test_suggest_section_unknown_term():
    suggestion = _suggest_section("synergize")
    assert isinstance(suggestion, str)
    assert len(suggestion) > 0
