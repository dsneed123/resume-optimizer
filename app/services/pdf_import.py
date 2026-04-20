import re
from typing import Optional


class ImportError(Exception):
    pass


class PasswordProtectedError(ImportError):
    pass


class CorruptedFileError(ImportError):
    pass


class EmptyFileError(ImportError):
    pass

_LIGATURE_MAP = str.maketrans({
    '\ufb00': 'ff', '\ufb01': 'fi', '\ufb02': 'fl',
    '\ufb03': 'ffi', '\ufb04': 'ffl', '\ufb05': 'st', '\ufb06': 'st',
    '\u2019': "'", '\u2018': "'", '\u201c': '"', '\u201d': '"',
    '\u2013': '-', '\u2014': '--',
})

_PAGE_NUMBER = re.compile(r'^\s*(?:page\s+)?\d+(?:\s+of\s+\d+)?\s*$', re.IGNORECASE)

# Prefix added by _extract_text_from_pdf to lines detected as headers by font formatting
_HEADER_MARKER = '\x02'

_SECTION_HEADERS = {
    'experience': re.compile(
        r'(?:work\s+|professional\s+|relevant\s+|technical\s+|recent\s+)?experience'
        r'|(?:work|employment|career)\s+history'
        r'|employment(?:\s+history)?'
        r'|professional\s+background',
        re.IGNORECASE,
    ),
    'education': re.compile(
        r'education(?:\s+(?:&\s+training|history|background))?'
        r'|academic\s+(?:background|history|credentials)',
        re.IGNORECASE,
    ),
    'skills': re.compile(
        r'(?:technical\s+|core\s+|key\s+)?skills?'
        r'|core\s+competencies'
        r'|technologies?(?:\s+(?:&\s+)?tools?)?'
        r'|tools?\s+(?:&\s+)?technologies?',
        re.IGNORECASE,
    ),
    'certifications': re.compile(
        r'certifications?(?:\s+(?:&\s+)?licenses?)?'
        r'|licenses?(?:\s+(?:&\s+)?certifications?)?'
        r'|credentials',
        re.IGNORECASE,
    ),
    'projects': re.compile(
        r'(?:personal\s+|side\s+|notable\s+|key\s+|open[\s-]source\s+)?projects?'
        r'|portfolio',
        re.IGNORECASE,
    ),
    'awards': re.compile(
        r'awards?(?:\s+(?:&\s+)?honors?)?'
        r'|honors?(?:\s+(?:&\s+)?awards?)?'
        r'|achievements?'
        r'|accomplishments?'
        r'|recognitions?',
        re.IGNORECASE,
    ),
    'summary': re.compile(
        r'(?:professional\s+|career\s+|executive\s+)?(?:summary|profile|overview|statement)'
        r'|(?:career\s+)?objective'
        r'|about(?:\s+me)?',
        re.IGNORECASE,
    ),
}

_DATE_RANGE = re.compile(
    # Month+Year with optional "Expected" prefix and optional range
    r'(?:expected\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}'
    r'(?:\s*(?:[-–—]|\bto\b)\s*'
    r'(?:(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?\d{4}|present|current))?'
    # Year-only range: 2020-2023, 2020 to Present (separator required to avoid matching stray years)
    r'|\d{4}\s*(?:[-–—]|\bto\b)\s*(?:\d{4}|present|current)',
    re.IGNORECASE,
)

_DEGREE_RE = re.compile(
    r'^(?P<degree>'
    r'Ph\.?D\.?|J\.?D\.?|M\.?D\.?'                                    # Doctoral
    r'|M\.?B\.?A\.?|M\.?P\.?H\.?|M\.?Eng?\.?|M\.?Ed?\.?'             # Master's (multi-letter)
    r'|M\.?S\.?|M\.?A\.?'                                              # M.S., M.A.
    r'|B\.?F\.?A\.?|B\.?Eng?\.?|B\.?S\.?C?\.?|B\.?A\.?'              # Bachelor's
    r'|A\.?S\.?|A\.?A\.?'                                              # Associate's
    r'|(?:Bachelor|Master|Doctor|Associate)(?:\s+of\s+\w+(?:\s+(?!in\b)\w+){0,3})?'  # Full names
    r')(?=[\s,]|$)'
    r'(?:[\s,]+in\s+(?P<field>.+))?$',
    re.IGNORECASE,
)


def _extract_degree_and_field(text: str) -> tuple[str, str]:
    m = _DEGREE_RE.match(text.strip())
    if m:
        return m.group('degree').strip(), (m.group('field') or '').strip()
    return text.strip(), ''

_EMAIL = re.compile(r'[\w.+-]+@[\w-]+\.[a-z]{2,}', re.IGNORECASE)
_PHONE = re.compile(r'(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}')
_URL = re.compile(r'(?:https?://|www\.|linkedin\.com/in/)\S+', re.IGNORECASE)


def _classify_section(line: str) -> Optional[str]:
    stripped = line.strip()
    if stripped.startswith(_HEADER_MARKER):
        stripped = stripped[len(_HEADER_MARKER):].strip()
    # Strip trailing colon or period common in some resume formats
    normalized = stripped.rstrip(':.')
    if not normalized:
        return None
    for section, pattern in _SECTION_HEADERS.items():
        if pattern.fullmatch(normalized):
            return section
    return None


def _is_bullet(line: str) -> bool:
    return bool(re.match(r'^\s*[•\-–—*▪◦‣⁃]\s+', line))


def _extract_header_fields(lines: list[str]) -> dict:
    header = {"name": "", "email": "", "phone": "", "location": "", "linkedin": "", "website": ""}
    name_set = False
    for line in lines:
        line = line.strip()
        if line.startswith(_HEADER_MARKER):
            line = line[len(_HEADER_MARKER):].strip()
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
        if url_match and not header["linkedin"]:
            url = url_match.group()
            if "linkedin" in url.lower():
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
    company_context = ""  # Bold/header company name applied to sub-entries (multiple positions)

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Strip bold/header marker; remember whether this line was formatted as a header
        is_bold = stripped.startswith(_HEADER_MARKER)
        if is_bold:
            stripped = stripped[len(_HEADER_MARKER):].strip()
        if not stripped:
            continue

        date_match = _DATE_RANGE.search(stripped)

        if _is_bullet(stripped):
            if current is None:
                current = {"company": company_context, "title": "", "location": "", "start_date": "", "end_date": "", "bullets": []}
            bullet_text = re.sub(r'^\s*[•\-–—*▪◦‣⁃]\s+', '', stripped)
            current["bullets"].append(bullet_text)
        elif date_match:
            date_str = date_match.group()
            date_parts = re.split(r'\s*(?:[-–—]|\bto\b)\s*', date_str, maxsplit=1, flags=re.IGNORECASE)
            start_date = date_parts[0].strip()
            end_date = date_parts[1].strip() if len(date_parts) > 1 else ""
            remainder = stripped[:date_match.start()].strip(' ,|–—-')

            if current is not None and not current["start_date"] and not remainder:
                # Date-only line following title/company lines — fill into current entry
                current["start_date"] = start_date
                current["end_date"] = end_date
            else:
                if current is not None:
                    entries.append(current)
                current = {"company": "", "title": "", "location": "", "start_date": start_date, "end_date": end_date, "bullets": []}
                if remainder:
                    segments = re.split(r'\s{2,}|,\s*|\s*\|\s*', remainder)
                    segments = [s.strip() for s in segments if s.strip()]
                    if segments:
                        current["title"] = segments[0]
                    if len(segments) > 1:
                        current["company"] = segments[1]
                    elif company_context:
                        current["company"] = company_context
                    if len(segments) > 2:
                        current["location"] = segments[2]
                elif company_context:
                    current["company"] = company_context
        elif is_bold and not date_match:
            # Bold line with no date — treat as company-level header for multiple positions
            if current is not None:
                entries.append(current)
                current = None
            company_context = stripped
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
            current = {"company": company_context, "title": stripped, "location": "", "start_date": "", "end_date": "", "bullets": []}

    if current is not None:
        entries.append(current)
    return entries


def _parse_education_block(lines: list[str]) -> list[dict]:
    entries = []
    current: Optional[dict] = None

    for line in lines:
        stripped = line.strip()
        if stripped.startswith(_HEADER_MARKER):
            stripped = stripped[len(_HEADER_MARKER):].strip()
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
                    degree, field = _extract_degree_and_field(segments[1])
                    current["degree"] = degree
                    if field:
                        current["field"] = field
                    elif len(segments) > 2:
                        current["field"] = ' '.join(segments[2:])
        else:
            gpa_match = re.search(r'gpa[:\s]+(\d+\.\d+)', stripped, re.IGNORECASE)
            honors_match = re.search(r'(cum laude|magna cum laude|summa cum laude|honors?)', stripped, re.IGNORECASE)
            if gpa_match:
                current["gpa"] = gpa_match.group(1)
            elif honors_match:
                current["honors"] = honors_match.group(1)
            elif not current["degree"]:
                degree, field = _extract_degree_and_field(stripped)
                current["degree"] = degree
                if field and not current["field"]:
                    current["field"] = field
            elif not current["field"]:
                current["field"] = stripped

    if current is not None:
        entries.append(current)
    return entries


def _parse_skills_block(lines: list[str]) -> list[dict]:
    entries = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(_HEADER_MARKER):
            stripped = stripped[len(_HEADER_MARKER):].strip()
        if not stripped:
            continue
        if _is_bullet(stripped):
            stripped = re.sub(r'^\s*[•\-–—*▪◦‣⁃]\s+', '', stripped)
        if ':' in stripped:
            parts = stripped.split(':', 1)
            category = parts[0].strip()
            items_raw = parts[1].strip()
        else:
            category = "General"
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
        if stripped.startswith(_HEADER_MARKER):
            stripped = stripped[len(_HEADER_MARKER):].strip()
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
        if stripped.startswith(_HEADER_MARKER):
            stripped = stripped[len(_HEADER_MARKER):].strip()
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
        if stripped.startswith(_HEADER_MARKER):
            stripped = stripped[len(_HEADER_MARKER):].strip()
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


def _is_header_footer_line(line: str) -> bool:
    return bool(_PAGE_NUMBER.match(line))


def _group_words_by_line(words: list[dict]) -> list[list[dict]]:
    """Group pdfplumber word dicts into lines by y-position, each line sorted left-to-right."""
    if not words:
        return []
    line_groups: list[list[dict]] = []
    for word in sorted(words, key=lambda w: w['top']):
        placed = False
        for group in line_groups:
            if abs(word['top'] - group[0]['top']) <= 5:
                group.append(word)
                placed = True
                break
        if not placed:
            line_groups.append([word])
    return [sorted(g, key=lambda w: w['x0']) for g in line_groups]


def _words_to_lines(words: list[dict]) -> list[str]:
    """Group pdfplumber word dicts into text lines, sorted top-to-bottom then left-to-right."""
    return [" ".join(w['text'] for w in g) for g in _group_words_by_line(words)]


def _get_median_font_size(chars: list[dict]) -> float:
    sizes = sorted(c['size'] for c in chars if c.get('size', 0) > 0)
    if not sizes:
        return 0.0
    return sizes[len(sizes) // 2]


def _line_is_bold_or_large(line_top: float, chars_by_top: dict, median_size: float, tolerance: float = 5.0) -> bool:
    """Return True if chars at line_top are predominantly bold or larger than median font size."""
    low, high = int(line_top - tolerance), int(line_top + tolerance) + 1
    text_chars = [
        c for k in range(low, high)
        for c in chars_by_top.get(k, [])
        if c.get('text', '').strip()
    ]
    if not text_chars:
        return False
    bold_count = sum(
        1 for c in text_chars
        if any(w in c.get('fontname', '').lower() for w in ('bold', 'heavy', 'black', 'demi'))
    )
    if bold_count / len(text_chars) > 0.5:
        return True
    avg_size = sum(c.get('size', 0) for c in text_chars) / len(text_chars)
    return median_size > 0 and avg_size > median_size * 1.2


def _detect_two_columns(words: list[dict], page_w: float) -> bool:
    """Return True if word x-positions suggest a two-column layout."""
    if not words:
        return False
    mid_lo = page_w * 0.35
    mid_hi = page_w * 0.65
    mid_count = sum(1 for w in words if mid_lo < w['x0'] < mid_hi)
    return mid_count / len(words) < 0.10


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    import io
    import pdfplumber

    if b'/Encrypt' in file_bytes:
        raise PasswordProtectedError("This PDF is password-protected")

    try:
        pdf_file = pdfplumber.open(io.BytesIO(file_bytes))
    except Exception as exc:
        msg = str(exc).lower()
        if any(kw in msg for kw in ('encrypt', 'password', 'decrypt')):
            raise PasswordProtectedError("This PDF is password-protected") from exc
        raise CorruptedFileError("Could not read this file") from exc

    page_texts = []
    try:
        with pdf_file as pdf:
            for page_num, page in enumerate(pdf.pages):
                words = page.extract_words(x_tolerance=3, y_tolerance=3)
                if not words:
                    page_text = page.extract_text()
                    if page_text:
                        page_texts.append(page_text.translate(_LIGATURE_MAP))
                    continue

                page_h = page.height
                page_w = page.width
                margin = page_h * 0.04

                # Strip repeated header region on pages after the first (titles, name repeats)
                if page_num > 0:
                    words = [w for w in words if margin < w['top'] < page_h - margin]
                else:
                    words = [w for w in words if w['top'] < page_h - margin]

                if not words:
                    continue

                # Pre-compute font metadata for formatting-based header detection
                chars = page.chars
                median_size = _get_median_font_size(chars) if chars else 0.0
                chars_by_top: dict[int, list[dict]] = {}
                if chars:
                    for c in chars:
                        chars_by_top.setdefault(int(c.get('top', 0)), []).append(c)

                if _detect_two_columns(words, page_w):
                    mid_x = page_w / 2
                    left = [w for w in words if (w['x0'] + w['x1']) / 2 < mid_x]
                    right = [w for w in words if (w['x0'] + w['x1']) / 2 >= mid_x]
                    groups = _group_words_by_line(left) + _group_words_by_line(right)
                else:
                    groups = _group_words_by_line(words)

                result_lines = []
                for group in groups:
                    line_text = " ".join(w['text'] for w in group)
                    if _is_header_footer_line(line_text):
                        continue
                    if chars_by_top and _line_is_bold_or_large(group[0]['top'], chars_by_top, median_size):
                        line_text = _HEADER_MARKER + line_text
                    result_lines.append(line_text)

                if result_lines:
                    page_texts.append("\n".join(result_lines).translate(_LIGATURE_MAP))
    except (PasswordProtectedError, CorruptedFileError):
        raise
    except Exception as exc:
        raise CorruptedFileError("Could not read this file") from exc

    return "\n".join(page_texts)


def import_text(text: str) -> dict:
    if not text or not text.strip():
        return _fallback_resume("")
    try:
        return _parse_resume_text(text)
    except Exception:
        return _fallback_resume(text)


def import_pdf(file_bytes: bytes) -> dict:
    if not file_bytes:
        raise EmptyFileError("No text content found")

    full_text = _extract_text_from_pdf(file_bytes)

    if not full_text.strip():
        raise EmptyFileError("No text content found")

    try:
        return _parse_resume_text(full_text)
    except Exception:
        return _fallback_resume(full_text)


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


def _parse_resume_text(text: str) -> dict:
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

    # Split into sections
    sections: dict[str, list[str]] = {"_header": []}
    current_section = "_header"

    for line in lines:
        section = _classify_section(line)
        if section:
            current_section = section
            sections.setdefault(current_section, [])
        else:
            sections.setdefault(current_section, []).append(line)

    # Parse header
    header_lines = sections.get("_header", [])
    result["header"] = _extract_header_fields(header_lines)

    # Parse summary
    if "summary" in sections:
        result["summary"] = " ".join(l.strip() for l in sections["summary"] if l.strip()) or None

    # Parse structured sections
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
