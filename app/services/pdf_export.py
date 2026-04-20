from types import SimpleNamespace

from flask import render_template
from weasyprint import HTML


def _dict_to_ns(obj):
    """Recursively convert dicts to SimpleNamespace for dot-access in templates."""
    if isinstance(obj, dict):
        return SimpleNamespace(**{k: _dict_to_ns(v) for k, v in obj.items()})
    if isinstance(obj, list):
        return [_dict_to_ns(item) for item in obj]
    return obj


def export_pdf(resume_data: dict, typography: dict) -> bytes:
    """Render resume_data + typography to a single-page US Letter PDF."""
    data = _dict_to_ns(resume_data)
    t = _dict_to_ns(typography)

    html_str = render_template("pdf_resume.html", data=data, typography=t)

    pdf_bytes = HTML(string=html_str).write_pdf()
    return pdf_bytes
