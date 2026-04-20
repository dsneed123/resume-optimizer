def compute_parse_confidence(data: dict) -> dict:
    """Compute per-section parse confidence from parsed resume data.

    Returns a dict mapping section names to {"confidence": "high"|"low", "notes": [str]}.
    Low confidence means key fields are missing or the parse looks incomplete.
    """
    meta = {}

    # Header
    header = data.get("header") or {}
    header_notes = []
    if not header.get("name"):
        header_notes.append("Name not detected")
    if not header.get("email"):
        header_notes.append("Email not detected")
    key_count = sum(1 for f in ("name", "email", "phone") if header.get(f))
    meta["header"] = {
        "confidence": "low" if key_count < 2 else "high",
        "notes": header_notes,
    }

    # Summary (absent is fine — many resumes omit it)
    summary = data.get("summary")
    if summary:
        short = len(summary) <= 30
        meta["summary"] = {
            "confidence": "low" if short else "high",
            "notes": ["Summary is very short"] if short else [],
        }
    else:
        meta["summary"] = {"confidence": "high", "notes": []}

    # Experience
    experience = data.get("experience") or []
    if experience:
        scores = [
            sum([
                bool(e.get("company")),
                bool(e.get("title")),
                bool(e.get("start_date")),
                bool(e.get("bullets")),
            ]) / 4.0
            for e in experience
        ]
        avg = sum(scores) / len(scores)
        notes = []
        missing_companies = sum(1 for e in experience if not e.get("company"))
        missing_dates = sum(1 for e in experience if not e.get("start_date"))
        if missing_companies:
            label = "entry" if missing_companies == 1 else "entries"
            notes.append(f"{missing_companies} {label} missing company name")
        if missing_dates:
            label = "entry" if missing_dates == 1 else "entries"
            notes.append(f"{missing_dates} {label} missing dates")
        meta["experience"] = {"confidence": "low" if avg < 0.5 else "high", "notes": notes}
    else:
        meta["experience"] = {"confidence": "high", "notes": []}

    # Education
    education = data.get("education") or []
    if education:
        scores = [
            sum([
                bool(e.get("school")),
                bool(e.get("degree")),
                bool(e.get("graduation_date")),
            ]) / 3.0
            for e in education
        ]
        avg = sum(scores) / len(scores)
        notes = []
        missing_schools = sum(1 for e in education if not e.get("school"))
        missing_degrees = sum(1 for e in education if not e.get("degree"))
        if missing_schools:
            label = "entry" if missing_schools == 1 else "entries"
            notes.append(f"{missing_schools} {label} missing school name")
        if missing_degrees:
            label = "entry" if missing_degrees == 1 else "entries"
            notes.append(f"{missing_degrees} {label} missing degree")
        meta["education"] = {"confidence": "low" if avg < 0.5 else "high", "notes": notes}
    else:
        meta["education"] = {"confidence": "high", "notes": []}

    # Skills
    skills = data.get("skills") or []
    if skills:
        total_items = sum(len(s.get("items") or []) for s in skills)
        few = total_items < 2
        meta["skills"] = {
            "confidence": "low" if few else "high",
            "notes": ["Very few skills detected"] if few else [],
        }
    else:
        meta["skills"] = {"confidence": "high", "notes": []}

    # Optional sections: certifications, projects, awards
    for section in ("certifications", "projects", "awards"):
        entries = data.get(section) or []
        if entries:
            incomplete = sum(1 for e in entries if not e.get("name"))
            label = "entry" if incomplete == 1 else "entries"
            meta[section] = {
                "confidence": "low" if incomplete > 0 else "high",
                "notes": [f"{incomplete} {label} may be incomplete"] if incomplete else [],
            }
        else:
            meta[section] = {"confidence": "high", "notes": []}

    return meta
