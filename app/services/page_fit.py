import copy
from types import SimpleNamespace

from flask import render_template

_PAGE_HEIGHT_PT = 792.0  # US Letter
_PAGE_WIDTH_PT = 612.0
_PTS_PER_INCH = 72.0

_MIN_TYPOGRAPHY = {
    "font_size_body": 8.0,
    "font_size_detail": 7.5,
    "font_size_section_header": 10.0,
    "line_height": 1.0,
    "paragraph_spacing": 2.0,
    "section_spacing": 6.0,
    "margin_top": 0.4,
    "margin_bottom": 0.4,
    "margin_left": 0.4,
    "margin_right": 0.4,
}


def _dict_to_ns(obj):
    if isinstance(obj, dict):
        return SimpleNamespace(**{k: _dict_to_ns(v) for k, v in obj.items()})
    if isinstance(obj, list):
        return [_dict_to_ns(item) for item in obj]
    return obj


def _estimate_lines(text: str, font_size: float, available_width_pt: float) -> int:
    if not text:
        return 0
    chars_per_line = max(1, available_width_pt / (font_size * 0.55))
    raw = len(text) / chars_per_line
    return max(1, int(raw) + (1 if raw % 1 > 0 else 0))


def calculate_content_height(resume_data: dict, typography: dict) -> float:
    """Estimate total content height in points for the given resume and typography."""
    t = typography
    margin_left_pt = t.get("margin_left", 0.6) * _PTS_PER_INCH
    margin_right_pt = t.get("margin_right", 0.6) * _PTS_PER_INCH
    available_width = _PAGE_WIDTH_PT - margin_left_pt - margin_right_pt

    line_h = t.get("line_height", 1.15)
    para_sp = t.get("paragraph_spacing", 4)
    sec_sp = t.get("section_spacing", 10)
    body_sz = t.get("font_size_body", 10)
    detail_sz = t.get("font_size_detail", 9)
    name_sz = t.get("font_size_name", 20)
    sec_sz = t.get("font_size_section_header", 12)
    bullet_indent = t.get("bullet_indent", 12)

    height = 0.0

    header = resume_data.get("header", {})
    height += name_sz * line_h
    contact_parts = [
        header.get("email", ""),
        header.get("phone", ""),
        header.get("location", ""),
        header.get("linkedin", ""),
        header.get("website", ""),
    ]
    contact_text = " | ".join(p for p in contact_parts if p)
    height += _estimate_lines(contact_text, body_sz, available_width) * body_sz * line_h
    height += sec_sp

    summary = resume_data.get("summary")
    if summary:
        height += sec_sz * line_h + 2
        height += _estimate_lines(summary, body_sz, available_width) * body_sz * line_h
        height += para_sp + sec_sp

    experience = resume_data.get("experience", [])
    if experience:
        height += sec_sz * line_h + 4  # header + divider
        for exp in experience:
            height += body_sz * line_h   # title
            height += detail_sz * line_h  # company/date
            for bullet in exp.get("bullets", []):
                height += _estimate_lines(bullet, body_sz, available_width - bullet_indent) * body_sz * line_h
            height += para_sp
        height += sec_sp

    education = resume_data.get("education", [])
    if education:
        height += sec_sz * line_h + 4
        for edu in education:
            height += body_sz * line_h
            height += detail_sz * line_h
            if edu.get("honors") or edu.get("gpa"):
                height += detail_sz * line_h
            height += para_sp
        height += sec_sp

    skills = resume_data.get("skills", [])
    if skills:
        height += sec_sz * line_h + 4
        for skill in skills:
            items_text = skill.get("category", "") + ": " + ", ".join(skill.get("items", []))
            height += _estimate_lines(items_text, body_sz, available_width) * body_sz * line_h
            height += para_sp
        height += sec_sp

    certifications = resume_data.get("certifications", [])
    if certifications:
        height += sec_sz * line_h + 4
        for _ in certifications:
            height += body_sz * line_h + detail_sz * line_h + para_sp
        height += sec_sp

    projects = resume_data.get("projects", [])
    if projects:
        height += sec_sz * line_h + 4
        for proj in projects:
            height += body_sz * line_h
            if proj.get("description"):
                height += _estimate_lines(proj["description"], body_sz, available_width) * body_sz * line_h
            if proj.get("technologies"):
                height += detail_sz * line_h
            height += para_sp
        height += sec_sp

    awards = resume_data.get("awards", [])
    if awards:
        height += sec_sz * line_h + 4
        for award in awards:
            height += body_sz * line_h
            if award.get("description"):
                height += _estimate_lines(award["description"], body_sz, available_width) * body_sz * line_h
            height += para_sp
        height += sec_sp

    return height


def _render_page_count(resume_data: dict, typography: dict) -> int:
    from weasyprint import HTML  # lazy import — system libs may not be present
    data = _dict_to_ns(resume_data)
    t = _dict_to_ns(typography)
    html_str = render_template("pdf_resume.html", data=data, t=t)
    document = HTML(string=html_str).render()
    return len(document.pages)


def fits_one_page(resume_data: dict, typography: dict) -> bool:
    """Return True if the resume renders to exactly one page."""
    try:
        return _render_page_count(resume_data, typography) <= 1
    except Exception:
        available_height = (
            _PAGE_HEIGHT_PT
            - typography.get("margin_top", 0.5) * _PTS_PER_INCH
            - typography.get("margin_bottom", 0.5) * _PTS_PER_INCH
        )
        return calculate_content_height(resume_data, typography) <= available_height


def suggest_typography_adjustments(resume_data: dict, typography: dict) -> dict:
    """
    Return suggested typography adjustments if content overflows one page.
    Returns an empty dict if content already fits.
    """
    if fits_one_page(resume_data, typography):
        return {}

    suggested = copy.deepcopy(typography)
    suggested["font_size_body"] = max(_MIN_TYPOGRAPHY["font_size_body"], typography.get("font_size_body", 10) - 1)
    suggested["font_size_detail"] = max(_MIN_TYPOGRAPHY["font_size_detail"], typography.get("font_size_detail", 9) - 1)
    suggested["font_size_section_header"] = max(_MIN_TYPOGRAPHY["font_size_section_header"], typography.get("font_size_section_header", 12) - 1)
    suggested["line_height"] = max(_MIN_TYPOGRAPHY["line_height"], round(typography.get("line_height", 1.15) - 0.05, 2))
    suggested["paragraph_spacing"] = max(_MIN_TYPOGRAPHY["paragraph_spacing"], typography.get("paragraph_spacing", 4) - 1)
    suggested["section_spacing"] = max(_MIN_TYPOGRAPHY["section_spacing"], typography.get("section_spacing", 10) - 2)
    suggested["margin_top"] = max(_MIN_TYPOGRAPHY["margin_top"], round(typography.get("margin_top", 0.5) - 0.05, 2))
    suggested["margin_bottom"] = max(_MIN_TYPOGRAPHY["margin_bottom"], round(typography.get("margin_bottom", 0.5) - 0.05, 2))
    suggested["margin_left"] = max(_MIN_TYPOGRAPHY["margin_left"], round(typography.get("margin_left", 0.6) - 0.05, 2))
    suggested["margin_right"] = max(_MIN_TYPOGRAPHY["margin_right"], round(typography.get("margin_right", 0.6) - 0.05, 2))
    return suggested


def auto_fit(resume_data: dict, typography: dict) -> dict:
    """
    Iteratively reduce typography settings until the resume fits one page.
    Returns the adjusted typography dict (unchanged if already fits).
    """
    current = copy.deepcopy(typography)

    for _ in range(20):
        if fits_one_page(resume_data, current):
            break

        at_min = all(current.get(k, 0) <= v for k, v in _MIN_TYPOGRAPHY.items())
        if at_min:
            break

        current["font_size_body"] = max(_MIN_TYPOGRAPHY["font_size_body"], current.get("font_size_body", 10) - 0.5)
        current["font_size_detail"] = max(_MIN_TYPOGRAPHY["font_size_detail"], current.get("font_size_detail", 9) - 0.5)
        current["font_size_section_header"] = max(_MIN_TYPOGRAPHY["font_size_section_header"], current.get("font_size_section_header", 12) - 0.5)
        current["line_height"] = max(_MIN_TYPOGRAPHY["line_height"], round(current.get("line_height", 1.15) - 0.025, 3))
        current["paragraph_spacing"] = max(_MIN_TYPOGRAPHY["paragraph_spacing"], current.get("paragraph_spacing", 4) - 0.5)
        current["section_spacing"] = max(_MIN_TYPOGRAPHY["section_spacing"], current.get("section_spacing", 10) - 1.0)
        current["margin_top"] = max(_MIN_TYPOGRAPHY["margin_top"], round(current.get("margin_top", 0.5) - 0.025, 3))
        current["margin_bottom"] = max(_MIN_TYPOGRAPHY["margin_bottom"], round(current.get("margin_bottom", 0.5) - 0.025, 3))
        current["margin_left"] = max(_MIN_TYPOGRAPHY["margin_left"], round(current.get("margin_left", 0.6) - 0.025, 3))
        current["margin_right"] = max(_MIN_TYPOGRAPHY["margin_right"], round(current.get("margin_right", 0.6) - 0.025, 3))

    return current
