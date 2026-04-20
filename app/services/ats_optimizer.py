import re
from datetime import date
from typing import Optional

_STANDARD_SECTIONS = {'experience', 'education', 'skills'}

_SECTION_HEADING_RE = re.compile(
    r'^(work\s+)?experience|employment(\s+history)?|professional\s+background'
    r'|education(\s+&\s+training)?|academic\s+background'
    r'|(technical\s+)?skills?|core\s+competencies|technologies'
    r'|certifications?|licenses?\s*(&\s*certifications?)?'
    r'|projects?|personal\s+projects?|side\s+projects?'
    r'|awards?(\s+&\s+honors?)?|honors?|achievements?'
    r'|(professional\s+)?summary|objective|profile|about(\s+me)?$',
    re.IGNORECASE,
)

_STANDARD_HEADINGS: dict[str, dict] = {
    "experience": {
        "alternatives": {
            "experience", "work experience", "professional experience",
            "employment history", "professional background",
        },
        "suggested": "Experience",
    },
    "education": {
        "alternatives": {
            "education", "academic background", "education & training",
        },
        "suggested": "Education",
    },
    "skills": {
        "alternatives": {
            "skills", "technical skills", "core competencies", "technologies",
        },
        "suggested": "Skills",
    },
    "summary": {
        "alternatives": {
            "summary", "professional summary", "objective", "profile", "about", "about me",
        },
        "suggested": "Professional Summary",
    },
    "certifications": {
        "alternatives": {
            "certifications", "certification", "licenses & certifications",
            "certifications & licenses", "licenses",
        },
        "suggested": "Certifications",
    },
    "projects": {
        "alternatives": {
            "projects", "project", "personal projects", "side projects",
        },
        "suggested": "Projects",
    },
    "awards": {
        "alternatives": {
            "awards", "awards & honors", "honors", "achievements",
        },
        "suggested": "Awards & Honors",
    },
}

_MONTH_YEAR_RE = re.compile(
    r'\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}\b',
    re.IGNORECASE,
)

_NUMERIC_DATE_RE = re.compile(r'\b\d{1,2}/\d{4}\b|\b\d{4}-\d{2}\b')

_MONTH_MAP = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
}


def _parse_month_year(date_str: str) -> Optional[tuple[int, int]]:
    """Parse a 'Month Year' string into (year, month). Returns None if unparseable."""
    m = _MONTH_YEAR_RE.search(date_str)
    if not m:
        return None
    parts = m.group(0).lower().replace('.', '').split()
    month = _MONTH_MAP.get(parts[0][:3])
    if not month:
        return None
    try:
        year = int(parts[1])
    except (IndexError, ValueError):
        return None
    return year, month

_EMAIL_RE = re.compile(r'[\w.+-]+@[\w-]+\.[a-z]{2,}', re.IGNORECASE)
_PHONE_RE = re.compile(r'(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}')
_NAME_LOOKS_WRONG_RE = re.compile(r'[@\d]')


def _has_standard_sections(resume_data: dict) -> tuple[bool, list[str]]:
    issues = []
    for section in _STANDARD_SECTIONS:
        entries = resume_data.get(section, [])
        if not entries or (isinstance(entries, list) and not any(
            any(v for v in e.values() if v) for e in entries if isinstance(e, dict)
        )):
            issues.append(f"Missing standard section: {section.capitalize()}")
    return len(issues) == 0, issues


def _check_name_present(resume_data: dict) -> tuple[bool, list[str]]:
    header = resume_data.get("header", {})
    if not isinstance(header, dict):
        return False, ["Contact info missing or malformed"]
    name = (header.get("name") or "").strip()
    if not name:
        return False, ["Missing name in contact info"]
    if _NAME_LOOKS_WRONG_RE.search(name):
        return False, [f"Name '{name}' appears malformed — check that it contains only your full name"]
    if len(name.split()) < 2:
        return False, [f"Name '{name}' appears incomplete — provide first and last name"]
    return True, []


def _check_email_present(resume_data: dict) -> tuple[bool, list[str]]:
    header = resume_data.get("header", {})
    if not isinstance(header, dict):
        return False, ["Contact info missing or malformed"]
    if not header.get("email"):
        return False, ["Missing email in contact info"]
    return True, []


def _check_phone_present(resume_data: dict) -> tuple[bool, list[str]]:
    header = resume_data.get("header", {})
    if not isinstance(header, dict):
        return False, ["Contact info missing or malformed"]
    if not header.get("phone"):
        return False, ["Missing phone number in contact info"]
    return True, []


def _has_contact_info(resume_data: dict) -> tuple[bool, list[str]]:
    header = resume_data.get("header", {})
    if not isinstance(header, dict):
        return False, ["Contact info missing or malformed"]
    issues: list[str] = []
    for check_fn in (_check_name_present, _check_email_present, _check_phone_present):
        _, fn_issues = check_fn(resume_data)
        issues.extend(fn_issues)
    return len(issues) == 0, issues


def _check_date_formats(resume_data: dict) -> tuple[bool, list[str]]:
    issues = []
    all_dates = []

    for exp in resume_data.get("experience", []):
        if not isinstance(exp, dict):
            continue
        for field in ("start_date", "end_date"):
            val = exp.get(field, "").strip()
            if val and val.lower() not in ("present", "current", ""):
                all_dates.append(val)

    for edu in resume_data.get("education", []):
        if not isinstance(edu, dict):
            continue
        val = edu.get("graduation_date", "").strip()
        if val:
            all_dates.append(val)

    for cert in resume_data.get("certifications", []):
        if not isinstance(cert, dict):
            continue
        val = cert.get("date", "").strip()
        if val:
            all_dates.append(val)

    inconsistent = []
    for date_str in all_dates:
        if not _MONTH_YEAR_RE.search(date_str):
            inconsistent.append(date_str)

    if inconsistent:
        examples = ", ".join(inconsistent[:3])
        issues.append(
            f"Dates not in 'Month Year' format (e.g. 'January 2020'): {examples}"
        )

    return len(issues) == 0, issues


def _check_no_numeric_dates(resume_data: dict) -> tuple[bool, list[str]]:
    issues = []
    all_dates = []

    for exp in resume_data.get("experience", []):
        if not isinstance(exp, dict):
            continue
        for field in ("start_date", "end_date"):
            val = exp.get(field, "").strip()
            if val:
                all_dates.append(val)

    for edu in resume_data.get("education", []):
        if not isinstance(edu, dict):
            continue
        val = edu.get("graduation_date", "").strip()
        if val:
            all_dates.append(val)

    for date_str in all_dates:
        if _NUMERIC_DATE_RE.search(date_str):
            issues.append(
                f"Numeric date format detected ('{date_str}'). "
                "Use 'Month Year' format for better ATS compatibility."
            )
            break

    return len(issues) == 0, issues


def _check_summary_present(resume_data: dict) -> tuple[bool, list[str]]:
    summary = resume_data.get("summary")
    if not summary or not str(summary).strip():
        return False, ["No professional summary or objective found. "
                       "A summary helps ATS systems match keywords to your profile."]
    return True, []


def _check_skills_present(resume_data: dict) -> tuple[bool, list[str]]:
    skills = resume_data.get("skills", [])
    has_items = any(
        isinstance(s, dict) and s.get("items")
        for s in skills
    )
    if not has_items:
        return False, ["Skills section is empty. "
                       "ATS systems rely on keyword matching against skill lists."]
    return True, []


def _check_experience_bullets(resume_data: dict) -> tuple[bool, list[str]]:
    issues = []
    for i, exp in enumerate(resume_data.get("experience", [])):
        if not isinstance(exp, dict):
            continue
        company = exp.get("company") or f"entry {i}"
        bullets = exp.get("bullets", [])
        if isinstance(bullets, list) and len(bullets) == 0 and exp.get("company"):
            issues.append(
                f"Experience at '{company}' has no bullet points. "
                "ATS systems scan bullet text for keyword matches."
            )
    return len(issues) == 0, issues


def _check_date_consistency(resume_data: dict) -> tuple[bool, list[str]]:
    """Flag overlapping dates, gaps > 6 months, and future dates (except Expected graduation)."""
    issues = []
    today = date.today()
    today_ym = (today.year, today.month)

    parsed_experiences: list[tuple[tuple[int, int], Optional[tuple[int, int]], str, bool]] = []
    for exp in resume_data.get("experience", []):
        if not isinstance(exp, dict):
            continue
        company = exp.get("company") or "a position"
        start_str = (exp.get("start_date") or "").strip()
        end_str = (exp.get("end_date") or "").strip()

        start_ym = _parse_month_year(start_str) if start_str else None
        is_current = end_str.lower() in ("present", "current", "")
        end_ym: Optional[tuple[int, int]] = today_ym if is_current else (
            _parse_month_year(end_str) if end_str else None
        )

        if start_ym and start_ym > today_ym:
            issues.append(f"Start date '{start_str}' at '{company}' is in the future.")

        if not is_current and end_ym and end_ym > today_ym:
            issues.append(f"End date '{end_str}' at '{company}' is in the future.")

        if start_ym and end_ym and end_ym < start_ym:
            issues.append(
                f"End date '{end_str}' is before start date '{start_str}' at '{company}'."
            )
            continue

        if start_ym:
            parsed_experiences.append((start_ym, end_ym, company, is_current))

    parsed_experiences.sort(key=lambda x: x[0])

    for i in range(len(parsed_experiences) - 1):
        start_a, end_a, company_a, _ = parsed_experiences[i]
        start_b, _end_b, company_b, _ = parsed_experiences[i + 1]

        if end_a is None:
            continue

        if end_a > start_b:
            issues.append(
                f"Overlapping dates between '{company_a}' and '{company_b}'."
            )
        else:
            gap_months = (start_b[0] - end_a[0]) * 12 + (start_b[1] - end_a[1])
            if gap_months > 6:
                issues.append(
                    f"Gap of {gap_months} months between '{company_a}' and '{company_b}'. "
                    "Consider addressing employment gaps longer than 6 months."
                )

    for edu in resume_data.get("education", []):
        if not isinstance(edu, dict):
            continue
        grad_str = (edu.get("graduation_date") or "").strip()
        if not grad_str or "expected" in grad_str.lower():
            continue
        grad_ym = _parse_month_year(grad_str)
        if grad_ym and grad_ym > today_ym:
            school = edu.get("school") or "a school"
            issues.append(
                f"Graduation date '{grad_str}' at '{school}' is in the future. "
                "Use 'Expected Month Year' if this is an anticipated graduation."
            )

    return len(issues) == 0, issues


def _check_section_headings(resume_data: dict) -> tuple[bool, list[str]]:
    """Flag non-standard section headings; each costs -5 in the caller."""
    section_headings = resume_data.get("section_headings")
    if not section_headings or not isinstance(section_headings, dict):
        return True, []

    issues = []
    for section_key, heading in section_headings.items():
        if not isinstance(heading, str) or not heading.strip():
            continue
        std = _STANDARD_HEADINGS.get(section_key)
        if std is None:
            continue
        if heading.strip().lower() not in std["alternatives"]:
            issues.append(
                f"Non-standard section heading '{heading}' "
                f"(for {section_key}). "
                f"Consider using '{std['suggested']}' for better ATS compatibility."
            )

    return len(issues) == 0, issues


_CHECKS = [
    (_has_standard_sections, 20),
    (_check_name_present, 5),
    (_check_email_present, 10),
    (_check_phone_present, 5),
    (_check_date_formats, 15),
    (_check_no_numeric_dates, 10),
    (_check_summary_present, 15),
    (_check_skills_present, 10),
    (_check_experience_bullets, 10),
]


def analyze_ats_score(resume_data: dict) -> dict:
    """Return score 0-100 and list of issues found."""
    all_issues: list[str] = []
    penalty = 0

    for check_fn, weight in _CHECKS:
        passed, issues = check_fn(resume_data)
        if not passed:
            all_issues.extend(issues)
            penalty += weight

    # -5 per non-standard section heading
    passed, heading_issues = _check_section_headings(resume_data)
    if not passed:
        all_issues.extend(heading_issues)
        penalty += 5 * len(heading_issues)

    # -3 per date consistency issue
    passed, date_consistency_issues = _check_date_consistency(resume_data)
    if not passed:
        all_issues.extend(date_consistency_issues)
        penalty += 3 * len(date_consistency_issues)

    score = max(0, 100 - penalty)
    return {"score": score, "issues": all_issues}


def suggest_improvements(resume_data: dict) -> list[str]:
    """Return actionable suggestions based on ATS analysis."""
    result = analyze_ats_score(resume_data)
    suggestions: list[str] = []

    header = resume_data.get("header", {}) or {}
    if not header.get("location"):
        suggestions.append(
            "Add a location (city, state) to your contact info — ATS systems often filter candidates by location."
        )
    if not header.get("linkedin"):
        suggestions.append(
            "Add a LinkedIn URL to your contact info — many ATS systems extract it."
        )

    skills = resume_data.get("skills", [])
    all_skill_items: list[str] = []
    for s in skills:
        if isinstance(s, dict):
            all_skill_items.extend(s.get("items", []))
    if len(all_skill_items) < 5:
        suggestions.append(
            "Expand your skills list to at least 5 items so ATS keyword matching "
            "has more signals to work with."
        )

    for exp in resume_data.get("experience", []):
        if not isinstance(exp, dict):
            continue
        bullets = exp.get("bullets", [])
        if isinstance(bullets, list) and len(bullets) > 0:
            long_bullets = [b for b in bullets if isinstance(b, str) and len(b) > 200]
            if long_bullets:
                suggestions.append(
                    f"Break up long bullet points at '{exp.get('company', 'a role')}' "
                    "into shorter, keyword-dense statements."
                )
                break

    summary = resume_data.get("summary") or ""
    if summary and len(str(summary).split()) < 20:
        suggestions.append(
            "Expand your summary to at least 20 words to give ATS more keyword surface area."
        )

    suggestions.extend(result["issues"])
    return suggestions
