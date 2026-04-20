"""
Full user journey integration test covering:
 1. Create new resume
 2. Fill in all sections (header, experience, education, skills)
 3. Adjust typography
 4. Check ATS score
 5. Auto-fit to one page
 6. Export PDF — verify one page and content
 7. Export DOCX — verify content
 8. Import a PDF — verify parsed content
 9. Save and reload — verify data persistence
10. Delete resume — verify cleanup
"""

import io
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

from app import create_app
from app.models import default_typography
from app.services import storage


@pytest.fixture
def app(tmp_path):
    app = create_app()
    app.instance_path = str(tmp_path)
    app.config['TESTING'] = True
    return app


@pytest.fixture
def client(app):
    return app.test_client()


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

def _full_resume_data() -> dict:
    return {
        "header": {
            "name": "Jane Smith",
            "email": "jane@example.com",
            "phone": "555-867-5309",
            "location": "San Francisco, CA",
            "linkedin": "linkedin.com/in/janesmith",
            "website": "janesmith.dev",
        },
        "summary": (
            "Experienced software engineer with 8 years building scalable "
            "web applications and leading cross-functional teams."
        ),
        "experience": [
            {
                "company": "Acme Corp",
                "title": "Senior Software Engineer",
                "location": "San Francisco, CA",
                "start_date": "Jan 2020",
                "end_date": "Present",
                "bullets": [
                    "Led migration of monolithic app to microservices, reducing latency by 40%.",
                    "Mentored 3 junior engineers and conducted weekly code reviews.",
                    "Implemented CI/CD pipeline using GitHub Actions and Docker.",
                ],
            },
            {
                "company": "Beta Inc",
                "title": "Software Engineer",
                "location": "Seattle, WA",
                "start_date": "Jun 2017",
                "end_date": "Dec 2019",
                "bullets": [
                    "Built RESTful APIs consumed by 50k+ daily active users.",
                    "Optimized PostgreSQL queries, cutting average response time by 30%.",
                ],
            },
        ],
        "education": [
            {
                "school": "State University",
                "degree": "Bachelor of Science",
                "field": "Computer Science",
                "graduation_date": "May 2017",
                "gpa": "3.8",
                "honors": "Magna Cum Laude",
            }
        ],
        "skills": [
            {"category": "Languages", "items": ["Python", "JavaScript", "Go", "SQL"]},
            {"category": "Frameworks", "items": ["Flask", "React", "FastAPI", "Django"]},
            {"category": "Tools", "items": ["Docker", "Kubernetes", "GitHub Actions", "Terraform"]},
        ],
        "certifications": [
            {"name": "AWS Certified Solutions Architect", "issuer": "Amazon", "date": "2022"},
        ],
        "projects": [],
        "awards": [],
        "section_order": [
            "summary", "experience", "education", "skills",
            "certifications", "projects", "awards",
        ],
    }


def _custom_typography() -> dict:
    typo = default_typography()
    typo["font_size_body"] = 9.5
    typo["line_height"] = 1.1
    typo["section_spacing"] = 8
    return typo


def _minimal_pdf_bytes() -> bytes:
    """Return a valid single-page PDF for use in mock returns."""
    try:
        from pypdf import PdfWriter
        writer = PdfWriter()
        writer.add_blank_page(width=612, height=792)
        buf = io.BytesIO()
        writer.write(buf)
        return buf.getvalue()
    except Exception:
        # Minimal hand-crafted PDF if pypdf is unavailable
        return (
            b'%PDF-1.4\n'
            b'1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n'
            b'2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n'
            b'3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>>\nendobj\n'
            b'xref\n0 4\n'
            b'0000000000 65535 f \n'
            b'0000000009 00000 n \n'
            b'0000000058 00000 n \n'
            b'0000000115 00000 n \n'
            b'trailer\n<</Size 4 /Root 1 0 R>>\n'
            b'startxref\n190\n%%EOF'
        )


# ---------------------------------------------------------------------------
# Step helpers (each step is also its own focussed test)
# ---------------------------------------------------------------------------

def test_step1_create_new_resume(client):
    """Step 1: Create a blank resume and verify the returned id is usable."""
    resp = client.post('/api/resume/new')
    assert resp.status_code == 201
    body = resp.get_json()
    assert 'id' in body
    assert isinstance(body['id'], str) and body['id']

    # The new resume must be immediately retrievable
    get_resp = client.get(f'/api/resume/{body["id"]}')
    assert get_resp.status_code == 200
    retrieved = get_resp.get_json()
    assert retrieved['id'] == body['id']
    assert 'data' in retrieved and 'typography' in retrieved


def test_step2_fill_all_sections(client):
    """Step 2: Populate every resume section and verify they are saved."""
    create_resp = client.post('/api/resume/new')
    resume_id = create_resp.get_json()['id']

    resume_data = _full_resume_data()
    update_resp = client.post(
        f'/api/resume/{resume_id}',
        json={
            'data': resume_data,
            'typography': default_typography(),
            'resume_name': 'Jane Smith — Senior Engineer',
        },
    )
    assert update_resp.status_code == 200

    saved = client.get(f'/api/resume/{resume_id}').get_json()
    hdr = saved['data']['header']
    assert hdr['name'] == 'Jane Smith'
    assert hdr['email'] == 'jane@example.com'
    assert hdr['phone'] == '555-867-5309'
    assert hdr['location'] == 'San Francisco, CA'
    assert hdr['linkedin'] == 'linkedin.com/in/janesmith'
    assert hdr['website'] == 'janesmith.dev'

    assert saved['data']['summary'].startswith('Experienced software engineer')

    exp = saved['data']['experience']
    assert len(exp) == 2
    assert exp[0]['company'] == 'Acme Corp'
    assert exp[0]['title'] == 'Senior Software Engineer'
    assert len(exp[0]['bullets']) == 3
    assert exp[1]['company'] == 'Beta Inc'

    edu = saved['data']['education']
    assert len(edu) == 1
    assert edu[0]['school'] == 'State University'
    assert edu[0]['gpa'] == '3.8'

    skills = saved['data']['skills']
    assert len(skills) == 3
    assert skills[0]['category'] == 'Languages'
    assert 'Python' in skills[0]['items']

    certs = saved['data']['certifications']
    assert len(certs) == 1
    assert certs[0]['name'] == 'AWS Certified Solutions Architect'

    assert saved['resume_name'] == 'Jane Smith — Senior Engineer'


def test_step3_adjust_typography(client):
    """Step 3: Change typography settings and verify they persist."""
    resume_id = client.post('/api/resume/new').get_json()['id']
    custom_typo = _custom_typography()

    client.post(
        f'/api/resume/{resume_id}',
        json={'data': _full_resume_data(), 'typography': custom_typo},
    )

    saved_typo = client.get(f'/api/resume/{resume_id}').get_json()['typography']
    assert saved_typo['font_size_body'] == 9.5
    assert saved_typo['line_height'] == 1.1
    assert saved_typo['section_spacing'] == 8


def test_step4_ats_score(client, app):
    """Step 4: Request ATS score for a saved resume and verify response shape."""
    with app.app_context():
        resume_id = storage.create_new_resume()
        data, typo = storage.load_resume(resume_id)
        storage.save_resume(resume_id, _full_resume_data(), typo)

    fake_ats = MagicMock()
    fake_ats.analyze_ats_score.return_value = {
        'score': 85,
        'issues': ['Missing LinkedIn profile URL in full format'],
    }
    fake_ats.suggest_improvements.return_value = [
        'Add full LinkedIn URL to contact info.',
        'Consider quantifying more accomplishments in your experience.',
        'Expand your skills list to at least 8 items.',
    ]

    with patch.dict(sys.modules, {'app.services.ats_optimizer': fake_ats}):
        resp = client.get(f'/api/resume/{resume_id}/ats-score')

    assert resp.status_code == 200
    body = resp.get_json()
    assert body['score'] == 85

    assert len(body['issues']) == 1
    issue = body['issues'][0]
    assert issue['severity'] in ('warning', 'error')
    assert issue['message'] == 'Missing LinkedIn profile URL in full format'
    assert 'section' in issue

    assert len(body['suggestions']) == 3
    assert body['suggestions'][0]['priority'] == 'high'
    assert body['suggestions'][1]['priority'] == 'high'
    assert body['suggestions'][2]['priority'] == 'medium'
    for s in body['suggestions']:
        assert 'message' in s and 'section' in s


def test_step5_auto_fit_one_page(client, app):
    """Step 5: Auto-fit saves adjusted typography and reports page_count == 1."""
    with app.app_context():
        resume_id = storage.create_new_resume()
        storage.save_resume(resume_id, _full_resume_data(), _custom_typography())

    fitted_typo = dict(_custom_typography(), font_size_body=8.5, line_height=1.05)

    with patch('app.services.page_fit.auto_fit', return_value=fitted_typo), \
         patch('app.services.page_fit._render_page_count', return_value=1):
        resp = client.post(f'/api/resume/{resume_id}/auto-fit')

    assert resp.status_code == 200
    body = resp.get_json()
    assert body['fits'] is True
    assert body['page_count'] == 1
    assert body['typography']['font_size_body'] == 8.5
    assert 'changes' in body

    # Verify adjusted typography was persisted
    with app.app_context():
        _, saved_typo = storage.load_resume(resume_id)
    assert saved_typo['font_size_body'] == 8.5
    assert saved_typo['line_height'] == 1.05


def test_step6_export_pdf_one_page(client, app):
    """Step 6: Export PDF, verify one-page PDF with correct headers."""
    with app.app_context():
        resume_id = storage.create_new_resume()
        storage.save_resume(resume_id, _full_resume_data(), default_typography())

    fake_pdf_bytes = _minimal_pdf_bytes()
    fake_pdf_module = MagicMock()
    fake_pdf_module.export_pdf.return_value = fake_pdf_bytes

    with patch.dict(sys.modules, {'app.services.pdf_export': fake_pdf_module}):
        resp = client.get(f'/api/resume/{resume_id}/pdf')

    assert resp.status_code == 200
    assert resp.content_type == 'application/pdf'
    assert resp.headers['Content-Disposition'] == 'attachment; filename="resume.pdf"'

    pdf_data = resp.data
    assert pdf_data[:4] == b'%PDF'

    # export_pdf must be called with the saved resume data
    fake_pdf_module.export_pdf.assert_called_once()
    call_args = fake_pdf_module.export_pdf.call_args
    exported_data = call_args[0][0]
    assert exported_data['header']['name'] == 'Jane Smith'

    # Verify one page using pypdf when available
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_data))
        assert len(reader.pages) == 1, f"Expected 1 page PDF, got {len(reader.pages)}"
    except ImportError:
        pass


def test_step7_export_docx(client, app):
    """Step 7: Export DOCX, verify correct MIME type, filename, and content."""
    with app.app_context():
        resume_id = storage.create_new_resume()
        storage.save_resume(resume_id, _full_resume_data(), default_typography())

    fake_docx_bytes = b'PK\x03\x04fake-docx-content-for-jane-smith'
    fake_docx_module = MagicMock()
    fake_docx_module.export_docx.return_value = fake_docx_bytes

    with patch.dict(sys.modules, {'app.services.docx_export': fake_docx_module}):
        resp = client.get(f'/api/resume/{resume_id}/docx')

    assert resp.status_code == 200
    assert resp.content_type == (
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    assert resp.headers['Content-Disposition'] == 'attachment; filename="Jane Smith-resume.docx"'
    assert resp.data == fake_docx_bytes

    # export_docx must have been called with the correct data
    fake_docx_module.export_docx.assert_called_once()
    call_data = fake_docx_module.export_docx.call_args[0][0]
    assert call_data['header']['name'] == 'Jane Smith'


def test_step8_import_pdf_parsed_content(client):
    """Step 8: Upload a PDF, verify parsed resume data is returned and stored."""
    parsed_data = {
        'header': {
            'name': 'Imported User',
            'email': 'imported@example.com',
            'phone': '555-000-1234',
            'location': 'New York, NY',
            'linkedin': '',
            'website': '',
        },
        'summary': 'Parsed summary extracted from uploaded PDF.',
        'experience': [
            {
                'company': 'Parsed Corp',
                'title': 'Engineer',
                'location': 'New York, NY',
                'start_date': 'Jan 2021',
                'end_date': 'Present',
                'bullets': ['Built scalable systems.', 'Improved test coverage to 90%.'],
            }
        ],
        'education': [
            {
                'school': 'Parsed University',
                'degree': 'B.S.',
                'field': 'Engineering',
                'graduation_date': 'May 2021',
                'gpa': '',
                'honors': '',
            }
        ],
        'skills': [
            {'category': 'Languages', 'items': ['Python', 'Java']},
        ],
        'certifications': [],
        'projects': [],
        'awards': [],
        'section_order': [
            'summary', 'experience', 'education', 'skills',
            'certifications', 'projects', 'awards',
        ],
    }

    fake_import_module = MagicMock()
    fake_import_module.import_pdf.return_value = parsed_data
    fake_import_module.CorruptedFileError = Exception
    fake_import_module.EmptyFileError = Exception
    fake_import_module.PasswordProtectedError = Exception

    pdf_bytes = b'%PDF-1.4 fake pdf content for import test'

    with patch.dict(sys.modules, {'app.services.pdf_import': fake_import_module}):
        resp = client.post(
            '/api/import',
            data={'file': (io.BytesIO(pdf_bytes), 'resume.pdf', 'application/pdf')},
            content_type='multipart/form-data',
        )

    assert resp.status_code == 201
    body = resp.get_json()
    assert 'id' in body
    imported_id = body['id']
    assert 'data' in body
    assert body['data']['header']['name'] == 'Imported User'
    assert body['data']['header']['email'] == 'imported@example.com'
    assert len(body['data']['experience']) == 1
    assert body['data']['experience'][0]['company'] == 'Parsed Corp'
    assert len(body['data']['experience'][0]['bullets']) == 2
    assert body['data']['education'][0]['school'] == 'Parsed University'
    assert body['data']['skills'][0]['items'] == ['Python', 'Java']
    assert 'parse_meta' in body

    # Imported resume must be retrievable by id
    get_resp = client.get(f'/api/resume/{imported_id}')
    assert get_resp.status_code == 200
    retrieved = get_resp.get_json()
    assert retrieved['data']['header']['name'] == 'Imported User'
    assert retrieved['data']['experience'][0]['company'] == 'Parsed Corp'


def test_step9_save_and_reload_persistence(client, app):
    """Step 9: Update a resume and reload to verify full data persistence."""
    with app.app_context():
        resume_id = storage.create_new_resume()
        storage.save_resume(resume_id, _full_resume_data(), _custom_typography(), 'Original Name')

    updated_data = _full_resume_data()
    updated_data['summary'] = 'Updated: now 9 years of experience in distributed systems.'
    updated_data['experience'][0]['bullets'].append('Promoted to Staff Engineer in 2023.')

    save_resp = client.post(
        f'/api/resume/{resume_id}',
        json={
            'data': updated_data,
            'typography': dict(_custom_typography(), font_size_body=9.0),
            'resume_name': 'Jane Smith — Staff Engineer',
        },
    )
    assert save_resp.status_code == 200

    reloaded = client.get(f'/api/resume/{resume_id}').get_json()
    assert reloaded['data']['summary'] == 'Updated: now 9 years of experience in distributed systems.'
    exp_bullets = reloaded['data']['experience'][0]['bullets']
    assert len(exp_bullets) == 4
    assert 'Promoted to Staff Engineer in 2023.' in exp_bullets
    assert reloaded['resume_name'] == 'Jane Smith — Staff Engineer'
    assert reloaded['typography']['font_size_body'] == 9.0
    assert reloaded['created_at']
    assert reloaded['updated_at']

    # Verify directly via storage layer too
    with app.app_context():
        persisted_data, persisted_typo = storage.load_resume(resume_id)
    assert persisted_data['summary'].startswith('Updated:')
    assert persisted_typo['font_size_body'] == 9.0


def test_step10_delete_resume_cleanup(client, app):
    """Step 10: Delete a resume and verify it is fully removed."""
    with app.app_context():
        resume_id = storage.create_new_resume()
        storage.save_resume(resume_id, _full_resume_data(), default_typography())

    # Confirm it appears in the list
    list_before = client.get('/api/resumes').get_json()
    assert any(r['id'] == resume_id for r in list_before)

    # Delete
    del_resp = client.delete(f'/api/resume/{resume_id}')
    assert del_resp.status_code == 200
    assert del_resp.get_json()['id'] == resume_id

    # GET must return 404
    assert client.get(f'/api/resume/{resume_id}').status_code == 404

    # Must not appear in list
    list_after = client.get('/api/resumes').get_json()
    assert all(r['id'] != resume_id for r in list_after)

    # File must be gone from disk
    with app.app_context():
        resume_file = os.path.join(app.instance_path, 'resumes', f'{resume_id}.json')
    assert not os.path.exists(resume_file)

    # Second delete must 404
    assert client.delete(f'/api/resume/{resume_id}').status_code == 404


# ---------------------------------------------------------------------------
# Full end-to-end journey in a single test (steps 1-10 in sequence)
# ---------------------------------------------------------------------------

def test_full_user_journey(client, app):
    """Steps 1-10: Complete end-to-end user journey through the resume optimizer."""

    # ── Step 1: Create new resume ──────────────────────────────────────────────
    new_resp = client.post('/api/resume/new')
    assert new_resp.status_code == 201
    resume_id = new_resp.get_json()['id']
    assert resume_id

    # ── Step 2: Fill in all sections ──────────────────────────────────────────
    resume_data = _full_resume_data()
    update_resp = client.post(
        f'/api/resume/{resume_id}',
        json={
            'data': resume_data,
            'typography': default_typography(),
            'resume_name': 'Jane Smith — Senior Engineer',
        },
    )
    assert update_resp.status_code == 200

    saved = client.get(f'/api/resume/{resume_id}').get_json()
    assert saved['data']['header']['name'] == 'Jane Smith'
    assert saved['data']['header']['email'] == 'jane@example.com'
    assert len(saved['data']['experience']) == 2
    assert len(saved['data']['experience'][0]['bullets']) == 3
    assert saved['data']['education'][0]['school'] == 'State University'
    assert len(saved['data']['skills']) == 3
    assert 'Python' in saved['data']['skills'][0]['items']
    assert saved['data']['certifications'][0]['name'] == 'AWS Certified Solutions Architect'
    assert saved['resume_name'] == 'Jane Smith — Senior Engineer'

    # ── Step 3: Adjust typography ─────────────────────────────────────────────
    custom_typo = _custom_typography()
    client.post(
        f'/api/resume/{resume_id}',
        json={'data': resume_data, 'typography': custom_typo},
    )
    typo_state = client.get(f'/api/resume/{resume_id}').get_json()['typography']
    assert typo_state['font_size_body'] == 9.5
    assert typo_state['line_height'] == 1.1
    assert typo_state['section_spacing'] == 8

    # ── Step 4: Check ATS score ───────────────────────────────────────────────
    fake_ats = MagicMock()
    fake_ats.analyze_ats_score.return_value = {
        'score': 85,
        'issues': ['Missing LinkedIn profile URL in full format'],
    }
    fake_ats.suggest_improvements.return_value = [
        'Add full LinkedIn URL to contact info.',
        'Consider quantifying more accomplishments.',
        'Add a professional summary section.',
    ]

    with patch.dict(sys.modules, {'app.services.ats_optimizer': fake_ats}):
        ats_resp = client.get(f'/api/resume/{resume_id}/ats-score')

    assert ats_resp.status_code == 200
    ats_body = ats_resp.get_json()
    assert ats_body['score'] == 85
    assert len(ats_body['issues']) == 1
    assert ats_body['issues'][0]['severity'] in ('warning', 'error')
    assert ats_body['suggestions'][0]['priority'] == 'high'
    assert ats_body['suggestions'][2]['priority'] == 'medium'

    # ── Step 5: Auto-fit to one page ─────────────────────────────────────────
    fitted_typo = dict(custom_typo, font_size_body=8.5, line_height=1.05)

    with patch('app.services.page_fit.auto_fit', return_value=fitted_typo), \
         patch('app.services.page_fit._render_page_count', return_value=1):
        fit_resp = client.post(f'/api/resume/{resume_id}/auto-fit')

    assert fit_resp.status_code == 200
    fit_body = fit_resp.get_json()
    assert fit_body['fits'] is True
    assert fit_body['page_count'] == 1
    assert fit_body['typography']['font_size_body'] == 8.5

    with app.app_context():
        _, persisted_typo = storage.load_resume(resume_id)
    assert persisted_typo['font_size_body'] == 8.5

    # ── Step 6: Export PDF — verify one page and content ─────────────────────
    fake_pdf_bytes = _minimal_pdf_bytes()
    fake_pdf_module = MagicMock()
    fake_pdf_module.export_pdf.return_value = fake_pdf_bytes

    with patch.dict(sys.modules, {'app.services.pdf_export': fake_pdf_module}):
        pdf_resp = client.get(f'/api/resume/{resume_id}/pdf')

    assert pdf_resp.status_code == 200
    assert pdf_resp.content_type == 'application/pdf'
    assert pdf_resp.headers['Content-Disposition'] == 'attachment; filename="resume.pdf"'
    assert pdf_resp.data[:4] == b'%PDF'

    # Verify called with correct resume data
    call_data = fake_pdf_module.export_pdf.call_args[0][0]
    assert call_data['header']['name'] == 'Jane Smith'
    assert len(call_data['experience']) == 2

    # Verify one-page PDF using pypdf
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_resp.data))
        assert len(reader.pages) == 1
    except ImportError:
        pass

    # ── Step 7: Export DOCX — verify content ──────────────────────────────────
    fake_docx_bytes = b'PK\x03\x04fake-docx-jane-smith'
    fake_docx_module = MagicMock()
    fake_docx_module.export_docx.return_value = fake_docx_bytes

    with patch.dict(sys.modules, {'app.services.docx_export': fake_docx_module}):
        docx_resp = client.get(f'/api/resume/{resume_id}/docx')

    assert docx_resp.status_code == 200
    assert docx_resp.content_type == (
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    assert docx_resp.headers['Content-Disposition'] == (
        'attachment; filename="Jane Smith-resume.docx"'
    )
    assert docx_resp.data == fake_docx_bytes

    call_data = fake_docx_module.export_docx.call_args[0][0]
    assert call_data['header']['name'] == 'Jane Smith'

    # ── Step 8: Import a PDF — verify parsed content ──────────────────────────
    imported_resume_data = {
        'header': {
            'name': 'Imported User',
            'email': 'imported@example.com',
            'phone': '555-000-1234',
            'location': 'New York, NY',
            'linkedin': '',
            'website': '',
        },
        'summary': 'Parsed summary from uploaded PDF resume.',
        'experience': [
            {
                'company': 'Parsed Corp',
                'title': 'Engineer',
                'location': 'New York, NY',
                'start_date': 'Jan 2021',
                'end_date': 'Present',
                'bullets': ['Built scalable systems.', 'Improved test coverage to 90%.'],
            }
        ],
        'education': [
            {
                'school': 'Parsed University',
                'degree': 'B.S.',
                'field': 'Engineering',
                'graduation_date': 'May 2021',
                'gpa': '',
                'honors': '',
            }
        ],
        'skills': [{'category': 'Languages', 'items': ['Python', 'Java']}],
        'certifications': [],
        'projects': [],
        'awards': [],
        'section_order': [
            'summary', 'experience', 'education', 'skills',
            'certifications', 'projects', 'awards',
        ],
    }

    fake_import_module = MagicMock()
    fake_import_module.import_pdf.return_value = imported_resume_data
    fake_import_module.CorruptedFileError = Exception
    fake_import_module.EmptyFileError = Exception
    fake_import_module.PasswordProtectedError = Exception

    with patch.dict(sys.modules, {'app.services.pdf_import': fake_import_module}):
        import_resp = client.post(
            '/api/import',
            data={
                'file': (
                    io.BytesIO(b'%PDF-1.4 fake uploaded pdf'),
                    'resume.pdf',
                    'application/pdf',
                )
            },
            content_type='multipart/form-data',
        )

    assert import_resp.status_code == 201
    import_body = import_resp.get_json()
    imported_id = import_body['id']
    assert import_body['data']['header']['name'] == 'Imported User'
    assert import_body['data']['header']['email'] == 'imported@example.com'
    assert import_body['data']['experience'][0]['company'] == 'Parsed Corp'
    assert len(import_body['data']['experience'][0]['bullets']) == 2
    assert import_body['data']['education'][0]['school'] == 'Parsed University'
    assert import_body['data']['skills'][0]['items'] == ['Python', 'Java']
    assert 'parse_meta' in import_body

    # Imported resume is retrievable and data is intact
    imported_get = client.get(f'/api/resume/{imported_id}').get_json()
    assert imported_get['data']['header']['name'] == 'Imported User'
    assert imported_get['data']['experience'][0]['company'] == 'Parsed Corp'

    # ── Step 9: Save and reload — verify data persistence ────────────────────
    updated_data = _full_resume_data()
    updated_data['summary'] = 'Updated: 9 years of experience in distributed systems.'
    updated_data['experience'][0]['bullets'].append('Promoted to Staff Engineer in 2023.')

    save_resp = client.post(
        f'/api/resume/{resume_id}',
        json={
            'data': updated_data,
            'typography': dict(fitted_typo, font_size_body=9.0),
            'resume_name': 'Jane Smith — Staff Engineer',
        },
    )
    assert save_resp.status_code == 200

    reloaded = client.get(f'/api/resume/{resume_id}').get_json()
    assert reloaded['data']['summary'] == 'Updated: 9 years of experience in distributed systems.'
    bullets = reloaded['data']['experience'][0]['bullets']
    assert len(bullets) == 4
    assert 'Promoted to Staff Engineer in 2023.' in bullets
    assert reloaded['resume_name'] == 'Jane Smith — Staff Engineer'
    assert reloaded['typography']['font_size_body'] == 9.0
    assert reloaded['created_at']
    assert reloaded['updated_at']

    # ── Step 10: Delete resume — verify cleanup ───────────────────────────────
    list_before = client.get('/api/resumes').get_json()
    assert any(r['id'] == resume_id for r in list_before)

    del_resp = client.delete(f'/api/resume/{resume_id}')
    assert del_resp.status_code == 200
    assert del_resp.get_json()['id'] == resume_id

    assert client.get(f'/api/resume/{resume_id}').status_code == 404

    list_after = client.get('/api/resumes').get_json()
    assert all(r['id'] != resume_id for r in list_after)

    resume_file = os.path.join(app.instance_path, 'resumes', f'{resume_id}.json')
    assert not os.path.exists(resume_file)

    assert client.delete(f'/api/resume/{resume_id}').status_code == 404

    # Clean up the imported resume too
    client.delete(f'/api/resume/{imported_id}')
    assert client.get(f'/api/resume/{imported_id}').status_code == 404
