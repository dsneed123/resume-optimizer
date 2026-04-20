from pathlib import Path
from types import SimpleNamespace

from flask import render_template
from weasyprint import HTML

from app.services.font_config import build_font_face_css, get_css_family

_STATIC_DIR = Path(__file__).parent.parent / "static"


def _dict_to_ns(obj):
    if isinstance(obj, dict):
        return SimpleNamespace(**{k: _dict_to_ns(v) for k, v in obj.items()})
    if isinstance(obj, list):
        return [_dict_to_ns(item) for item in obj]
    return obj


def export_pdf(resume_data: dict, typography: dict) -> bytes:
    """Render resume_data + typography to a single-page US Letter PDF."""
    data = _dict_to_ns(resume_data)
    t = _dict_to_ns(typography)

    font_family = typography.get("font_family", "Helvetica")
    font_css = build_font_face_css(font_family)
    css_family = get_css_family(font_family)

    html_str = render_template(
        "pdf_resume.html",
        data=data,
        typography=t,
        font_css=font_css,
        css_family=css_family,
    )

    pdf_bytes = HTML(string=html_str, base_url=str(_STATIC_DIR)).write_pdf()
    return pdf_bytes
