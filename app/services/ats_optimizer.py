import re
from datetime import date
from typing import Optional

_STANDARD_SECTIONS = {'experience', 'education', 'skills'}

_ACTION_VERBS = frozenset({
    'accelerated', 'achieved', 'administered', 'advanced', 'analyzed',
    'architected', 'automated', 'built', 'championed', 'collaborated',
    'communicated', 'completed', 'conducted', 'configured', 'consolidated',
    'contributed', 'coordinated', 'created', 'cut', 'debugged', 'defined',
    'delivered', 'deployed', 'designed', 'developed', 'directed', 'drove',
    'engineered', 'established', 'evaluated', 'executed', 'expanded',
    'facilitated', 'generated', 'guided', 'identified', 'implemented',
    'improved', 'increased', 'initiated', 'integrated', 'launched', 'led',
    'maintained', 'managed', 'mentored', 'migrated', 'modernized', 'monitored',
    'negotiated', 'optimized', 'orchestrated', 'owned', 'partnered', 'performed',
    'planned', 'produced', 'provided', 'reduced', 'refactored', 'researched',
    'resolved', 'reviewed', 'scaled', 'shipped', 'simplified', 'solved',
    'spearheaded', 'streamlined', 'supported', 'tested', 'trained',
    'transformed', 'updated', 'wrote',
})

_HAS_METRIC_RE = re.compile(r'\d')

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

_PAGE_HEIGHT_PT = 792.0  # US Letter
_USABLE_HEIGHT_PT = _PAGE_HEIGHT_PT - 72.0  # 0.5-inch top + bottom margins
_AVAILABLE_WIDTH_PT = 612.0 - 86.4  # 0.6-inch left + right margins

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


def _check_bullet_quality(resume_data: dict) -> tuple[bool, list[str]]:
    """Flag weak bullets: no action verb, too short/long, or lacking measurable results."""
    issues = []
    for i, exp in enumerate(resume_data.get("experience", [])):
        if not isinstance(exp, dict):
            continue
        company = exp.get("company") or f"entry {i}"
        bullets = exp.get("bullets", [])
        if not isinstance(bullets, list):
            continue
        for bullet in bullets:
            if not isinstance(bullet, str):
                continue
            text = bullet.strip()
            if not text:
                continue
            words = text.split()
            if len(words) < 5:
                issues.append(
                    f"Bullet at '{company}' is too short ({len(words)} words). "
                    "Expand with specific accomplishments and context."
                )
                continue
            if len(words) > 25:
                issues.append(
                    f"Bullet at '{company}' is too long ({len(words)} words). "
                    "Consider splitting into two focused statements."
                )
            first_word = re.sub(r'[^a-zA-Z]', '', words[0]).lower()
            if first_word not in _ACTION_VERBS:
                issues.append(
                    f"Bullet at '{company}' does not start with an action verb "
                    f"(starts with '{words[0]}'). "
                    "Begin with a strong verb (e.g., 'Led', 'Built', 'Reduced')."
                )
            if not _HAS_METRIC_RE.search(text):
                issues.append(
                    f"Bullet at '{company}' lacks quantifiable results. "
                    "Add numbers or percentages to show impact (e.g., 'reduced latency by 40%')."
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


def _check_skills_analysis(resume_data: dict) -> tuple[bool, list[str]]:
    """Flag too few skills or > 10 uncategorized skills."""
    skills = resume_data.get("skills", [])
    if not isinstance(skills, list):
        return True, []

    all_items: list[str] = []
    named_categories: list[str] = []
    for s in skills:
        if not isinstance(s, dict):
            continue
        items = s.get("items", [])
        if items:
            all_items.extend(items)
            cat = (s.get("category") or "").strip()
            if cat:
                named_categories.append(cat)

    if not all_items:
        return True, []

    issues = []
    if len(all_items) < 5:
        issues.append(
            f"Only {len(all_items)} skill(s) listed. "
            "Include at least 5 skills to improve ATS keyword matching."
        )

    if len(all_items) > 10 and len(named_categories) <= 1:
        issues.append(
            f"{len(all_items)} skills are listed without categories. "
            "Organize skills into named categories (e.g., 'Languages', 'Frameworks') "
            "to improve readability and ATS parsing."
        )

    return len(issues) == 0, issues


def _estimate_content_height(resume_data: dict) -> float:
    """Estimate resume content height in points using default typography."""
    body_sz, detail_sz, sec_sz, name_sz = 10.0, 9.0, 12.0, 20.0
    line_h, para_sp, sec_sp, bullet_indent = 1.15, 4.0, 10.0, 12.0

    def _lines(text: str, indent: float = 0.0) -> int:
        if not text:
            return 0
        cpl = max(1, (_AVAILABLE_WIDTH_PT - indent) / (body_sz * 0.55))
        raw = len(text) / cpl
        return max(1, int(raw) + (1 if raw % 1 > 0 else 0))

    h = 0.0
    header = resume_data.get("header") or {}
    h += name_sz * line_h
    contact = " | ".join(
        p for p in [
            header.get("email", ""), header.get("phone", ""), header.get("location", ""),
            header.get("linkedin", ""), header.get("website", ""),
        ] if p
    )
    h += _lines(contact) * body_sz * line_h + sec_sp

    summary = resume_data.get("summary")
    if summary:
        h += sec_sz * line_h + 2 + _lines(str(summary)) * body_sz * line_h + para_sp + sec_sp

    experience = resume_data.get("experience") or []
    if experience:
        h += sec_sz * line_h + 4
        for exp in experience:
            if not isinstance(exp, dict):
                continue
            h += body_sz * line_h + detail_sz * line_h
            for bullet in (exp.get("bullets") or []):
                h += _lines(str(bullet), bullet_indent) * body_sz * line_h
            h += para_sp
        h += sec_sp

    education = resume_data.get("education") or []
    if education:
        h += sec_sz * line_h + 4
        for edu in education:
            if not isinstance(edu, dict):
                continue
            h += body_sz * line_h + detail_sz * line_h
            if edu.get("honors") or edu.get("gpa"):
                h += detail_sz * line_h
            h += para_sp
        h += sec_sp

    skills = resume_data.get("skills") or []
    if skills:
        h += sec_sz * line_h + 4
        for skill in skills:
            if not isinstance(skill, dict):
                continue
            text = (skill.get("category") or "") + ": " + ", ".join(skill.get("items") or [])
            h += _lines(text) * body_sz * line_h + para_sp
        h += sec_sp

    certifications = resume_data.get("certifications") or []
    if certifications:
        h += sec_sz * line_h + 4
        for _ in certifications:
            h += body_sz * line_h + detail_sz * line_h + para_sp
        h += sec_sp

    projects = resume_data.get("projects") or []
    if projects:
        h += sec_sz * line_h + 4
        for proj in projects:
            if not isinstance(proj, dict):
                continue
            h += body_sz * line_h
            if proj.get("description"):
                h += _lines(proj["description"]) * body_sz * line_h
            if proj.get("technologies"):
                h += detail_sz * line_h
            h += para_sp
        h += sec_sp

    awards = resume_data.get("awards") or []
    if awards:
        h += sec_sz * line_h + 4
        for award in awards:
            if not isinstance(award, dict):
                continue
            h += body_sz * line_h
            if award.get("description"):
                h += _lines(award["description"]) * body_sz * line_h
            h += para_sp
        h += sec_sp

    return h


def _check_resume_length_density(resume_data: dict) -> tuple[bool, list[str]]:
    """Flag resumes that are too sparse (< 30% page fill) or overflow one page."""
    fill_ratio = _estimate_content_height(resume_data) / _USABLE_HEIGHT_PT
    issues = []
    if fill_ratio < 0.30:
        issues.append(
            f"Resume content fills only {int(fill_ratio * 100)}% of the page. "
            "Add more experience details, projects, or skills to make better use of the space."
        )
    elif fill_ratio > 1.0:
        issues.append(
            "Resume content exceeds one page. "
            "Trim bullets or reduce experience entries to fit within a single page."
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
    (_check_resume_length_density, 10),
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

    # -2 per weak bullet
    passed, bullet_quality_issues = _check_bullet_quality(resume_data)
    if not passed:
        all_issues.extend(bullet_quality_issues)
        penalty += 2 * len(bullet_quality_issues)

    # -5 per skills analysis issue (too few skills, or > 10 uncategorized)
    passed, skills_analysis_issues = _check_skills_analysis(resume_data)
    if not passed:
        all_issues.extend(skills_analysis_issues)
        penalty += 5 * len(skills_analysis_issues)

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

    for exp in resume_data.get("experience") or []:
        if not isinstance(exp, dict):
            continue
        company = exp.get("company") or "a role"
        bullets = [b for b in (exp.get("bullets") or []) if isinstance(b, str) and b.strip()]
        n = len(bullets)
        if n < 3:
            suggestions.append(
                f"Experience at '{company}' has only {n} bullet(s). "
                "Aim for 3–5 bullets to fully showcase your impact."
            )
        elif n > 5:
            suggestions.append(
                f"Experience at '{company}' has {n} bullets. "
                "Reduce to 3–5 focused bullets for better readability."
            )

    if not (resume_data.get("summary") or "").strip():
        fill_ratio = _estimate_content_height(resume_data) / _USABLE_HEIGHT_PT
        if fill_ratio < 0.70:
            suggestions.append(
                "There is space on your resume to add a professional summary. "
                "A summary helps ATS systems match your profile to job descriptions."
            )

    suggestions.extend(result["issues"])
    return suggestions
