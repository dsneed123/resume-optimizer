"""Keyword-based job description matching for resume optimization."""
from __future__ import annotations

import re

_STOP_WORDS = frozenset({
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
    'need', 'not', 'no', 'nor', 'so', 'yet', 'each', 'every', 'all', 'any',
    'few', 'more', 'most', 'other', 'some', 'such', 'than', 'too', 'very',
    'just', 'our', 'we', 'you', 'they', 'he', 'she', 'it', 'its', 'their',
    'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'how',
    'when', 'where', 'why', 'about', 'above', 'after', 'also', 'between',
    'during', 'into', 'through', 'up', 'out', 'well', 'including', 'related',
    'using', 'use', 'experience', 'knowledge', 'ability', 'proficiency',
    'strong', 'excellent', 'good', 'great', 'highly', 'team', 'position',
    'role', 'job', 'candidate', 'require', 'required', 'preferred', 'plus',
    'etc', 'ie', 'eg', 'join', 'help', 'make', 'build', 'develop', 'create',
    'manage', 'support', 'provide', 'ensure', 'implement', 'maintain',
    'design', 'lead', 'drive', 'grow', 'improve', 'deliver', 'collaborate',
    'partner', 'communicate', 'present', 'responsible', 'responsibilities',
    'opportunity', 'company', 'organization', 'business', 'industry',
    'looking', 'seeking', 'ideal', 'qualified', 'minimum', 'years', 'year',
    'months', 'month', 'environment', 'startup', 'detail', 'oriented',
    'skills', 'work', 'working', 'like', 'include', 'within', 'across',
    'new', 'high', 'large', 'small', 'key', 'major', 'multiple', 'various',
    'both', 'either', 'own', 'same', 'different', 'specific', 'general',
    'following', 'able', 'ability', 'need', 'take', 'get', 'set', 'run',
    'help', 'know', 'understand', 'learn', 'grow', 'team', 'teams',
})

# Multi-word technical phrases to detect before splitting
_MULTI_WORD_PHRASES = [
    'machine learning', 'deep learning', 'natural language processing',
    'computer vision', 'data science', 'data engineering', 'data analysis',
    'data analytics', 'big data', 'cloud computing', 'software development',
    'software engineering', 'web development', 'mobile development',
    'full stack', 'full-stack', 'front end', 'front-end', 'back end',
    'back-end', 'continuous integration', 'continuous deployment',
    'continuous delivery', 'ci/cd', 'version control', 'source control',
    'test driven development', 'test-driven development', 'agile methodology',
    'scrum methodology', 'project management', 'product management',
    'cross-functional', 'cross functional', 'object oriented',
    'object-oriented', 'rest api', 'restful api', 'graphql api',
    'microservices architecture', 'distributed systems', 'system design',
    'database design', 'data modeling', 'react native', 'node.js', 'next.js',
    'vue.js', 'express.js', 'spring boot', 'asp.net', '.net core',
    'amazon web services', 'google cloud platform', 'google cloud',
    'microsoft azure', 'azure devops', 'github actions',
]

_MIN_KEYWORD_LEN = 2

_SKILL_TERMS = frozenset({
    'python', 'java', 'javascript', 'typescript', 'golang', 'rust', 'c++',
    'c#', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'sql', 'bash',
    'html', 'css', 'react', 'angular', 'vue', 'django', 'flask', 'fastapi',
    'spring', 'rails', 'laravel', 'tensorflow', 'pytorch', 'keras', 'pandas',
    'numpy', 'scikit-learn', 'docker', 'kubernetes', 'terraform', 'ansible',
    'jenkins', 'git', 'github', 'gitlab', 'aws', 'azure', 'gcp', 'linux',
    'unix', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch',
    'kafka', 'spark', 'hadoop', 'airflow', 'tableau', 'powerbi', 'excel',
    'jira', 'confluence', 'figma', 'devops', 'nlp', 'api', 'sdk', 'cli',
    'machine learning', 'deep learning', 'ci/cd', 'rest api', 'graphql api',
    'microservices architecture', 'full-stack', 'full stack',
    'natural language processing', 'computer vision', 'data science',
    'data engineering', 'node.js', 'next.js', 'vue.js', 'spring boot',
    'amazon web services', 'google cloud', 'microsoft azure',
})

_SOFT_SKILL_TERMS = frozenset({
    'leadership', 'communication', 'collaboration', 'teamwork', 'mentoring',
    'problem-solving', 'analytical', 'strategic', 'presentation',
    'negotiation', 'adaptability', 'initiative', 'creativity', 'innovation',
    'detail-oriented', 'time management', 'multitasking', 'prioritization',
})


def _extract_resume_text(resume_data: dict) -> dict[str, str]:
    """Collect text from each resume section, keyed by section name."""
    sections: dict[str, list[str]] = {
        'summary': [],
        'skills': [],
        'experience': [],
        'education': [],
        'projects': [],
        'certifications': [],
    }

    summary = resume_data.get('summary') or ''
    if isinstance(summary, str):
        sections['summary'].append(summary)

    for skill_group in resume_data.get('skills', []):
        if not isinstance(skill_group, dict):
            continue
        items = skill_group.get('items', [])
        if isinstance(items, list):
            sections['skills'].extend(str(i) for i in items if i)

    for exp in resume_data.get('experience', []):
        if not isinstance(exp, dict):
            continue
        title = exp.get('title') or ''
        if title:
            sections['experience'].append(title)
        for bullet in exp.get('bullets', []):
            if isinstance(bullet, str) and bullet.strip():
                sections['experience'].append(bullet)

    for edu in resume_data.get('education', []):
        if not isinstance(edu, dict):
            continue
        for field in ('degree', 'field', 'school'):
            val = edu.get(field) or ''
            if val:
                sections['education'].append(val)

    for proj in resume_data.get('projects', []):
        if not isinstance(proj, dict):
            continue
        desc = proj.get('description') or ''
        tech = proj.get('technologies') or ''
        if desc:
            sections['projects'].append(desc)
        if tech:
            sections['projects'].append(tech)

    for cert in resume_data.get('certifications', []):
        if not isinstance(cert, dict):
            continue
        name = cert.get('name') or ''
        if name:
            sections['certifications'].append(name)

    return {k: ' '.join(v) for k, v in sections.items()}


def _extract_keywords(text: str) -> list[str]:
    """Extract meaningful keywords from text; multi-word phrases take priority."""
    text_lower = text.lower()
    found_phrases: list[str] = []
    remaining = text_lower

    for phrase in _MULTI_WORD_PHRASES:
        if phrase in text_lower:
            found_phrases.append(phrase)
            remaining = remaining.replace(phrase, ' ')

    cleaned = re.sub(r'[^\w\s\-\./]', ' ', remaining)
    unigrams: list[str] = []
    for tok in cleaned.split():
        tok = tok.strip('-').strip('.')
        tok_lower = tok.lower()
        if (
            len(tok_lower) >= _MIN_KEYWORD_LEN
            and tok_lower not in _STOP_WORDS
            and not tok_lower.isdigit()
            and not re.match(r'^\d+[\.\-]\d*$', tok_lower)
        ):
            unigrams.append(tok_lower)

    seen: set[str] = set()
    result: list[str] = []
    for kw in found_phrases + unigrams:
        if kw not in seen:
            seen.add(kw)
            result.append(kw)
    return result


def _keyword_in_text(keyword: str, text: str) -> bool:
    """Case-insensitive match; uses word boundaries for single-word keywords."""
    text_lower = text.lower()
    if ' ' in keyword or '/' in keyword:
        return keyword in text_lower
    pattern = r'\b' + re.escape(keyword) + r'\b'
    return bool(re.search(pattern, text_lower))


def _suggest_section(keyword: str) -> str:
    """Suggest where in the resume to add a missing keyword."""
    kw_lower = keyword.lower()
    if kw_lower in _SKILL_TERMS:
        return 'Add to your Skills section.'
    if kw_lower in _SOFT_SKILL_TERMS:
        return 'Mention in your Summary or experience bullets.'
    return 'Consider adding to your Skills section or an experience bullet.'


def analyze_job_match(resume_data: dict, job_description: str) -> dict:
    """
    Compare resume content against job description keywords.

    Returns a dict with:
        match_percentage: int 0-100
        matched_keywords: list of {keyword, locations}
        missing_keywords: list of {keyword, suggestion}
    """
    if not isinstance(job_description, str) or not job_description.strip():
        return {'match_percentage': 0, 'matched_keywords': [], 'missing_keywords': []}

    jd_keywords = _extract_keywords(job_description)
    if not jd_keywords:
        return {'match_percentage': 0, 'matched_keywords': [], 'missing_keywords': []}

    resume_sections = _extract_resume_text(resume_data)
    matched: list[dict] = []
    missing: list[dict] = []

    for keyword in jd_keywords:
        locations = [
            section
            for section, text in resume_sections.items()
            if text and _keyword_in_text(keyword, text)
        ]
        if locations:
            matched.append({'keyword': keyword, 'locations': locations})
        else:
            missing.append({'keyword': keyword, 'suggestion': _suggest_section(keyword)})

    total = len(jd_keywords)
    match_percentage = round(len(matched) / total * 100) if total > 0 else 0

    return {
        'match_percentage': match_percentage,
        'matched_keywords': matched,
        'missing_keywords': missing,
    }
