from dataclasses import dataclass, field
from typing import Optional


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
    }


def validate_resume(data: dict) -> list[str]:
    errors = []

    header = data.get("header", {})
    if not isinstance(header, dict):
        errors.append("header must be a dict")
    else:
        if not header.get("name"):
            errors.append("header.name is required")
        if not header.get("email"):
            errors.append("header.email is required")

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

    for i, edu in enumerate(data.get("education", [])):
        if not isinstance(edu, dict):
            errors.append(f"education[{i}] must be a dict")
            continue
        if not edu.get("school"):
            errors.append(f"education[{i}].school is required")

    for i, skill in enumerate(data.get("skills", [])):
        if not isinstance(skill, dict):
            errors.append(f"skills[{i}] must be a dict")
            continue
        if not isinstance(skill.get("items", []), list):
            errors.append(f"skills[{i}].items must be a list")

    return errors
