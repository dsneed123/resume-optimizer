import re
from typing import Optional

from docx import Document
from docx.oxml.ns import qn

_SECTION_HEADERS = {
    'experience': re.compile(
        r'^(work\s+)?experience|employment(\s+history)?|professional\s+background$',
        re.IGNORECASE,
    ),
    'education': re.compile(r'^education(\s+&\s+training)?|academic\s+background$', re.IGNORECASE),
    'skills': re.compile(r'^(technical\s+)?skills?|core\s+competencies|technologies$', re.IGNORECASE),
    'certifications': re.compile(r'^certifications?|licenses?\s*(&\s*certifications?)?$', re.IGNORECASE),
    'projects': re.compile(r'^projects?|personal\s+projects?|side\s+projects?$', re.IGNORECASE),
    'awards': re.compile(r'^awards?(\s+&\s+honors?)?|honors?|achievements?$', re.IGNORECASE),
    'summary': re.compile(r'^(professional\s+)?summary|objective|profile|about(\s+me)?$', re.IGNORECASE),
}

_DATE_RANGE = re.compile(
    r'(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}'
    r'(?:\s*[-–—]\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|present|current))?',
    re.IGNORECASE,
)

_EMAIL = re.compile(r'[\w.+-]+@[\w-]+\.[a-z]{2,}', re.IGNORECASE)
_PHONE = re.compile(r'(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}')
_URL = re.compile(r'(?:https?://|www\.|linkedin\.com/in/)\S+', re.IGNORECASE)

_HEADING_STYLES = re.compile(r'^heading\s*\d?$', re.IGNORECASE)
_LIST_STYLES = re.compile(r'list\s*(paragraph|bullet|number|continue)?', re.IGNORECASE)


def _classify_section(line: str) -> Optional[str]:
    stripped = line.strip()
    for section, pattern in _SECTION_HEADERS.items():
        if pattern.fullmatch(stripped):
            return section
    return None


def _is_bullet(line: str) -> bool:
    return bool(re.match(r'^\s*[•\-–—*▪◦‣⁃]\s+', line))


def _para_is_list_item(para) -> bool:
    if _LIST_STYLES.search(para.style.name or ""):
        return True
    # Check for <w:numPr> element indicating a list paragraph
    numPr = para._p.find(qn('w:numPr'))
    if numPr is not None:
        return True
    return _is_bullet(para.text)


def _para_has_bold(para) -> bool:
    return any(run.bold for run in para.runs if run.text.strip())


def _para_has_italic(para) -> bool:
    return any(run.italic for run in para.runs if run.text.strip())


def _extract_paragraphs(file_bytes: bytes) -> list[dict]:
    import io
    doc = Document(io.BytesIO(file_bytes))
    result = []
    for para in doc.paragraphs:
        text = para.text
        style_name = para.style.name or ""
        is_heading = bool(_HEADING_STYLES.search(style_name)) or style_name.lower() == "title"
        is_list = _para_is_list_item(para)
        result.append({
            "text": text,
            "style": style_name,
            "is_heading": is_heading,
            "is_list": is_list,
            "bold": _para_has_bold(para),
            "italic": _para_has_italic(para),
        })
    return result


def _extract_header_fields(lines: list[str]) -> dict:
    header = {"name": "", "email": "", "phone": "", "location": "", "linkedin": "", "website": ""}
    name_set = False
    for line in lines:
        line = line.strip()
        if not line:
            continue
        email_match = _EMAIL.search(line)
        if email_match and not header["email"]:
            header["email"] = email_match.group()
            continue
        phone_match = _PHONE.search(line)
        if phone_match and not header["phone"]:
            header["phone"] = phone_match.group()
        url_match = _URL.search(line)
        if url_match:
            url = url_match.group()
            if "linkedin" in url.lower() and not header["linkedin"]:
                header["linkedin"] = url
            elif not header["website"]:
                header["website"] = url
        if not name_set and not email_match and not phone_match and not url_match:
            if len(line.split()) <= 6 and not _DATE_RANGE.search(line):
                header["name"] = line
                name_set = True
    return header


def _parse_experience_block(lines: list[str]) -> list[dict]:
    entries = []
    current: Optional[dict] = None

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        date_match = _DATE_RANGE.search(stripped)
        if _is_bullet(stripped) or stripped.startswith("\t"):
            bullet_text = re.sub(r'^\s*[•\-–—*▪◦‣⁃]\s+', '', stripped).strip()
            if current is None:
                current = {"company": "", "title": "", "location": "", "start_date": "", "end_date": "", "bullets": []}
            current["bullets"].append(bullet_text)
        elif date_match:
            if current is not None:
                entries.append(current)
            current = {"company": "", "title": "", "location": "", "start_date": "", "end_date": "", "bullets": []}
            date_str = date_match.group()
            parts = re.split(r'\s*[-–—]\s*', date_str, maxsplit=1)
            current["start_date"] = parts[0].strip()
            current["end_date"] = parts[1].strip() if len(parts) > 1 else ""
            remainder = stripped[:date_match.start()].strip(' ,|–—-')
            if remainder:
                segments = re.split(r'\s{2,}|,\s*|\s*\|\s*', remainder)
                segments = [s.strip() for s in segments if s.strip()]
                if segments:
                    current["title"] = segments[0]
                if len(segments) > 1:
                    current["company"] = segments[1]
                if len(segments) > 2:
                    current["location"] = segments[2]
        elif current is not None:
            segments = re.split(r'\s{2,}|,\s*|\s*\|\s*', stripped)
            segments = [s.strip() for s in segments if s.strip()]
            if not current["title"] and segments:
                current["title"] = segments[0]
            elif not current["company"] and segments:
                current["company"] = segments[0]
            elif not current["location"] and segments:
                current["location"] = segments[0]
        else:
            current = {"company": "", "title": stripped, "location": "", "start_date": "", "end_date": "", "bullets": []}

    if current is not None:
        entries.append(current)
    return entries


def _parse_education_block(lines: list[str]) -> list[dict]:
    entries = []
    current: Optional[dict] = None

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        date_match = _DATE_RANGE.search(stripped)
        if current is None or date_match:
            if current is not None:
                entries.append(current)
            current = {"school": "", "degree": "", "field": "", "graduation_date": "", "gpa": "", "honors": ""}
            if date_match:
                current["graduation_date"] = date_match.group()
                remainder = stripped[:date_match.start()].strip(' ,|–—-')
            else:
                remainder = stripped
            if remainder:
                segments = re.split(r'\s{2,}|,\s*|\s*\|\s*', remainder)
                segments = [s.strip() for s in segments if s.strip()]
                if segments:
                    current["school"] = segments[0]
                if len(segments) > 1:
                    current["degree"] = segments[1]
                if len(segments) > 2:
                    current["field"] = segments[2]
        else:
            gpa_match = re.search(r'gpa[:\s]+(\d+\.\d+)', stripped, re.IGNORECASE)
            honors_match = re.search(r'(cum laude|magna cum laude|summa cum laude|honors?)', stripped, re.IGNORECASE)
            if gpa_match:
                current["gpa"] = gpa_match.group(1)
            elif honors_match:
                current["honors"] = honors_match.group(1)
            elif not current["degree"]:
                current["degree"] = stripped
            elif not current["field"]:
                current["field"] = stripped

    if current is not None:
        entries.append(current)
    return entries


def _parse_skills_block(lines: list[str]) -> list[dict]:
    entries = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if _is_bullet(stripped):
            stripped = re.sub(r'^\s*[•\-–—*▪◦‣⁃]\s+', '', stripped)
        if ':' in stripped:
            parts = stripped.split(':', 1)
            category = parts[0].strip()
            items_raw = parts[1].strip()
        else:
            category = "Skills"
            items_raw = stripped
        items = [i.strip() for i in re.split(r'[,;|]', items_raw) if i.strip()]
        if items:
            existing = next((e for e in entries if e["category"] == category), None)
            if existing:
                existing["items"].extend(items)
            else:
                entries.append({"category": category, "items": items})
    return entries


def _parse_certifications_block(lines: list[str]) -> list[dict]:
    entries = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if _is_bullet(stripped):
            stripped = re.sub(r'^\s*[•\-–—*▪◦‣⁃]\s+', '', stripped)
        date_match = _DATE_RANGE.search(stripped)
        cert = {"name": "", "issuer": "", "date": ""}
        if date_match:
            cert["date"] = date_match.group()
            remainder = stripped[:date_match.start()].strip(' ,|–—-')
        else:
            remainder = stripped
        parts = re.split(r',\s*|\s*\|\s*|\s{2,}', remainder)
        parts = [p.strip() for p in parts if p.strip()]
        if parts:
            cert["name"] = parts[0]
        if len(parts) > 1:
            cert["issuer"] = parts[1]
        if cert["name"]:
            entries.append(cert)
    return entries


def _parse_projects_block(lines: list[str]) -> list[dict]:
    entries = []
    current: Optional[dict] = None

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current is not None:
                entries.append(current)
                current = None
            continue
        if _is_bullet(stripped):
            if current is None:
                current = {"name": "", "description": "", "technologies": "", "url": ""}
            text = re.sub(r'^\s*[•\-–—*▪◦‣⁃]\s+', '', stripped)
            if current["description"]:
                current["description"] += " " + text
            else:
                current["description"] = text
        elif current is None:
            current = {"name": stripped, "description": "", "technologies": "", "url": ""}
        else:
            tech_match = re.match(r'(?:tech(?:nologies)?|stack|built\s+with)[:\s]+(.+)', stripped, re.IGNORECASE)
            if tech_match:
                current["technologies"] = tech_match.group(1).strip()
            elif _URL.search(stripped):
                current["url"] = _URL.search(stripped).group()
            elif current["description"]:
                current["description"] += " " + stripped
            else:
                current["description"] = stripped

    if current is not None:
        entries.append(current)
    return entries


def _parse_awards_block(lines: list[str]) -> list[dict]:
    entries = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if _is_bullet(stripped):
            stripped = re.sub(r'^\s*[•\-–—*▪◦‣⁃]\s+', '', stripped)
        date_match = _DATE_RANGE.search(stripped)
        award = {"name": "", "issuer": "", "date": "", "description": ""}
        if date_match:
            award["date"] = date_match.group()
            remainder = stripped[:date_match.start()].strip(' ,|–—-')
        else:
            remainder = stripped
        parts = re.split(r',\s*|\s*\|\s*|\s{2,}', remainder)
        parts = [p.strip() for p in parts if p.strip()]
        if parts:
            award["name"] = parts[0]
        if len(parts) > 1:
            award["issuer"] = parts[1]
        if len(parts) > 2:
            award["description"] = parts[2]
        if award["name"]:
            entries.append(award)
    return entries


def _parse_resume_paragraphs(paragraphs: list[dict]) -> dict:
    from app.models import default_resume
    result = default_resume()
    result["experience"] = []
    result["education"] = []
    result["skills"] = []
    result["certifications"] = []
    result["projects"] = []
    result["awards"] = []
    result["summary"] = None

    sections: dict[str, list[str]] = {"_header": []}
    current_section = "_header"

    for para in paragraphs:
        text = para["text"]
        stripped = text.strip()

        # Heading styles always signal a section boundary
        if para["is_heading"]:
            section = _classify_section(stripped)
            if section:
                current_section = section
                sections.setdefault(current_section, [])
                continue
            # Bold heading-style paragraph that isn't a known section — treat as text
        else:
            section = _classify_section(stripped)
            if section:
                current_section = section
                sections.setdefault(current_section, [])
                continue

        # Represent list items with a bullet prefix so downstream parsers work
        if para["is_list"] and not _is_bullet(text):
            text = "• " + text.strip()

        sections.setdefault(current_section, []).append(text)

    header_lines = sections.get("_header", [])
    result["header"] = _extract_header_fields(header_lines)

    if "summary" in sections:
        result["summary"] = " ".join(l.strip() for l in sections["summary"] if l.strip()) or None

    if "experience" in sections:
        result["experience"] = _parse_experience_block(sections["experience"])
    if "education" in sections:
        result["education"] = _parse_education_block(sections["education"])
    if "skills" in sections:
        result["skills"] = _parse_skills_block(sections["skills"])
    if "certifications" in sections:
        result["certifications"] = _parse_certifications_block(sections["certifications"])
    if "projects" in sections:
        result["projects"] = _parse_projects_block(sections["projects"])
    if "awards" in sections:
        result["awards"] = _parse_awards_block(sections["awards"])

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


def import_docx(file_bytes: bytes) -> dict:
    try:
        paragraphs = _extract_paragraphs(file_bytes)
    except Exception:
        return _fallback_resume("")

    if not any(p["text"].strip() for p in paragraphs):
        return _fallback_resume("")

    try:
        return _parse_resume_paragraphs(paragraphs)
    except Exception:
        raw_text = "\n".join(p["text"] for p in paragraphs)
        return _fallback_resume(raw_text)
