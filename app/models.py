import re
from dataclasses import dataclass, field
from typing import Optional

_EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')
_URL_RE = re.compile(r'(?:https?://|www\.)|[a-zA-Z0-9](?:[a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}')
_DATE_RE = re.compile(r'(?:19|20)\d{2}|^present$', re.IGNORECASE)


@dataclass
class Header:
    name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin: str = ""
    website: str = ""


@dataclass
class Experience:
    company: str = ""
    title: str = ""
    location: str = ""
    start_date: str = ""
    end_date: str = ""
    bullets: list = field(default_factory=list)


@dataclass
class Education:
    school: str = ""
    degree: str = ""
    field: str = ""
    graduation_date: str = ""
    gpa: str = ""
    honors: str = ""


@dataclass
class Skill:
    category: str = ""
    items: list = field(default_factory=list)


@dataclass
class Certification:
    name: str = ""
    issuer: str = ""
    date: str = ""


@dataclass
class Project:
    name: str = ""
    description: str = ""
    technologies: str = ""
    url: str = ""


@dataclass
class Award:
    name: str = ""
    issuer: str = ""
    date: str = ""
    description: str = ""


_DEFAULT_SECTION_ORDER = ['summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'awards']


@dataclass
class ResumeData:
    header: Header = field(default_factory=Header)
    summary: Optional[str] = None
    experience: list = field(default_factory=list)
    education: list = field(default_factory=list)
    skills: list = field(default_factory=list)
    certifications: list = field(default_factory=list)
    projects: list = field(default_factory=list)
    awards: list = field(default_factory=list)
    section_order: list = field(default_factory=lambda: list(_DEFAULT_SECTION_ORDER))


def default_resume() -> dict:
    return {
        "header": {
            "name": "",
            "email": "",
            "phone": "",
            "location": "",
            "linkedin": "",
            "website": "",
        },
        "summary": None,
        "experience": [
            {
                "company": "",
                "title": "",
                "location": "",
                "start_date": "",
                "end_date": "",
                "bullets": [],
            }
        ],
        "education": [
            {
                "school": "",
                "degree": "",
                "field": "",
                "graduation_date": "",
                "gpa": "",
                "honors": "",
            }
        ],
        "skills": [
            {
                "category": "",
                "items": [],
            }
        ],
        "certifications": [
            {
                "name": "",
                "issuer": "",
                "date": "",
            }
        ],
        "projects": [
            {
                "name": "",
                "description": "",
                "technologies": "",
                "url": "",
            }
        ],
        "awards": [
            {
                "name": "",
                "issuer": "",
                "date": "",
                "description": "",
            }
        ],
        "section_order": list(_DEFAULT_SECTION_ORDER),
    }


@dataclass
class TypographySettings:
    font_family: str = "Helvetica"
    font_size_name: float = 20
    font_size_section_header: float = 12
    font_size_body: float = 10
    font_size_detail: float = 9
    line_height: float = 1.15
    paragraph_spacing: float = 4
    section_spacing: float = 10
    margin_top: float = 0.5
    margin_bottom: float = 0.5
    margin_left: float = 0.6
    margin_right: float = 0.6
    bullet_indent: float = 12
    date_format: str = "MMM YYYY"
    header_layout: str = "centered"
    contact_separator: str = "pipe"
    section_divider_style: str = "thin"
    skills_layout: str = "inline"
    bullet_style: str = "filled"


def default_typography() -> dict:
    return {
        "font_family": "Helvetica",
        "font_size_name": 20,
        "font_size_section_header": 12,
        "font_size_body": 10,
        "font_size_detail": 9,
        "line_height": 1.15,
        "paragraph_spacing": 4,
        "section_spacing": 10,
        "margin_top": 0.5,
        "margin_bottom": 0.5,
        "margin_left": 0.6,
        "margin_right": 0.6,
        "bullet_indent": 12,
        "date_format": "MMM YYYY",
        "header_layout": "centered",
        "contact_separator": "pipe",
        "section_divider_style": "thin",
        "skills_layout": "inline",
        "bullet_style": "filled",
    }


def validate_resume(data: dict) -> list[str]:
    errors = []

    header = data.get("header", {})
    if not isinstance(header, dict):
        errors.append("header must be a dict")
    else:
        if not header.get("name"):
            errors.append("header.name is required")
        email = header.get("email", "")
        if not email:
            errors.append("header.email is required")
        elif not _EMAIL_RE.match(email):
            errors.append("header.email is not a valid email address")
        phone = header.get("phone", "")
        if phone and len(re.sub(r'\D', '', phone)) < 7:
            errors.append("header.phone is not a valid phone number")
        linkedin = header.get("linkedin", "")
        if linkedin and not _URL_RE.search(linkedin):
            errors.append("header.linkedin is not a valid URL")
        website = header.get("website", "")
        if website and not _URL_RE.search(website):
            errors.append("header.website is not a valid URL")

    for i, exp in enumerate(data.get("experience", [])):
        if not isinstance(exp, dict):
            errors.append(f"experience[{i}] must be a dict")
            continue
        if not exp.get("company"):
            errors.append(f"experience[{i}].company is required")
        if not exp.get("title"):
            errors.append(f"experience[{i}].title is required")
        if not isinstance(exp.get("bullets", []), list):
            errors.append(f"experience[{i}].bullets must be a list")
        start_date = exp.get("start_date", "")
        if start_date and not _DATE_RE.search(start_date):
            errors.append(f"experience[{i}].start_date is not a valid date")
        end_date = exp.get("end_date", "")
        if end_date and not _DATE_RE.search(end_date):
            errors.append(f"experience[{i}].end_date is not a valid date")

    for i, edu in enumerate(data.get("education", [])):
        if not isinstance(edu, dict):
            errors.append(f"education[{i}] must be a dict")
            continue
        if not edu.get("school"):
            errors.append(f"education[{i}].school is required")
        graduation_date = edu.get("graduation_date", "")
        if graduation_date and not _DATE_RE.search(graduation_date):
            errors.append(f"education[{i}].graduation_date is not a valid date")

    for i, skill in enumerate(data.get("skills", [])):
        if not isinstance(skill, dict):
            errors.append(f"skills[{i}] must be a dict")
            continue
        if not isinstance(skill.get("items", []), list):
            errors.append(f"skills[{i}].items must be a list")

    for i, cert in enumerate(data.get("certifications", [])):
        if not isinstance(cert, dict):
            errors.append(f"certifications[{i}] must be a dict")
            continue
        cert_date = cert.get("date", "")
        if cert_date and not _DATE_RE.search(cert_date):
            errors.append(f"certifications[{i}].date is not a valid date")

    for i, proj in enumerate(data.get("projects", [])):
        if not isinstance(proj, dict):
            errors.append(f"projects[{i}] must be a dict")
            continue
        proj_url = proj.get("url", "")
        if proj_url and not _URL_RE.search(proj_url):
            errors.append(f"projects[{i}].url is not a valid URL")

    for i, award in enumerate(data.get("awards", [])):
        if not isinstance(award, dict):
            errors.append(f"awards[{i}] must be a dict")
            continue
        award_date = award.get("date", "")
        if award_date and not _DATE_RE.search(award_date):
            errors.append(f"awards[{i}].date is not a valid date")

    sections = ["experience", "education", "skills", "certifications", "projects", "awards"]
    if not any(data.get(s) for s in sections):
        errors.append("at least one resume section is required")

    return errors
