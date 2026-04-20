import re
from typing import Optional

_LI_SECTION_HEADERS = {
    'experience': re.compile(r'^experience$', re.IGNORECASE),
    'education': re.compile(r'^education$', re.IGNORECASE),
    'skills': re.compile(r'^(?:top\s+)?skills?$', re.IGNORECASE),
    'about': re.compile(r'^about$', re.IGNORECASE),
    'certifications': re.compile(r'^licenses?\s*(?:&\s*)?certifications?$', re.IGNORECASE),
    'projects': re.compile(r'^projects?$', re.IGNORECASE),
    'honors': re.compile(r'^honors?\s*(?:&\s*)?awards?$', re.IGNORECASE),
}

# LinkedIn date line: "Jan 2020 - Present · 4 yrs 3 mos" — groups 1=start, 2=end
_LI_DATE_LINE = re.compile(
    r'^((?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?\d{4})'
    r'(?:\s*[-–—]\s*((?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?\d{4}|present|current))?'
    r'(?:\s*[·•]\s*.+)?$',
    re.IGNORECASE,
)

# Duration-only line: "· 4 yrs 3 mos" or "3 years 2 months"
_LI_DURATION_ONLY = re.compile(
    r'^[·•]?\s*\d+\s+(?:yr|year|mo|month)s?(?:\s+\d+\s+(?:yr|year|mo|month)s?)?$',
    re.IGNORECASE,
)

# Suffix like "· Full-time" on company/title lines
_EMPLOYMENT_TYPE = re.compile(
    r'\s*[·•]\s*(?:full[.\s-]?time|part[.\s-]?time|contract|freelance|internship|'
    r'self[.\s-]?employed|volunteer|temporary|seasonal)\s*$',
    re.IGNORECASE,
)

# LinkedIn UI noise
_LI_SKIP = re.compile(
    r'^(?:\d+\s+connections?|\d+\s+endorsements?|(?:show|see)\s+(?:all\s+)?\d+'
    r'|show\s+more|contact\s+info|connect|message|follow'
    r'|endorsed\s+by|mutual\s+connections?)$',
    re.IGNORECASE,
)

_EMAIL = re.compile(r'[\w.+-]+@[\w-]+\.[a-z]{2,}', re.IGNORECASE)
_PHONE = re.compile(r'(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}')
_URL = re.compile(r'(?:https?://|www\.|linkedin\.com/in/)\S+', re.IGNORECASE)

_LI_DEGREE_RE = re.compile(
    r'^(?P<degree>'
    r'Ph\.?D\.?|J\.?D\.?|M\.?D\.?'
    r'|M\.?B\.?A\.?|M\.?P\.?H\.?|M\.?Eng?\.?|M\.?Ed?\.?'
    r'|M\.?S\.?|M\.?A\.?'
    r'|B\.?F\.?A\.?|B\.?Eng?\.?|B\.?S\.?C?\.?|B\.?A\.?'
    r'|A\.?S\.?|A\.?A\.?'
    r"|(?:Bachelor|Master|Doctor|Associate)(?:'s)?(?:\s+of\s+\w+(?:\s+(?!in\b)\w+){0,3})?"
    r')(?=[\s,]|$)'
    r"(?:[\s,]+(?:in\s+|of\s+)?(?P<field>.+))?$",
    re.IGNORECASE,
)


def _classify_section(line: str) -> Optional[str]:
    stripped = line.strip()
    for section, pattern in _LI_SECTION_HEADERS.items():
        if pattern.fullmatch(stripped):
            return section
    return None


def _parse_date_line(line: str) -> Optional[tuple[str, str]]:
    """Return (start, end) if line is a LinkedIn date range, else None."""
    m = _LI_DATE_LINE.match(line.strip())
    if not m:
        return None
    start = (m.group(1) or '').strip()
    end = (m.group(2) or '').strip()
    return start, end


def _strip_employment_type(text: str) -> str:
    return _EMPLOYMENT_TYPE.sub('', text).strip()


def _should_skip(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    return bool(_LI_SKIP.match(stripped)) or bool(_LI_DURATION_ONLY.match(stripped))


def _is_location_like(text: str) -> bool:
    """Heuristic: short line with comma or 'Remote' is probably a location."""
    if len(text.split()) > 6:
        return False
    return ',' in text or bool(re.search(r'\bremote\b', text, re.IGNORECASE))


def _extract_li_header(lines: list[str]) -> tuple[dict, str]:
    """Return (header dict, headline string)."""
    header = {"name": "", "email": "", "phone": "", "location": "", "linkedin": "", "website": ""}
    headline = ""
    name_set = False
    headline_set = False

    for line in lines:
        stripped = line.strip()
        if not stripped or _should_skip(stripped):
            continue

        email_m = _EMAIL.search(stripped)
        phone_m = _PHONE.search(stripped)
        url_m = _URL.search(stripped)

        if email_m and not header["email"]:
            header["email"] = email_m.group()
            continue
        if phone_m and not header["phone"]:
            header["phone"] = phone_m.group()
        if url_m:
            url = url_m.group()
            if "linkedin" in url.lower() and not header["linkedin"]:
                header["linkedin"] = url
            elif not header["website"]:
                header["website"] = url
            continue

        # Lines like "San Francisco Bay Area · 500+ connections · Contact info"
        if '·' in stripped:
            loc_candidate = stripped.split('·')[0].strip()
            if loc_candidate and not header["location"] and len(loc_candidate.split()) <= 5:
                header["location"] = loc_candidate
            continue

        if _parse_date_line(stripped):
            continue

        if not name_set:
            if len(stripped.split()) <= 6:
                header["name"] = stripped
                name_set = True
        elif not headline_set:
            headline = stripped
            headline_set = True

    return header, headline


def _new_exp() -> dict:
    return {"company": "", "title": "", "location": "", "start_date": "", "end_date": "", "bullets": []}


def _parse_li_experience(lines: list[str]) -> list[dict]:
    """Parse LinkedIn experience.

    LinkedIn format per entry:
        Job Title [· Employment Type]
        Company Name [· Employment Type]
        Jan 2020 - Present · 4 yrs 3 mos
        City, Country  (optional)
        Description text or bullets  (optional)
    """
    entries = []
    current: Optional[dict] = None
    filling = 'title'  # title → company → date → done

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if _should_skip(stripped):
            continue

        dates = _parse_date_line(stripped)
        is_bullet = bool(re.match(r'^\s*[•·\-–—*▪◦‣⁃]\s+', stripped))

        if is_bullet:
            if current is None:
                current = _new_exp()
                filling = 'done'
            text = re.sub(r'^\s*[•·\-–—*▪◦‣⁃]\s+', '', stripped)
            current["bullets"].append(text)

        elif dates is not None:
            start, end = dates
            if current is None:
                current = _new_exp()
            current["start_date"] = start
            current["end_date"] = end
            filling = 'done'

        elif filling in ('title', ) or current is None:
            if current is not None:
                entries.append(current)
            current = _new_exp()
            current["title"] = _strip_employment_type(stripped)
            filling = 'company'

        elif filling == 'company':
            current["company"] = _strip_employment_type(stripped)
            filling = 'date'

        elif filling == 'date':
            # Got non-date text while expecting date; could be company continuation
            if not current["company"]:
                current["company"] = _strip_employment_type(stripped)

        elif filling == 'done':
            if not current["location"] and _is_location_like(stripped):
                current["location"] = stripped
            elif current["start_date"]:
                # New entry starting
                entries.append(current)
                current = _new_exp()
                current["title"] = _strip_employment_type(stripped)
                filling = 'company'
            else:
                current["bullets"].append(stripped)

    if current is not None:
        entries.append(current)
    return entries


def _parse_li_education(lines: list[str]) -> list[dict]:
    """Parse LinkedIn education.

    LinkedIn format per entry:
        School Name
        Degree, Field of Study
        Year - Year  (or "Aug 2012 - May 2016")
        Activities and societies: ...  (optional)
    """
    entries = []
    current: Optional[dict] = None
    filling = 'school'

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if _should_skip(stripped):
            continue

        dates = _parse_date_line(stripped)

        if dates is not None:
            if current is None:
                current = {"school": "", "degree": "", "field": "", "graduation_date": "", "gpa": "", "honors": ""}
            start, end = dates
            current["graduation_date"] = f"{start} - {end}".strip(' -') if end else start
            filling = 'done'

        elif filling == 'school' or current is None:
            if current is not None:
                entries.append(current)
            current = {"school": stripped, "degree": "", "field": "", "graduation_date": "", "gpa": "", "honors": ""}
            filling = 'degree'

        elif filling == 'degree':
            # Could be "Bachelor of Science, Computer Science" or "B.S. in Computer Science"
            m = _LI_DEGREE_RE.match(stripped)
            if m:
                current["degree"] = m.group("degree").strip()
                current["field"] = (m.group("field") or "").strip()
            elif ',' in stripped:
                parts = stripped.split(',', 1)
                current["degree"] = parts[0].strip()
                current["field"] = parts[1].strip()
            else:
                current["degree"] = stripped
            filling = 'date'

        elif filling in ('date', 'done'):
            gpa_m = re.search(r'gpa[:\s]+(\d+\.\d+)', stripped, re.IGNORECASE)
            honors_m = re.search(r'(cum laude|magna cum laude|summa cum laude|honors?)', stripped, re.IGNORECASE)
            if gpa_m:
                current["gpa"] = gpa_m.group(1)
            elif honors_m:
                current["honors"] = honors_m.group(1)
            elif stripped.lower().startswith('activities'):
                pass  # skip activities line
            elif not current["field"] and filling == 'date':
                current["field"] = stripped

    if current is not None:
        entries.append(current)
    return entries


def _parse_li_skills(lines: list[str]) -> list[dict]:
    """Parse LinkedIn skills — just a flat list, group under General."""
    items = []
    for line in lines:
        stripped = line.strip()
        if not stripped or _should_skip(stripped):
            continue
        # Skip endorsement counts
        if re.match(r'^\d+$', stripped):
            continue
        if re.match(r'^\s*[•·\-–—*▪◦‣⁃]\s+', stripped):
            stripped = re.sub(r'^\s*[•·\-–—*▪◦‣⁃]\s+', '', stripped)
        if stripped:
            items.append(stripped)
    if items:
        return [{"category": "General", "items": items}]
    return []


def _parse_linkedin_profile(text: str) -> dict:
    from app.models import default_resume
    result = default_resume()
    result["experience"] = []
    result["education"] = []
    result["skills"] = []
    result["certifications"] = []
    result["projects"] = []
    result["awards"] = []
    result["summary"] = None

    lines = text.splitlines()
    sections: dict[str, list[str]] = {"_header": []}
    current_section = "_header"

    for line in lines:
        section = _classify_section(line)
        if section:
            current_section = section
            sections.setdefault(current_section, [])
        else:
            sections.setdefault(current_section, []).append(line)

    header, headline = _extract_li_header(sections.get("_header", []))
    result["header"] = header

    # LinkedIn "About" → summary
    about_lines = sections.get("about", [])
    if about_lines:
        result["summary"] = " ".join(l.strip() for l in about_lines if l.strip()) or None

    # Use headline as summary if no About section
    if not result["summary"] and headline:
        result["summary"] = headline

    if "experience" in sections:
        result["experience"] = _parse_li_experience(sections["experience"])
    if "education" in sections:
        result["education"] = _parse_li_education(sections["education"])
    if "skills" in sections:
        result["skills"] = _parse_li_skills(sections["skills"])
    if "certifications" in sections:
        from app.services.pdf_import import _parse_certifications_block
        result["certifications"] = _parse_certifications_block(sections["certifications"])
    if "projects" in sections:
        from app.services.pdf_import import _parse_projects_block
        result["projects"] = _parse_projects_block(sections["projects"])
    if "honors" in sections:
        from app.services.pdf_import import _parse_awards_block
        result["awards"] = _parse_awards_block(sections["honors"])

    return result


def _fallback_resume(text: str) -> dict:
    from app.models import default_resume
    result = default_resume()
    result["summary"] = text.strip() or None
    result["experience"] = []
    result["education"] = []
    result["skills"] = []
    result["certifications"] = []
    result["projects"] = []
    result["awards"] = []
    return result


def import_linkedin(text: str) -> dict:
    if not text or not text.strip():
        return _fallback_resume("")
    try:
        return _parse_linkedin_profile(text)
    except Exception:
        return _fallback_resume(text)
