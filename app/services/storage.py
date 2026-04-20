import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.models import default_resume, default_typography


def _resumes_dir() -> str:
    from flask import current_app
    path = os.path.join(current_app.instance_path, 'resumes')
    os.makedirs(path, exist_ok=True)
    return path


def _resume_path(resume_id: str) -> str:
    return os.path.join(_resumes_dir(), f'{resume_id}.json')


def save_resume(resume_id: str, data: dict, typography: dict, resume_name: Optional[str] = None) -> None:
    path = _resume_path(resume_id)
    now = datetime.now(timezone.utc).isoformat()
    created_at = now
    existing_resume_name = ''
    if os.path.exists(path):
        try:
            with open(path) as f:
                existing = json.load(f)
            created_at = existing.get('created_at', now)
            if resume_name is None:
                existing_resume_name = existing.get('resume_name', '')
        except (json.JSONDecodeError, KeyError):
            pass
    payload = {
        'id': resume_id,
        'resume_name': resume_name if resume_name is not None else existing_resume_name,
        'created_at': created_at,
        'updated_at': now,
        'data': data,
        'typography': typography,
    }
    with open(path, 'w') as f:
        json.dump(payload, f, indent=2)


def load_resume(resume_id: str) -> tuple[dict, dict]:
    path = _resume_path(resume_id)
    if not os.path.exists(path):
        raise FileNotFoundError(f'Resume not found: {resume_id}')
    with open(path) as f:
        payload = json.load(f)
    return payload['data'], payload['typography']


def load_resume_full(resume_id: str) -> dict:
    path = _resume_path(resume_id)
    if not os.path.exists(path):
        raise FileNotFoundError(f'Resume not found: {resume_id}')
    with open(path) as f:
        return json.load(f)


def list_resumes() -> list[dict]:
    from app.services.page_fit import calculate_content_height
    resumes_dir = _resumes_dir()
    results = []
    for filename in os.listdir(resumes_dir):
        if not filename.endswith('.json'):
            continue
        path = os.path.join(resumes_dir, filename)
        try:
            with open(path) as f:
                payload = json.load(f)
            data = payload.get('data', {})
            typography = payload.get('typography', {})
            available_height = (
                792.0
                - typography.get('margin_top', 0.5) * 72.0
                - typography.get('margin_bottom', 0.5) * 72.0
            )
            try:
                content_height = calculate_content_height(data, typography)
                page_fill_pct = round(content_height / available_height * 100, 1) if available_height > 0 else None
            except Exception:
                page_fill_pct = None
            results.append({
                'id': payload['id'],
                'resume_name': payload.get('resume_name', ''),
                'name': data.get('header', {}).get('name', ''),
                'created_at': payload.get('created_at', ''),
                'updated_at': payload.get('updated_at', ''),
                'page_fill_pct': page_fill_pct,
            })
        except (KeyError, json.JSONDecodeError):
            continue
    results.sort(key=lambda r: r['updated_at'], reverse=True)
    return results


def delete_resume(resume_id: str) -> None:
    path = _resume_path(resume_id)
    if not os.path.exists(path):
        raise FileNotFoundError(f'Resume not found: {resume_id}')
    os.remove(path)


def create_new_resume() -> str:
    resume_id = str(uuid.uuid4())
    save_resume(resume_id, default_resume(), default_typography())
    return resume_id
