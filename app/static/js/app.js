// Resume Optimizer — main app entry point

(function () {
    // ── Sidebar toggle (mobile) ──────────────────
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const toggleBtn = document.getElementById('sidebarToggle');

    function openSidebar() {
        sidebar.classList.add('open');
        overlay.classList.add('open');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
    }

    if (toggleBtn) toggleBtn.addEventListener('click', openSidebar);
    if (overlay) overlay.addEventListener('click', closeSidebar);

    // ── Section tab navigation (dynamic — see renderSidebarNav below) ───

    // ── ResumePreview ────────────────────────────
    class ResumePreview {
        constructor(pageEl, previewEl) {
            this.page = pageEl;
            this.preview = previewEl;
            this.data = null;
            this.typo = null;

            // Inject a dedicated <style> element for typography
            this._styleEl = document.createElement('style');
            this._styleEl.id = 'rv-typo-style';
            document.head.appendChild(this._styleEl);

            this._ro = new ResizeObserver(() => this._applyScale());
            this._ro.observe(this.preview);
        }

        update(data, typo) {
            this.data = data;
            this.typo = typo;
            this._applyTypography();
            this._render();
            this._applyScale();
        }

        _applyTypography() {
            const t = this.typo;
            const layout = t.header_layout || 'centered';
            const dividerStyle = t.section_divider_style || 'thin';
            const headerRuleBorder = {
                thin:   'border-top: 1pt solid #000;',
                thick:  'border-top: 2.5pt solid #000;',
                double: 'border-top: 3pt double #000;',
                none:   'border: none;',
            }[dividerStyle] || 'border-top: 1pt solid #000;';
            const sectionTitleBorder = {
                thin:   'border-bottom: 0.5pt solid #000;',
                thick:  'border-bottom: 2pt solid #000;',
                double: 'border-bottom: 3pt double #000;',
                none:   'border: none;',
            }[dividerStyle] || 'border-bottom: 0.5pt solid #000;';
            const headerLayoutCSS = layout === 'left-aligned'
                ? 'display: flex; justify-content: space-between; align-items: baseline;'
                : layout === 'two-line'
                ? 'text-align: left;'
                : 'text-align: center;';
            this._styleEl.textContent = `
                #resumePage {
                    padding: ${t.margin_top}in ${t.margin_right}in ${t.margin_bottom}in ${t.margin_left}in;
                    font-family: ${t.font_family}, Arial, sans-serif;
                    font-size: ${t.font_size_body}pt;
                    line-height: ${t.line_height};
                    color: #000;
                }
                #resumePage .rv-header {
                    ${headerLayoutCSS}
                    margin-bottom: 4pt;
                }
                #resumePage .rv-name {
                    font-size: ${t.font_size_name}pt;
                    font-weight: bold;
                    line-height: 1;
                    margin-bottom: 3pt;
                }
                #resumePage .rv-contact {
                    font-size: ${t.font_size_detail}pt;
                    color: #333;
                }
                #resumePage .rv-contact span + span::before {
                    content: "${{'pipe': ' | ', 'dot': ' \u00b7 ', 'diamond': ' \u25c6 ', 'dash': ' \u2013 '}[t.contact_separator || 'pipe']}";
                    color: #999;
                }
                #resumePage .rv-header-rule {
                    border: none;
                    ${headerRuleBorder}
                    margin-top: 5pt;
                    margin-bottom: ${t.section_spacing}pt;
                }
                #resumePage .rv-section {
                    margin-bottom: ${t.section_spacing}pt;
                }
                #resumePage .rv-section-title {
                    font-size: ${t.font_size_section_header}pt;
                    font-weight: bold;
                    text-transform: uppercase;
                    letter-spacing: 0.5pt;
                    ${sectionTitleBorder}
                    padding-bottom: 1pt;
                    margin-bottom: 4pt;
                }
                #resumePage .rv-summary {
                    font-size: ${t.font_size_body}pt;
                    line-height: ${t.line_height};
                }
                #resumePage .rv-entry {
                    margin-bottom: ${t.paragraph_spacing}pt;
                }
                #resumePage .rv-entry-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                }
                #resumePage .rv-entry-left {
                    font-size: ${t.font_size_body}pt;
                    flex: 1;
                    min-width: 0;
                }
                #resumePage .rv-entry-title {
                    font-weight: bold;
                }
                #resumePage .rv-entry-date {
                    font-size: ${t.font_size_detail}pt;
                    color: #444;
                    white-space: nowrap;
                    margin-left: 6pt;
                }
                #resumePage .rv-entry-sub {
                    font-size: ${t.font_size_detail}pt;
                    color: #444;
                    margin-bottom: 2pt;
                }
                #resumePage .rv-bullets {
                    list-style: none;
                    padding-left: ${t.bullet_indent}pt;
                    margin-top: 2pt;
                    margin-bottom: 0;
                }
                #resumePage .rv-bullets li {
                    font-size: ${t.font_size_body}pt;
                    line-height: ${t.line_height};
                    margin-bottom: ${t.paragraph_spacing / 2}pt;
                    padding-left: 1em;
                    text-indent: -1em;
                }
                #resumePage .rv-bullets li::before {
                    content: "${{'filled': '\u2022', 'open': '\u25e6', 'dash': '\u2013', 'none': ''}[t.bullet_style || 'filled']}";
                    display: inline-block;
                    width: 1em;
                }
                #resumePage .rv-skills-grid {
                    font-size: ${t.font_size_body}pt;
                    line-height: ${t.line_height};
                }
                #resumePage .rv-skill-cat {
                    font-weight: bold;
                }
                #resumePage .rv-skill-row {
                    margin-bottom: 2pt;
                }
                #resumePage .rv-skills-columns {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0 12pt;
                }
                #resumePage .rv-skill-col {
                    margin-bottom: 2pt;
                }
                #resumePage .rv-skill-item {
                    font-size: ${t.font_size_body}pt;
                    line-height: ${t.line_height};
                }
                #resumePage .rv-skills-tags .rv-skill-row {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: baseline;
                    gap: 3pt;
                    margin-bottom: 4pt;
                }
                #resumePage .rv-skill-tag {
                    display: inline-block;
                    border: 0.5pt solid #888;
                    border-radius: 3pt;
                    padding: 0.5pt 4pt;
                    font-size: ${t.font_size_detail}pt;
                    line-height: 1.4;
                    white-space: nowrap;
                }
                #resumePage .rv-cert {
                    margin-bottom: ${t.paragraph_spacing}pt;
                }
                #resumePage .rv-cert-name {
                    font-weight: bold;
                    font-size: ${t.font_size_body}pt;
                }
                #resumePage .rv-cert-meta {
                    font-size: ${t.font_size_detail}pt;
                    color: #444;
                }
            `;
        }

        _applyScale() {
            const PAGE_W = 816;
            const available = this.preview.clientWidth - 64; // 32px padding each side
            const s = (available > 0 && available < PAGE_W) ? available / PAGE_W : 1;

            if (s < 1) {
                this.page.style.transform = `scale(${s.toFixed(4)})`;
                this.page.style.transformOrigin = 'top center';
                // Shrink layout footprint to match visual size
                const h = this.page.offsetHeight;
                this.page.style.marginBottom = `${Math.round(h * (s - 1))}px`;
            } else {
                this.page.style.transform = '';
                this.page.style.transformOrigin = '';
                this.page.style.marginBottom = '';
            }
        }

        _esc(str) {
            return String(str || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        _renderInlineMd(str) {
            const escaped = this._esc(str);
            return escaped
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>');
        }

        _formatDate(dateStr, fmt) {
            if (!dateStr) return dateStr;
            const s = dateStr.trim();
            if (!s || s.toLowerCase() === 'present') return s;
            const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
            const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            let month = null;
            let year = null;
            for (let i = 0; i < MONTHS_FULL.length; i++) {
                if (s.toLowerCase().startsWith(MONTHS_FULL[i].toLowerCase()) ||
                    s.toLowerCase().startsWith(MONTHS_SHORT[i].toLowerCase())) {
                    month = i + 1;
                    const rest = s.replace(/^[A-Za-z]+\s*/, '');
                    year = parseInt(rest, 10) || null;
                    break;
                }
            }
            if (!month) {
                let m;
                m = s.match(/^(\d{1,2})\/(\d{4})$/);
                if (m) { month = parseInt(m[1], 10); year = parseInt(m[2], 10); }
                if (!month) { m = s.match(/^(\d{4})-(\d{2})$/); if (m) { year = parseInt(m[1], 10); month = parseInt(m[2], 10); } }
                if (!month) { m = s.match(/^(\d{4})$/); if (m) { year = parseInt(m[1], 10); } }
            }
            if (!year) return s;
            switch (fmt) {
                case 'MMM YYYY':  return month ? MONTHS_SHORT[month - 1] + ' ' + year : String(year);
                case 'MMMM YYYY': return month ? MONTHS_FULL[month - 1] + ' ' + year : String(year);
                case 'MM/YYYY':   return month ? String(month).padStart(2, '0') + '/' + year : String(year);
                case 'YYYY':      return String(year);
                default:          return s;
            }
        }

        _renderSummaryHtml(d) {
            if (!d.summary || d.show_summary === false) return '';
            return '<div class="rv-section">' +
                '<div class="rv-section-title">Summary</div>' +
                `<div class="rv-summary">${this._esc(d.summary)}</div>` +
                '</div>';
        }

        _renderExperienceHtml(d) {
            if (d.show_experience === false) return '';
            const exp = (d.experience || []).filter(e => e.company || e.title);
            if (!exp.length) return '';
            let html = '<div class="rv-section"><div class="rv-section-title">Experience</div>';
            for (const e of exp) {
                html += '<div class="rv-entry"><div class="rv-entry-header">';
                html += `<span class="rv-entry-left"><span class="rv-entry-title">${this._esc(e.title)}</span>`;
                if (e.company) html += ` | ${this._esc(e.company)}`;
                if (e.location) html += ` \u00b7 ${this._esc(e.location)}`;
                html += '</span>';
                const fmt = (this.typo && this.typo.date_format) || 'MMM YYYY';
                const dates = [e.start_date, e.end_date].filter(Boolean).map(d => this._formatDate(d, fmt)).join(' \u2013 ');
                if (dates) html += `<span class="rv-entry-date">${this._esc(dates)}</span>`;
                html += '</div>';
                if (e.bullets && e.bullets.length) {
                    html += '<ul class="rv-bullets">';
                    for (const b of e.bullets) html += `<li>${this._renderInlineMd(b)}</li>`;
                    html += '</ul>';
                }
                html += '</div>';
            }
            return html + '</div>';
        }

        _renderEducationHtml(d) {
            if (d.show_education === false) return '';
            const edu = (d.education || []).filter(e => e.school);
            if (!edu.length) return '';
            let html = '<div class="rv-section"><div class="rv-section-title">Education</div>';
            for (const e of edu) {
                html += '<div class="rv-entry"><div class="rv-entry-header">';
                html += `<span class="rv-entry-left"><span class="rv-entry-title">${this._esc(e.school)}</span>`;
                if (e.degree) html += ` \u00b7 ${this._esc(e.degree)}`;
                if (e.field) html += `, ${this._esc(e.field)}`;
                html += '</span>';
                if (e.graduation_date) { const fmt2 = (this.typo && this.typo.date_format) || 'MMM YYYY'; html += `<span class="rv-entry-date">${this._esc(this._formatDate(e.graduation_date, fmt2))}</span>`; }
                html += '</div>';
                if (e.gpa || e.honors) {
                    let sub = '';
                    if (e.gpa) sub += `GPA: ${this._esc(e.gpa)}`;
                    if (e.gpa && e.honors) sub += ' \u00b7 ';
                    if (e.honors) sub += this._esc(e.honors);
                    html += `<div class="rv-entry-sub">${sub}</div>`;
                }
                html += '</div>';
            }
            return html + '</div>';
        }

        _renderSkillsHtml(d) {
            const skills = (d.skills || []).filter(s => s.category || (s.items && s.items.length));
            if (!skills.length || d.show_skills === false) return '';
            const layout = (this.typo && this.typo.skills_layout) || 'inline';
            let html = `<div class="rv-section"><div class="rv-section-title">Skills</div><div class="rv-skills-grid rv-skills-${layout}">`;
            if (layout === 'columns') {
                for (const s of skills) {
                    html += '<div class="rv-skill-col">';
                    if (s.category) html += `<div class="rv-skill-cat">${this._esc(s.category)}</div>`;
                    for (const item of (s.items || [])) {
                        html += `<div class="rv-skill-item">${this._esc(item)}</div>`;
                    }
                    html += '</div>';
                }
            } else if (layout === 'tags') {
                for (const s of skills) {
                    html += '<div class="rv-skill-row">';
                    if (s.category) html += `<span class="rv-skill-cat">${this._esc(s.category)}:</span> `;
                    for (const item of (s.items || [])) {
                        html += `<span class="rv-skill-tag">${this._esc(item)}</span>`;
                    }
                    html += '</div>';
                }
            } else {
                for (const s of skills) {
                    html += '<div class="rv-skill-row">';
                    if (s.category) html += `<span class="rv-skill-cat">${this._esc(s.category)}:</span> `;
                    html += this._esc((s.items || []).join(', '));
                    html += '</div>';
                }
            }
            return html + '</div></div>';
        }

        _renderProjectsHtml(d) {
            const projects = (d.projects || []).filter(p => p.name);
            if (!projects.length || d.show_projects === false) return '';
            let html = '<div class="rv-section"><div class="rv-section-title">Projects</div>';
            for (const p of projects) {
                html += '<div class="rv-entry"><div class="rv-entry-header">';
                html += `<span class="rv-entry-left"><span class="rv-entry-title">${this._esc(p.name)}</span>`;
                if (p.technologies) html += ` \u00b7 ${this._esc(p.technologies)}`;
                html += '</span>';
                if (p.url) html += `<span class="rv-entry-date">${this._esc(p.url)}</span>`;
                html += '</div>';
                if (p.description) html += `<div style="font-size:${this.typo.font_size_body}pt;margin-top:2pt">${this._esc(p.description)}</div>`;
                html += '</div>';
            }
            return html + '</div>';
        }

        _renderCertificationsHtml(d) {
            const certs = (d.certifications || []).filter(c => c.name);
            if (!certs.length || d.show_certifications === false) return '';
            let html = '<div class="rv-section"><div class="rv-section-title">Certifications</div>';
            for (const c of certs) {
                html += '<div class="rv-cert"><div class="rv-entry-header">';
                html += `<span class="rv-cert-name">${this._esc(c.name)}</span>`;
                if (c.date) { const fmtC = (this.typo && this.typo.date_format) || 'MMM YYYY'; html += `<span class="rv-entry-date">${this._esc(this._formatDate(c.date, fmtC))}</span>`; }
                html += '</div>';
                if (c.issuer) html += `<div class="rv-cert-meta">${this._esc(c.issuer)}</div>`;
                html += '</div>';
            }
            return html + '</div>';
        }

        _renderAwardsHtml(d) {
            const awards = (d.awards || []).filter(a => a.name);
            if (!awards.length || d.show_awards === false) return '';
            let html = '<div class="rv-section"><div class="rv-section-title">Awards</div>';
            for (const a of awards) {
                html += '<div class="rv-entry"><div class="rv-entry-header">';
                html += `<span class="rv-entry-left"><span class="rv-entry-title">${this._esc(a.name)}</span>`;
                if (a.issuer) html += ` | ${this._esc(a.issuer)}`;
                html += '</span>';
                if (a.date) { const fmtA = (this.typo && this.typo.date_format) || 'MMM YYYY'; html += `<span class="rv-entry-date">${this._esc(this._formatDate(a.date, fmtA))}</span>`; }
                html += '</div>';
                if (a.description) html += `<div style="font-size:${this.typo.font_size_body}pt;margin-top:2pt">${this._esc(a.description)}</div>`;
                html += '</div>';
            }
            return html + '</div>';
        }

        _render() {
            const d = this.data;
            if (!d) return;

            // Preserve the fill indicator element across innerHTML rewrites
            const indicator = document.getElementById('pageFillIndicator');

            // Header always first
            const h = d.header || {};
            let html = '<div class="rv-header">';
            html += `<div class="rv-name">${this._esc(h.name)}</div>`;
            html += '<div class="rv-contact">';
            if (h.email) html += `<span>${this._esc(h.email)}</span>`;
            if (h.phone) html += `<span>${this._esc(h.phone)}</span>`;
            if (h.location) html += `<span>${this._esc(h.location)}</span>`;
            if (h.linkedin) html += `<span>${this._esc(h.linkedin)}</span>`;
            if (h.website) html += `<span>${this._esc(h.website)}</span>`;
            html += '</div></div>';
            html += '<hr class="rv-header-rule">';

            // Remaining sections in user-defined order
            const order = d.section_order || ['summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'awards'];
            for (const section of order) {
                switch (section) {
                    case 'summary':        html += this._renderSummaryHtml(d); break;
                    case 'experience':     html += this._renderExperienceHtml(d); break;
                    case 'education':      html += this._renderEducationHtml(d); break;
                    case 'skills':         html += this._renderSkillsHtml(d); break;
                    case 'projects':       html += this._renderProjectsHtml(d); break;
                    case 'certifications': html += this._renderCertificationsHtml(d); break;
                    case 'awards':         html += this._renderAwardsHtml(d); break;
                }
            }

            // Show placeholder if nothing was rendered
            const hasContent = h.name || d.summary ||
                (d.experience || []).some(e => e.company || e.title) ||
                (d.education || []).some(e => e.school) ||
                (d.skills || []).some(s => s.category || (s.items && s.items.length)) ||
                (d.projects || []).some(p => p.name) ||
                (d.certifications || []).some(c => c.name) ||
                (d.awards || []).some(a => a.name);

            if (!hasContent) {
                this.page.innerHTML = '<p class="preview-placeholder">Import a resume or fill in the fields on the left to get started.</p>';
                if (indicator) this.page.appendChild(indicator);
                return;
            }

            this.page.innerHTML = html;
            if (indicator) this.page.appendChild(indicator);
        }
    }

    // ── Default state ────────────────────────────
    var DEFAULT_SECTION_ORDER = ['summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'awards'];

    var SECTION_META = {
        summary:        { label: 'Summary',     showKey: 'show_summary' },
        experience:     { label: 'Experience',  showKey: 'show_experience' },
        education:      { label: 'Education',   showKey: 'show_education' },
        skills:         { label: 'Skills',      showKey: 'show_skills' },
        projects:       { label: 'Projects',    showKey: 'show_projects' },
        certifications: { label: 'Certs',       showKey: 'show_certifications' },
        awards:         { label: 'Awards',      showKey: 'show_awards' },
    };

    var EYE_OPEN_SVG = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M1 6.5C1 6.5 3 2.5 6.5 2.5S12 6.5 12 6.5 10 10.5 6.5 10.5 1 6.5 1 6.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" stroke-width="1.2"/></svg>';
    var EYE_CLOSED_SVG = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M1.5 1.5l10 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M5.5 3C6 2.7 6.3 2.5 6.5 2.5c3.5 0 5.5 4 5.5 4s-.7 1.3-1.9 2.4M3 4.5C1.7 5.6 1 6.5 1 6.5s2 4 5.5 4c1 0 1.9-.3 2.7-.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    function defaultData() {
        return {
            header: { name: '', email: '', phone: '', location: '', linkedin: '', website: '' },
            summary: '',
            show_summary: true,
            experience: [],
            show_experience: true,
            education: [],
            show_education: true,
            skills: [],
            show_skills: true,
            certifications: [],
            show_certifications: true,
            projects: [],
            show_projects: true,
            awards: [],
            show_awards: true,
            section_order: DEFAULT_SECTION_ORDER.slice(),
        };
    }

    function defaultTypo() {
        return {
            font_family: 'Helvetica',
            font_size_name: 20,
            font_size_section_header: 12,
            font_size_body: 10,
            font_size_detail: 9,
            line_height: 1.15,
            paragraph_spacing: 4,
            section_spacing: 10,
            margin_top: 0.5,
            margin_bottom: 0.5,
            margin_left: 0.6,
            margin_right: 0.6,
            bullet_indent: 12,
            date_format: 'MMM YYYY',
            header_layout: 'centered',
            contact_separator: 'pipe',
            bullet_style: 'filled',
        };
    }

    // ── Init preview ─────────────────────────────
    const pageEl = document.getElementById('resumePage');
    const previewEl = document.getElementById('preview');

    if (!pageEl || !previewEl) return;

    const state = { data: defaultData(), typo: defaultTypo() };
    const preview = new ResumePreview(pageEl, previewEl);
    preview.update(state.data, state.typo);

    // ── Auto-save ────────────────────────────────
    var resumeId = null;
    var saveTimer = null;
    var lastSavedSnapshot = null;
    var saveStatusEl = document.getElementById('saveStatus');

    function setSaveStatus(status) {
        if (!saveStatusEl) return;
        saveStatusEl.className = 'save-status';
        if (status === 'saving') {
            saveStatusEl.classList.add('saving');
            saveStatusEl.textContent = 'Saving...';
        } else if (status === 'saved') {
            saveStatusEl.classList.add('saved');
            saveStatusEl.textContent = 'Saved';
        } else if (status === 'error') {
            saveStatusEl.classList.add('error');
            saveStatusEl.textContent = 'Error saving';
        } else {
            saveStatusEl.textContent = '';
        }
    }

    function doSave() {
        if (!resumeId) return;
        var snapshot = JSON.stringify({ data: state.data, typo: state.typo });
        if (snapshot === lastSavedSnapshot) return;
        setSaveStatus('saving');
        var bodyStr = JSON.stringify({ data: state.data, typography: state.typo });
        fetch('/api/resume/' + resumeId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: bodyStr
        })
        .then(function (r) {
            if (!r.ok) throw new Error('save failed');
            lastSavedSnapshot = snapshot;
            setSaveStatus('saved');
        })
        .catch(function () {
            setSaveStatus('error');
        });
    }

    function scheduleSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(doSave, 1000);
    }

    function initResumeId() {
        fetch('/api/resume/new', { method: 'POST' })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                resumeId = res.id;
                lastSavedSnapshot = JSON.stringify({ data: state.data, typo: state.typo });
            })
            .catch(function () {});
    }

    function notifyChange() {
        preview.update(state.data, state.typo);
        schedulePageCheck();
        scheduleSave();
    }

    // ── Undo/Redo History ────────────────────────
    var historyStack = [];
    var redoStack = [];
    var MAX_HISTORY = 50;
    var undoBtnEl = document.getElementById('undoBtn');
    var redoBtnEl = document.getElementById('redoBtn');

    function updateUndoRedoButtons() {
        if (undoBtnEl) undoBtnEl.disabled = historyStack.length === 0;
        if (redoBtnEl) redoBtnEl.disabled = redoStack.length === 0;
    }

    function pushHistory() {
        var snapshot = JSON.stringify({ data: state.data, typo: state.typo });
        if (historyStack.length > 0 && historyStack[historyStack.length - 1] === snapshot) return;
        historyStack.push(snapshot);
        if (historyStack.length > MAX_HISTORY) historyStack.shift();
        redoStack.length = 0;
        updateUndoRedoButtons();
    }

    function applyHistoryState(snapshot) {
        var parsed = JSON.parse(snapshot);
        state.data = parsed.data;
        state.typo = parsed.typo;

        expOpenStates.length = 0;
        eduOpenStates.length = 0;
        skillOpenStates.length = 0;
        certOpenStates.length = 0;
        projOpenStates.length = 0;
        awardOpenStates.length = 0;

        var h = state.data.header || {};
        ['name', 'email', 'phone', 'location', 'linkedin', 'website'].forEach(function (f) {
            var el = document.getElementById(f);
            if (el) el.value = h[f] || '';
        });
        if (summaryEl) summaryEl.value = state.data.summary || '';
        updateCharCount();
        if (summaryVisibleEl) summaryVisibleEl.checked = !!state.data.show_summary;
        var certsVisEl = document.getElementById('certsVisible');
        if (certsVisEl) certsVisEl.checked = state.data.show_certifications !== false;
        var projVisEl = document.getElementById('projectsVisible');
        if (projVisEl) projVisEl.checked = state.data.show_projects !== false;
        var awardsVisEl = document.getElementById('awardsVisible');
        if (awardsVisEl) awardsVisEl.checked = state.data.show_awards !== false;

        applyTypoToControls(state.typo);
        renderSidebarNav();
        renderExperienceList();
        renderEducationList();
        renderSkillList();
        renderCertList();
        renderProjectList();
        renderAwardList();
        notifyChange();
    }

    function undo() {
        if (historyStack.length === 0) return;
        var currentSnapshot = JSON.stringify({ data: state.data, typo: state.typo });
        redoStack.push(currentSnapshot);
        applyHistoryState(historyStack.pop());
        updateUndoRedoButtons();
    }

    function redo() {
        if (redoStack.length === 0) return;
        var currentSnapshot = JSON.stringify({ data: state.data, typo: state.typo });
        historyStack.push(currentSnapshot);
        applyHistoryState(redoStack.pop());
        updateUndoRedoButtons();
    }

    // ── Undo/Redo button wiring ──────────────────
    if (undoBtnEl) undoBtnEl.addEventListener('click', undo);
    if (redoBtnEl) redoBtnEl.addEventListener('click', redo);

    // ── Section panel visibility (grayed out when hidden) ───────────────
    function updateSectionPanelVisibility() {
        var order = state.data.section_order || DEFAULT_SECTION_ORDER;
        order.forEach(function (key) {
            var meta = SECTION_META[key];
            if (!meta || !meta.showKey) return;
            var panel = document.getElementById('section-' + key);
            if (panel) panel.classList.toggle('section-content-hidden', state.data[meta.showKey] === false);
        });
    }

    // ── Sidebar nav (dynamic, ordered by section_order) ─────────────────
    function renderSidebarNav() {
        var nav = document.getElementById('sidebarNav');
        if (!nav) return;

        // Track which section is currently active
        var activeBtn = nav.querySelector('.sidebar-nav-btn.active');
        var activeSection = activeBtn ? activeBtn.dataset.section : 'header';

        // Remove all non-contact, non-typography buttons
        Array.from(nav.querySelectorAll('.sidebar-nav-btn:not([data-section="header"]):not([data-section="typography"])')).forEach(function (b) {
            nav.removeChild(b);
        });

        // Add buttons in section_order order, each with a drag handle
        // Insert before the Typography button so it stays last
        var typoNavBtn = nav.querySelector('.sidebar-nav-btn[data-section="typography"]');
        var order = state.data.section_order || DEFAULT_SECTION_ORDER;
        order.forEach(function (key) {
            var meta = SECTION_META[key];
            if (!meta) return;
            var isVisible = !meta.showKey || state.data[meta.showKey] !== false;
            var btn = document.createElement('button');
            btn.className = 'sidebar-nav-btn' + (activeSection === key ? ' active' : '') + (isVisible ? '' : ' section-hidden');
            btn.dataset.section = key;
            btn.innerHTML = '<span class="nav-drag-handle" title="Drag to reorder">⠿</span>' +
                '<span class="nav-label">' + meta.label + '</span>' +
                '<button class="nav-eye-btn" title="' + (isVisible ? 'Hide section' : 'Show section') + '" aria-label="' + (isVisible ? 'Hide section' : 'Show section') + '">' +
                (isVisible ? EYE_OPEN_SVG : EYE_CLOSED_SVG) +
                '</button>';
            if (typoNavBtn) {
                nav.insertBefore(btn, typoNavBtn);
            } else {
                nav.appendChild(btn);
            }
        });

        updateSectionPanelVisibility();

        bindNavClicks();
        bindNavDragDrop();
    }

    function bindNavClicks() {
        var nav = document.getElementById('sidebarNav');
        if (!nav) return;
        var allNavBtns = nav.querySelectorAll('.sidebar-nav-btn');
        var allSections = document.querySelectorAll('.sidebar-section');

        allNavBtns.forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                if (e.target.closest('.nav-drag-handle')) return;
                if (e.target.closest('.nav-eye-btn')) {
                    pushHistory();
                    var key = btn.dataset.section;
                    var meta = SECTION_META[key];
                    if (meta && meta.showKey) {
                        state.data[meta.showKey] = state.data[meta.showKey] === false ? true : false;
                        renderSidebarNav();
                        notifyChange();
                    }
                    return;
                }
                allNavBtns.forEach(function (b) { b.classList.remove('active'); });
                allSections.forEach(function (s) { s.classList.remove('active'); });
                btn.classList.add('active');
                var target = document.getElementById('section-' + btn.dataset.section);
                if (target) target.classList.add('active');
            });
        });
    }

    function bindNavDragDrop() {
        var nav = document.getElementById('sidebarNav');
        if (!nav) return;
        var draggable = nav.querySelectorAll('.sidebar-nav-btn:not([data-section="header"])');
        var dragSrcKey = null;

        draggable.forEach(function (btn) {
            btn.draggable = true;

            btn.addEventListener('dragstart', function (e) {
                dragSrcKey = btn.dataset.section;
                btn.classList.add('nav-dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            btn.addEventListener('dragend', function () {
                btn.classList.remove('nav-dragging');
                draggable.forEach(function (b) { b.classList.remove('nav-drag-over'); });
                dragSrcKey = null;
            });

            btn.addEventListener('dragover', function (e) {
                if (!dragSrcKey || dragSrcKey === btn.dataset.section) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                draggable.forEach(function (b) { b.classList.remove('nav-drag-over'); });
                btn.classList.add('nav-drag-over');
            });

            btn.addEventListener('dragleave', function () {
                btn.classList.remove('nav-drag-over');
            });

            btn.addEventListener('drop', function (e) {
                e.preventDefault();
                var dstKey = btn.dataset.section;
                if (dragSrcKey && dragSrcKey !== dstKey) {
                    var order = state.data.section_order;
                    var srcIdx = order.indexOf(dragSrcKey);
                    var dstIdx = order.indexOf(dstKey);
                    if (srcIdx !== -1 && dstIdx !== -1) {
                        pushHistory();
                        var moved = order.splice(srcIdx, 1)[0];
                        order.splice(dstIdx, 0, moved);
                        renderSidebarNav();
                        notifyChange();
                    }
                }
                dragSrcKey = null;
            });
        });
    }

    renderSidebarNav();

    // ── History capture via sidebar event delegation ─────────────────────
    var sidebarEl = document.getElementById('sidebar');
    if (sidebarEl) {
        sidebarEl.addEventListener('focusin', function (e) {
            var tag = e.target.tagName;
            var type = (e.target.type || '').toLowerCase();
            if ((tag === 'INPUT' && type !== 'range' && type !== 'checkbox') ||
                tag === 'TEXTAREA' || tag === 'SELECT') {
                pushHistory();
            }
        });
        sidebarEl.addEventListener('mousedown', function (e) {
            var tag = e.target.tagName;
            var type = (e.target.type || '').toLowerCase();
            if (tag === 'INPUT' && (type === 'range' || type === 'checkbox')) {
                pushHistory();
            }
        });
    }

    // ── Form bindings — contact ──────────────────
    function bindField(id, path) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', function () {
            const keys = path.split('.');
            let obj = state.data;
            for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
            obj[keys[keys.length - 1]] = el.value;
            notifyChange();
        });
    }

    bindField('name', 'header.name');
    bindField('email', 'header.email');
    bindField('phone', 'header.phone');
    bindField('location', 'header.location');
    bindField('linkedin', 'header.linkedin');
    bindField('website', 'header.website');
    bindField('summary', 'summary');

    // ── Summary char count + visibility toggle ───
    const summaryEl = document.getElementById('summary');
    const charCountEl = document.getElementById('summaryCharCount');
    const summaryVisibleEl = document.getElementById('summaryVisible');

    function updateCharCount() {
        if (!charCountEl || !summaryEl) return;
        const len = summaryEl.value.length;
        charCountEl.textContent = len === 1 ? '1 character' : `${len} characters`;
    }

    if (summaryEl) summaryEl.addEventListener('input', updateCharCount);

    if (summaryVisibleEl) {
        summaryVisibleEl.addEventListener('change', function () {
            state.data.show_summary = summaryVisibleEl.checked;
            notifyChange();
        });
    }

    // ── Experience section ───────────────────────
    function escHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    var expOpenStates = [];

    function newExperienceEntry() {
        return { company: '', title: '', location: '', start_date: '', end_date: '', present: false, bullets: [] };
    }

    function buildBulletHTML(text, bi) {
        return '<div class="bullet-item">' +
            '<div class="bullet-reorder">' +
            '<button class="bullet-up" data-bi="' + bi + '" title="Move up">▲</button>' +
            '<button class="bullet-down" data-bi="' + bi + '" title="Move down">▼</button>' +
            '</div>' +
            '<input class="field-input bullet-input" data-bi="' + bi + '" type="text" value="' + escHtml(text) + '" placeholder="Describe an achievement...">' +
            '<button class="bullet-remove" data-bi="' + bi + '" title="Remove bullet">✕</button>' +
            '</div>';
    }

    function buildExpItem(entry, index) {
        var item = document.createElement('div');
        item.className = 'exp-item' + (expOpenStates[index] === false ? ' collapsed' : '');
        item.dataset.index = String(index);
        item.draggable = true;

        var label = [entry.title, entry.company].filter(Boolean).join(' @ ') || 'New Entry';
        var chevron = expOpenStates[index] === false ? '▸' : '▾';
        var endDisabled = entry.present ? ' disabled' : '';
        var bulletsHTML = entry.bullets.map(buildBulletHTML).join('');

        item.innerHTML =
            '<div class="exp-item-header">' +
                '<span class="drag-handle" title="Drag to reorder">⠿</span>' +
                '<span class="exp-item-label">' + escHtml(label) + '</span>' +
                '<div class="exp-item-actions">' +
                    '<button class="exp-toggle-btn" title="Expand/collapse">' + chevron + '</button>' +
                    '<button class="exp-delete-btn" title="Delete entry">✕</button>' +
                '</div>' +
            '</div>' +
            '<div class="exp-item-body">' +
                '<div class="field-group">' +
                    '<label class="field-label">Company</label>' +
                    '<input class="field-input exp-field" data-field="company" type="text" value="' + escHtml(entry.company) + '" placeholder="Acme Corp">' +
                '</div>' +
                '<div class="field-group">' +
                    '<label class="field-label">Job Title</label>' +
                    '<input class="field-input exp-field" data-field="title" type="text" value="' + escHtml(entry.title) + '" placeholder="Software Engineer">' +
                '</div>' +
                '<div class="field-group">' +
                    '<label class="field-label">Location</label>' +
                    '<input class="field-input exp-field" data-field="location" type="text" value="' + escHtml(entry.location) + '" placeholder="San Francisco, CA">' +
                '</div>' +
                '<div class="date-row' + (entry.present ? ' end-date-hidden' : '') + '">' +
                    '<div class="field-group">' +
                        '<label class="field-label">Start Date</label>' +
                        '<input class="field-input exp-field" data-field="start_date" type="text" value="' + escHtml(entry.start_date) + '" placeholder="Jan 2020">' +
                    '</div>' +
                    '<div class="field-group end-date-group"' + (entry.present ? ' style="display:none"' : '') + '>' +
                        '<label class="field-label">End Date</label>' +
                        '<input class="field-input exp-field" data-field="end_date" type="text" value="' + escHtml(entry.end_date) + '" placeholder="Dec 2022"' + endDisabled + '>' +
                    '</div>' +
                '</div>' +
                '<div class="present-row">' +
                    '<input type="checkbox" class="exp-present" id="exp-present-' + index + '"' + (entry.present ? ' checked' : '') + '>' +
                    '<label class="field-label" for="exp-present-' + index + '">Currently working here</label>' +
                '</div>' +
                '<div class="bullet-section">' +
                    '<div class="bullet-list-label">Bullet Points</div>' +
                    '<div class="bullet-list">' + bulletsHTML + '</div>' +
                    '<button class="add-bullet-btn">+ Add bullet</button>' +
                '</div>' +
            '</div>';

        var header = item.querySelector('.exp-item-header');
        var toggleBtn = item.querySelector('.exp-toggle-btn');
        var bulletList = item.querySelector('.bullet-list');

        header.addEventListener('click', function (e) {
            if (e.target.closest('.exp-delete-btn') || e.target.closest('.drag-handle')) return;
            var nowCollapsed = item.classList.toggle('collapsed');
            expOpenStates[index] = !nowCollapsed;
            toggleBtn.textContent = nowCollapsed ? '▸' : '▾';
        });

        item.querySelector('.exp-delete-btn').addEventListener('click', function () {
            if (confirm('Delete this experience entry?')) {
                pushHistory();
                state.data.experience.splice(index, 1);
                expOpenStates.splice(index, 1);
                renderExperienceList();
                notifyChange();
            }
        });

        item.querySelectorAll('.exp-field').forEach(function (input) {
            input.addEventListener('input', function () {
                state.data.experience[index][input.dataset.field] = input.value;
                var e2 = state.data.experience[index];
                item.querySelector('.exp-item-label').textContent =
                    [e2.title, e2.company].filter(Boolean).join(' @ ') || 'New Entry';
                notifyChange();
            });
        });

        item.querySelector('.exp-present').addEventListener('change', function () {
            state.data.experience[index].present = this.checked;
            var endInput = item.querySelector('[data-field="end_date"]');
            var endGroup = item.querySelector('.end-date-group');
            var dateRow = item.querySelector('.date-row');
            if (this.checked) {
                state.data.experience[index].end_date = 'Present';
                endInput.value = 'Present';
                endInput.disabled = true;
                endGroup.style.display = 'none';
                dateRow.classList.add('end-date-hidden');
            } else {
                state.data.experience[index].end_date = '';
                endInput.value = '';
                endInput.disabled = false;
                endGroup.style.display = '';
                dateRow.classList.remove('end-date-hidden');
            }
            notifyChange();
        });

        bulletList.addEventListener('input', function (e) {
            if (e.target.classList.contains('bullet-input')) {
                var bi = parseInt(e.target.dataset.bi);
                state.data.experience[index].bullets[bi] = e.target.value;
                notifyChange();
            }
        });

        bulletList.addEventListener('click', function (e) {
            var removeBtn = e.target.closest('.bullet-remove');
            var upBtn = e.target.closest('.bullet-up');
            var downBtn = e.target.closest('.bullet-down');
            var bullets = state.data.experience[index].bullets;
            var bi, tmp;

            if (removeBtn) {
                bi = parseInt(removeBtn.dataset.bi);
                pushHistory();
                bullets.splice(bi, 1);
                bulletList.innerHTML = bullets.map(buildBulletHTML).join('');
                notifyChange();
            } else if (upBtn) {
                bi = parseInt(upBtn.dataset.bi);
                if (bi > 0) {
                    pushHistory();
                    tmp = bullets[bi - 1];
                    bullets[bi - 1] = bullets[bi];
                    bullets[bi] = tmp;
                    bulletList.innerHTML = bullets.map(buildBulletHTML).join('');
                    notifyChange();
                }
            } else if (downBtn) {
                bi = parseInt(downBtn.dataset.bi);
                if (bi < bullets.length - 1) {
                    pushHistory();
                    tmp = bullets[bi];
                    bullets[bi] = bullets[bi + 1];
                    bullets[bi + 1] = tmp;
                    bulletList.innerHTML = bullets.map(buildBulletHTML).join('');
                    notifyChange();
                }
            }
        });

        item.querySelector('.add-bullet-btn').addEventListener('click', function () {
            pushHistory();
            state.data.experience[index].bullets.push('');
            bulletList.innerHTML = state.data.experience[index].bullets.map(buildBulletHTML).join('');
            notifyChange();
            var inputs = bulletList.querySelectorAll('.bullet-input');
            if (inputs.length) inputs[inputs.length - 1].focus();
        });

        return item;
    }

    function bindExpDragDrop() {
        var listEl = document.getElementById('experienceList');
        if (!listEl) return;
        var items = listEl.querySelectorAll('.exp-item');
        var dragSrcIndex = null;

        items.forEach(function (item) {
            item.addEventListener('dragstart', function (e) {
                dragSrcIndex = parseInt(item.dataset.index);
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', function () {
                item.classList.remove('dragging');
                items.forEach(function (i) { i.classList.remove('drag-over'); });
                dragSrcIndex = null;
            });

            item.addEventListener('dragover', function (e) {
                if (dragSrcIndex === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', function () {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', function (e) {
                e.preventDefault();
                var dropIndex = parseInt(item.dataset.index);
                if (dragSrcIndex !== null && dragSrcIndex !== dropIndex) {
                    pushHistory();
                    var exp = state.data.experience;
                    var moved = exp.splice(dragSrcIndex, 1)[0];
                    exp.splice(dropIndex, 0, moved);
                    var openMoved = expOpenStates.splice(dragSrcIndex, 1)[0];
                    expOpenStates.splice(dropIndex, 0, openMoved);
                    renderExperienceList();
                    notifyChange();
                }
                dragSrcIndex = null;
            });
        });
    }

    function renderExperienceList() {
        var listEl = document.getElementById('experienceList');
        if (!listEl) return;

        if (!state.data.experience.length) {
            listEl.innerHTML = '<p class="empty-state">No experience added yet.</p>';
            return;
        }

        while (expOpenStates.length < state.data.experience.length) expOpenStates.push(true);
        expOpenStates.length = state.data.experience.length;

        listEl.innerHTML = '';
        state.data.experience.forEach(function (entry, index) {
            listEl.appendChild(buildExpItem(entry, index));
        });

        bindExpDragDrop();
    }

    var addExpBtn = document.getElementById('addExperience');
    if (addExpBtn) {
        addExpBtn.addEventListener('click', function () {
            pushHistory();
            state.data.experience.push(newExperienceEntry());
            expOpenStates.push(true);
            renderExperienceList();
            notifyChange();
        });
    }

    renderExperienceList();

    // ── Education section ────────────────────────
    var eduOpenStates = [];

    function newEducationEntry() {
        return { school: '', degree: '', field: '', graduation_date: '', gpa: '', honors: '' };
    }

    function buildEduItem(entry, index) {
        var item = document.createElement('div');
        item.className = 'edu-item' + (eduOpenStates[index] === false ? ' collapsed' : '');
        item.dataset.index = String(index);
        item.draggable = true;

        var label = entry.school || 'New Entry';
        var chevron = eduOpenStates[index] === false ? '▸' : '▾';

        item.innerHTML =
            '<div class="edu-item-header">' +
                '<span class="drag-handle" title="Drag to reorder">⠿</span>' +
                '<span class="edu-item-label">' + escHtml(label) + '</span>' +
                '<div class="edu-item-actions">' +
                    '<button class="edu-toggle-btn" title="Expand/collapse">' + chevron + '</button>' +
                    '<button class="edu-delete-btn" title="Delete entry">✕</button>' +
                '</div>' +
            '</div>' +
            '<div class="edu-item-body">' +
                '<div class="field-group">' +
                    '<label class="field-label">School</label>' +
                    '<input class="field-input edu-field" data-field="school" type="text" value="' + escHtml(entry.school) + '" placeholder="University of California">' +
                '</div>' +
                '<div class="field-group">' +
                    '<label class="field-label">Degree</label>' +
                    '<input class="field-input edu-field" data-field="degree" type="text" value="' + escHtml(entry.degree) + '" placeholder="Bachelor of Science">' +
                '</div>' +
                '<div class="field-group">' +
                    '<label class="field-label">Field of Study</label>' +
                    '<input class="field-input edu-field" data-field="field" type="text" value="' + escHtml(entry.field) + '" placeholder="Computer Science">' +
                '</div>' +
                '<div class="field-group">' +
                    '<label class="field-label">Graduation Date</label>' +
                    '<input class="field-input edu-field" data-field="graduation_date" type="text" value="' + escHtml(entry.graduation_date) + '" placeholder="May 2022">' +
                '</div>' +
                '<div class="field-group">' +
                    '<label class="field-label">GPA (optional)</label>' +
                    '<input class="field-input edu-field" data-field="gpa" type="text" value="' + escHtml(entry.gpa) + '" placeholder="3.8">' +
                '</div>' +
                '<div class="field-group">' +
                    '<label class="field-label">Honors (optional)</label>' +
                    '<input class="field-input edu-field" data-field="honors" type="text" value="' + escHtml(entry.honors) + '" placeholder="Magna Cum Laude">' +
                '</div>' +
            '</div>';

        var header = item.querySelector('.edu-item-header');
        var toggleBtn = item.querySelector('.edu-toggle-btn');

        header.addEventListener('click', function (e) {
            if (e.target.closest('.edu-delete-btn') || e.target.closest('.drag-handle')) return;
            var nowCollapsed = item.classList.toggle('collapsed');
            eduOpenStates[index] = !nowCollapsed;
            toggleBtn.textContent = nowCollapsed ? '▸' : '▾';
        });

        item.querySelector('.edu-delete-btn').addEventListener('click', function () {
            if (confirm('Delete this education entry?')) {
                pushHistory();
                state.data.education.splice(index, 1);
                eduOpenStates.splice(index, 1);
                renderEducationList();
                notifyChange();
            }
        });

        item.querySelectorAll('.edu-field').forEach(function (input) {
            input.addEventListener('input', function () {
                state.data.education[index][input.dataset.field] = input.value;
                if (input.dataset.field === 'school') {
                    item.querySelector('.edu-item-label').textContent = input.value || 'New Entry';
                }
                notifyChange();
            });
        });

        return item;
    }

    function bindEduDragDrop() {
        var listEl = document.getElementById('educationList');
        if (!listEl) return;
        var items = listEl.querySelectorAll('.edu-item');
        var dragSrcIndex = null;

        items.forEach(function (item) {
            item.addEventListener('dragstart', function (e) {
                dragSrcIndex = parseInt(item.dataset.index);
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', function () {
                item.classList.remove('dragging');
                items.forEach(function (i) { i.classList.remove('drag-over'); });
                dragSrcIndex = null;
            });

            item.addEventListener('dragover', function (e) {
                if (dragSrcIndex === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', function () {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', function (e) {
                e.preventDefault();
                var dropIndex = parseInt(item.dataset.index);
                if (dragSrcIndex !== null && dragSrcIndex !== dropIndex) {
                    pushHistory();
                    var edu = state.data.education;
                    var moved = edu.splice(dragSrcIndex, 1)[0];
                    edu.splice(dropIndex, 0, moved);
                    var openMoved = eduOpenStates.splice(dragSrcIndex, 1)[0];
                    eduOpenStates.splice(dropIndex, 0, openMoved);
                    renderEducationList();
                    notifyChange();
                }
                dragSrcIndex = null;
            });
        });
    }

    function renderEducationList() {
        var listEl = document.getElementById('educationList');
        if (!listEl) return;

        if (!state.data.education.length) {
            listEl.innerHTML = '<p class="empty-state">No education added yet.</p>';
            return;
        }

        while (eduOpenStates.length < state.data.education.length) eduOpenStates.push(true);
        eduOpenStates.length = state.data.education.length;

        listEl.innerHTML = '';
        state.data.education.forEach(function (entry, index) {
            listEl.appendChild(buildEduItem(entry, index));
        });

        bindEduDragDrop();
    }

    var addEduBtn = document.getElementById('addEducation');
    if (addEduBtn) {
        addEduBtn.addEventListener('click', function () {
            pushHistory();
            state.data.education.push(newEducationEntry());
            eduOpenStates.push(true);
            renderEducationList();
            notifyChange();
        });
    }

    renderEducationList();

    // ── Skills section ────────────────────────
    var skillOpenStates = [];

    function newSkillEntry() {
        return { category: '', items: [] };
    }

    function buildSkillItem(entry, index) {
        var item = document.createElement('div');
        item.className = 'skill-item' + (skillOpenStates[index] === false ? ' collapsed' : '');
        item.dataset.index = String(index);
        item.draggable = true;

        var label = entry.category || 'New Category';
        var chevron = skillOpenStates[index] === false ? '▸' : '▾';

        item.innerHTML =
            '<div class="skill-item-header">' +
                '<span class="drag-handle" title="Drag to reorder">⠿</span>' +
                '<span class="skill-item-label">' + escHtml(label) + '</span>' +
                '<div class="skill-item-actions">' +
                    '<button class="skill-toggle-btn" title="Expand/collapse">' + chevron + '</button>' +
                    '<button class="skill-delete-btn" title="Delete category">✕</button>' +
                '</div>' +
            '</div>' +
            '<div class="skill-item-body">' +
                '<div class="field-group">' +
                    '<label class="field-label">Category Name</label>' +
                    '<input class="field-input skill-cat-field" type="text" value="' + escHtml(entry.category) + '" placeholder="Programming Languages">' +
                '</div>' +
                '<div class="field-group">' +
                    '<label class="field-label">Skills (comma-separated)</label>' +
                    '<input class="field-input skill-items-field" type="text" value="' + escHtml((entry.items || []).join(', ')) + '" placeholder="Python, JavaScript, Go">' +
                '</div>' +
            '</div>';

        var header = item.querySelector('.skill-item-header');
        var toggleBtn = item.querySelector('.skill-toggle-btn');

        header.addEventListener('click', function (e) {
            if (e.target.closest('.skill-delete-btn') || e.target.closest('.drag-handle')) return;
            var nowCollapsed = item.classList.toggle('collapsed');
            skillOpenStates[index] = !nowCollapsed;
            toggleBtn.textContent = nowCollapsed ? '▸' : '▾';
        });

        item.querySelector('.skill-delete-btn').addEventListener('click', function () {
            if (confirm('Delete this skill category?')) {
                pushHistory();
                state.data.skills.splice(index, 1);
                skillOpenStates.splice(index, 1);
                renderSkillList();
                notifyChange();
            }
        });

        item.querySelector('.skill-cat-field').addEventListener('input', function () {
            state.data.skills[index].category = this.value;
            item.querySelector('.skill-item-label').textContent = this.value || 'New Category';
            notifyChange();
        });

        item.querySelector('.skill-items-field').addEventListener('input', function () {
            state.data.skills[index].items = this.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
            notifyChange();
        });

        return item;
    }

    function bindSkillDragDrop() {
        var listEl = document.getElementById('skillsList');
        if (!listEl) return;
        var items = listEl.querySelectorAll('.skill-item');
        var dragSrcIndex = null;

        items.forEach(function (item) {
            item.addEventListener('dragstart', function (e) {
                dragSrcIndex = parseInt(item.dataset.index);
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', function () {
                item.classList.remove('dragging');
                items.forEach(function (i) { i.classList.remove('drag-over'); });
                dragSrcIndex = null;
            });

            item.addEventListener('dragover', function (e) {
                if (dragSrcIndex === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', function () {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', function (e) {
                e.preventDefault();
                var dropIndex = parseInt(item.dataset.index);
                if (dragSrcIndex !== null && dragSrcIndex !== dropIndex) {
                    var skills = state.data.skills;
                    var moved = skills.splice(dragSrcIndex, 1)[0];
                    skills.splice(dropIndex, 0, moved);
                    var openMoved = skillOpenStates.splice(dragSrcIndex, 1)[0];
                    skillOpenStates.splice(dropIndex, 0, openMoved);
                    renderSkillList();
                    notifyChange();
                }
                dragSrcIndex = null;
            });
        });
    }

    function renderSkillList() {
        var listEl = document.getElementById('skillsList');
        if (!listEl) return;

        if (!state.data.skills.length) {
            listEl.innerHTML = '<p class="empty-state">No skills added yet.</p>';
            return;
        }

        while (skillOpenStates.length < state.data.skills.length) skillOpenStates.push(true);
        skillOpenStates.length = state.data.skills.length;

        listEl.innerHTML = '';
        state.data.skills.forEach(function (entry, index) {
            listEl.appendChild(buildSkillItem(entry, index));
        });

        bindSkillDragDrop();
    }

    var addSkillBtn = document.getElementById('addSkill');
    if (addSkillBtn) {
        addSkillBtn.addEventListener('click', function () {
            state.data.skills.push(newSkillEntry());
            skillOpenStates.push(true);
            renderSkillList();
            notifyChange();
        });
    }

    renderSkillList();

    // ── Certifications section ────────────────────────
    var certOpenStates = [];

    function newCertEntry() {
        return { name: '', issuer: '', date: '' };
    }

    function buildCertItem(entry, index) {
        var item = document.createElement('div');
        item.className = 'cert-item' + (certOpenStates[index] === false ? ' collapsed' : '');
        item.dataset.index = String(index);
        item.draggable = true;

        var label = entry.name || 'New Certification';
        var chevron = certOpenStates[index] === false ? '▸' : '▾';

        item.innerHTML =
            '<div class="cert-item-header">' +
                '<span class="drag-handle" title="Drag to reorder">⠿</span>' +
                '<span class="cert-item-label">' + escHtml(label) + '</span>' +
                '<div class="cert-item-actions">' +
                    '<button class="cert-toggle-btn" title="Expand/collapse">' + chevron + '</button>' +
                    '<button class="cert-delete-btn" title="Delete entry">✕</button>' +
                '</div>' +
            '</div>' +
            '<div class="cert-item-body">' +
                '<div class="field-group">' +
                    '<label class="field-label">Certification Name</label>' +
                    '<input class="field-input cert-field" data-field="name" type="text" value="' + escHtml(entry.name) + '" placeholder="AWS Certified Solutions Architect">' +
                '</div>' +
                '<div class="field-group">' +
                    '<label class="field-label">Issuing Organization</label>' +
                    '<input class="field-input cert-field" data-field="issuer" type="text" value="' + escHtml(entry.issuer) + '" placeholder="Amazon Web Services">' +
                '</div>' +
                '<div class="field-group">' +
                    '<label class="field-label">Date</label>' +
                    '<input class="field-input cert-field" data-field="date" type="text" value="' + escHtml(entry.date) + '" placeholder="June 2023">' +
                '</div>' +
            '</div>';

        var header = item.querySelector('.cert-item-header');
        var toggleBtn = item.querySelector('.cert-toggle-btn');

        header.addEventListener('click', function (e) {
            if (e.target.closest('.cert-delete-btn') || e.target.closest('.drag-handle')) return;
            var nowCollapsed = item.classList.toggle('collapsed');
            certOpenStates[index] = !nowCollapsed;
            toggleBtn.textContent = nowCollapsed ? '▸' : '▾';
        });

        item.querySelector('.cert-delete-btn').addEventListener('click', function () {
            if (confirm('Delete this certification?')) {
                state.data.certifications.splice(index, 1);
                certOpenStates.splice(index, 1);
                renderCertList();
                notifyChange();
            }
        });

        item.querySelectorAll('.cert-field').forEach(function (input) {
            input.addEventListener('input', function () {
                state.data.certifications[index][input.dataset.field] = input.value;
                if (input.dataset.field === 'name') {
                    item.querySelector('.cert-item-label').textContent = input.value || 'New Certification';
                }
                notifyChange();
            });
        });

        return item;
    }

    function bindCertDragDrop() {
        var listEl = document.getElementById('certsList');
        if (!listEl) return;
        var items = listEl.querySelectorAll('.cert-item');
        var dragSrcIndex = null;

        items.forEach(function (item) {
            item.addEventListener('dragstart', function (e) {
                dragSrcIndex = parseInt(item.dataset.index);
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', function () {
                item.classList.remove('dragging');
                items.forEach(function (i) { i.classList.remove('drag-over'); });
                dragSrcIndex = null;
            });

            item.addEventListener('dragover', function (e) {
                if (dragSrcIndex === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', function () {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', function (e) {
                e.preventDefault();
                var dropIndex = parseInt(item.dataset.index);
                if (dragSrcIndex !== null && dragSrcIndex !== dropIndex) {
                    var certs = state.data.certifications;
                    var moved = certs.splice(dragSrcIndex, 1)[0];
                    certs.splice(dropIndex, 0, moved);
                    var openMoved = certOpenStates.splice(dragSrcIndex, 1)[0];
                    certOpenStates.splice(dropIndex, 0, openMoved);
                    renderCertList();
                    notifyChange();
                }
                dragSrcIndex = null;
            });
        });
    }

    function renderCertList() {
        var listEl = document.getElementById('certsList');
        if (!listEl) return;

        if (!state.data.certifications.length) {
            listEl.innerHTML = '<p class="empty-state">No certifications added yet.</p>';
            return;
        }

        while (certOpenStates.length < state.data.certifications.length) certOpenStates.push(true);
        certOpenStates.length = state.data.certifications.length;

        listEl.innerHTML = '';
        state.data.certifications.forEach(function (entry, index) {
            listEl.appendChild(buildCertItem(entry, index));
        });

        bindCertDragDrop();
    }

    var certsVisibleEl = document.getElementById('certsVisible');
    if (certsVisibleEl) {
        certsVisibleEl.addEventListener('change', function () {
            state.data.show_certifications = certsVisibleEl.checked;
            notifyChange();
        });
    }

    var addCertBtn = document.getElementById('addCert');
    if (addCertBtn) {
        addCertBtn.addEventListener('click', function () {
            state.data.certifications.push(newCertEntry());
            certOpenStates.push(true);
            renderCertList();
            notifyChange();
        });
    }

    renderCertList();

    // ── Projects section ────────────────────────
    var projOpenStates = [];

    function newProjectEntry() {
        return { name: '', description: '', technologies: '', url: '' };
    }

    function buildProjectItem(entry, index) {
        var item = document.createElement('div');
        item.className = 'proj-item' + (projOpenStates[index] === false ? ' collapsed' : '');
        item.dataset.index = String(index);
        item.draggable = true;

        var label = entry.name || 'New Project';
        var chevron = projOpenStates[index] === false ? '▸' : '▾';

        item.innerHTML =
            '<div class="proj-item-header">' +
                '<span class="drag-handle" title="Drag to reorder">⠿</span>' +
                '<span class="proj-item-label">' + escHtml(label) + '</span>' +
                '<div class="proj-item-actions">' +
                    '<button class="proj-toggle-btn" title="Expand/collapse">' + chevron + '</button>' +
                    '<button class="proj-delete-btn" title="Delete entry">✕</button>' +
                '</div>' +
            '</div>' +
            '<div class="proj-item-body">' +
                '<div class="field-group">' +
                    '<label class="field-label">Project Name</label>' +
                    '<input class="field-input proj-field" data-field="name" type="text" value="' + escHtml(entry.name) + '" placeholder="My Awesome Project">' +
                '</div>' +
                '<div class="field-group">' +
                    '<label class="field-label">Description</label>' +
                    '<input class="field-input proj-field" data-field="description" type="text" value="' + escHtml(entry.description) + '" placeholder="Brief description of the project">' +
                '</div>' +
                '<div class="field-group">' +
                    '<label class="field-label">Technologies</label>' +
                    '<input class="field-input proj-field" data-field="technologies" type="text" value="' + escHtml(entry.technologies) + '" placeholder="Python, React, PostgreSQL">' +
                '</div>' +
                '<div class="field-group">' +
                    '<label class="field-label">URL (optional)</label>' +
                    '<input class="field-input proj-field" data-field="url" type="text" value="' + escHtml(entry.url) + '" placeholder="https://github.com/user/project">' +
                '</div>' +
            '</div>';

        var header = item.querySelector('.proj-item-header');
        var toggleBtn = item.querySelector('.proj-toggle-btn');

        header.addEventListener('click', function (e) {
            if (e.target.closest('.proj-delete-btn') || e.target.closest('.drag-handle')) return;
            var nowCollapsed = item.classList.toggle('collapsed');
            projOpenStates[index] = !nowCollapsed;
            toggleBtn.textContent = nowCollapsed ? '▸' : '▾';
        });

        item.querySelector('.proj-delete-btn').addEventListener('click', function () {
            if (confirm('Delete this project?')) {
                state.data.projects.splice(index, 1);
                projOpenStates.splice(index, 1);
                renderProjectList();
                notifyChange();
            }
        });

        item.querySelectorAll('.proj-field').forEach(function (input) {
            input.addEventListener('input', function () {
                state.data.projects[index][input.dataset.field] = input.value;
                if (input.dataset.field === 'name') {
                    item.querySelector('.proj-item-label').textContent = input.value || 'New Project';
                }
                notifyChange();
            });
        });

        return item;
    }

    function bindProjectDragDrop() {
        var listEl = document.getElementById('projectsList');
        if (!listEl) return;
        var items = listEl.querySelectorAll('.proj-item');
        var dragSrcIndex = null;

        items.forEach(function (item) {
            item.addEventListener('dragstart', function (e) {
                dragSrcIndex = parseInt(item.dataset.index);
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', function () {
                item.classList.remove('dragging');
                items.forEach(function (i) { i.classList.remove('drag-over'); });
                dragSrcIndex = null;
            });

            item.addEventListener('dragover', function (e) {
                if (dragSrcIndex === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', function () {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', function (e) {
                e.preventDefault();
                var dropIndex = parseInt(item.dataset.index);
                if (dragSrcIndex !== null && dragSrcIndex !== dropIndex) {
                    var projs = state.data.projects;
                    var moved = projs.splice(dragSrcIndex, 1)[0];
                    projs.splice(dropIndex, 0, moved);
                    var openMoved = projOpenStates.splice(dragSrcIndex, 1)[0];
                    projOpenStates.splice(dropIndex, 0, openMoved);
                    renderProjectList();
                    notifyChange();
                }
                dragSrcIndex = null;
            });
        });
    }

    function renderProjectList() {
        var listEl = document.getElementById('projectsList');
        if (!listEl) return;

        if (!state.data.projects.length) {
            listEl.innerHTML = '<p class="empty-state">No projects added yet.</p>';
            return;
        }

        while (projOpenStates.length < state.data.projects.length) projOpenStates.push(true);
        projOpenStates.length = state.data.projects.length;

        listEl.innerHTML = '';
        state.data.projects.forEach(function (entry, index) {
            listEl.appendChild(buildProjectItem(entry, index));
        });

        bindProjectDragDrop();
    }

    var projectsVisibleEl = document.getElementById('projectsVisible');
    if (projectsVisibleEl) {
        projectsVisibleEl.addEventListener('change', function () {
            state.data.show_projects = projectsVisibleEl.checked;
            notifyChange();
        });
    }

    var addProjectBtn = document.getElementById('addProject');
    if (addProjectBtn) {
        addProjectBtn.addEventListener('click', function () {
            state.data.projects.push(newProjectEntry());
            projOpenStates.push(true);
            renderProjectList();
            notifyChange();
        });
    }

    renderProjectList();

    // ── Awards section ────────────────────────
    var awardOpenStates = [];

    function newAwardEntry() {
        return { name: '', issuer: '', date: '', description: '' };
    }

    function buildAwardItem(entry, index) {
        var item = document.createElement('div');
        item.className = 'award-item' + (awardOpenStates[index] === false ? ' collapsed' : '');
        item.dataset.index = String(index);
        item.draggable = true;

        var label = entry.name || 'New Award';
        var chevron = awardOpenStates[index] === false ? '▸' : '▾';

        item.innerHTML =
            '<div class="award-item-header">' +
                '<span class="drag-handle" title="Drag to reorder">⠿</span>' +
                '<span class="award-item-label">' + escHtml(label) + '</span>' +
                '<div class="award-item-actions">' +
                    '<button class="award-toggle-btn" title="Expand/collapse">' + chevron + '</button>' +
                    '<button class="award-delete-btn" title="Delete entry">✕</button>' +
                '</div>' +
            '</div>' +
            '<div class="award-item-body">' +
                '<div class="field-group">' +
                    '<label class="field-label">Award Name</label>' +
                    '<input class="field-input award-field" data-field="name" type="text" value="' + escHtml(entry.name) + '" placeholder="Employee of the Year">' +
                '</div>' +
                '<div class="field-group">' +
                    '<label class="field-label">Issuing Organization</label>' +
                    '<input class="field-input award-field" data-field="issuer" type="text" value="' + escHtml(entry.issuer) + '" placeholder="Acme Corp">' +
                '</div>' +
                '<div class="field-group">' +
                    '<label class="field-label">Date</label>' +
                    '<input class="field-input award-field" data-field="date" type="text" value="' + escHtml(entry.date) + '" placeholder="June 2023">' +
                '</div>' +
                '<div class="field-group">' +
                    '<label class="field-label">Description (optional)</label>' +
                    '<input class="field-input award-field" data-field="description" type="text" value="' + escHtml(entry.description) + '" placeholder="Brief description of the award">' +
                '</div>' +
            '</div>';

        var header = item.querySelector('.award-item-header');
        var toggleBtn = item.querySelector('.award-toggle-btn');

        header.addEventListener('click', function (e) {
            if (e.target.closest('.award-delete-btn') || e.target.closest('.drag-handle')) return;
            var nowCollapsed = item.classList.toggle('collapsed');
            awardOpenStates[index] = !nowCollapsed;
            toggleBtn.textContent = nowCollapsed ? '▸' : '▾';
        });

        item.querySelector('.award-delete-btn').addEventListener('click', function () {
            if (confirm('Delete this award?')) {
                state.data.awards.splice(index, 1);
                awardOpenStates.splice(index, 1);
                renderAwardList();
                notifyChange();
            }
        });

        item.querySelectorAll('.award-field').forEach(function (input) {
            input.addEventListener('input', function () {
                state.data.awards[index][input.dataset.field] = input.value;
                if (input.dataset.field === 'name') {
                    item.querySelector('.award-item-label').textContent = input.value || 'New Award';
                }
                notifyChange();
            });
        });

        return item;
    }

    function bindAwardDragDrop() {
        var listEl = document.getElementById('awardsList');
        if (!listEl) return;
        var items = listEl.querySelectorAll('.award-item');
        var dragSrcIndex = null;

        items.forEach(function (item) {
            item.addEventListener('dragstart', function (e) {
                dragSrcIndex = parseInt(item.dataset.index);
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', function () {
                item.classList.remove('dragging');
                items.forEach(function (i) { i.classList.remove('drag-over'); });
                dragSrcIndex = null;
            });

            item.addEventListener('dragover', function (e) {
                if (dragSrcIndex === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', function () {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', function (e) {
                e.preventDefault();
                var dropIndex = parseInt(item.dataset.index);
                if (dragSrcIndex !== null && dragSrcIndex !== dropIndex) {
                    var aw = state.data.awards;
                    var moved = aw.splice(dragSrcIndex, 1)[0];
                    aw.splice(dropIndex, 0, moved);
                    var openMoved = awardOpenStates.splice(dragSrcIndex, 1)[0];
                    awardOpenStates.splice(dropIndex, 0, openMoved);
                    renderAwardList();
                    notifyChange();
                }
                dragSrcIndex = null;
            });
        });
    }

    function renderAwardList() {
        var listEl = document.getElementById('awardsList');
        if (!listEl) return;

        if (!state.data.awards.length) {
            listEl.innerHTML = '<p class="empty-state">No awards added yet.</p>';
            return;
        }

        while (awardOpenStates.length < state.data.awards.length) awardOpenStates.push(true);
        awardOpenStates.length = state.data.awards.length;

        listEl.innerHTML = '';
        state.data.awards.forEach(function (entry, index) {
            listEl.appendChild(buildAwardItem(entry, index));
        });

        bindAwardDragDrop();
    }

    var awardsVisibleEl = document.getElementById('awardsVisible');
    if (awardsVisibleEl) {
        awardsVisibleEl.addEventListener('change', function () {
            state.data.show_awards = awardsVisibleEl.checked;
            notifyChange();
        });
    }

    var addAwardBtn = document.getElementById('addAward');
    if (addAwardBtn) {
        addAwardBtn.addEventListener('click', function () {
            state.data.awards.push(newAwardEntry());
            awardOpenStates.push(true);
            renderAwardList();
            notifyChange();
        });
    }

    renderAwardList();

    // ── Typography controls ──────────────────────
    function bindTypoSlider(sliderId, valId, typoKey, unit) {
        var slider = document.getElementById(sliderId);
        var valEl = valId ? document.getElementById(valId) : null;
        if (!slider) return;
        slider.value = state.typo[typoKey];
        if (valEl) valEl.textContent = state.typo[typoKey] + unit;
        slider.addEventListener('input', function () {
            var v = parseFloat(slider.value);
            state.typo[typoKey] = v;
            if (valEl) valEl.textContent = v + unit;
            notifyChange();
        });
    }

    var typoFontFamilyEl = document.getElementById('typoFontFamily');
    if (typoFontFamilyEl) {
        typoFontFamilyEl.value = state.typo.font_family;
        typoFontFamilyEl.addEventListener('change', function () {
            state.typo.font_family = typoFontFamilyEl.value;
            notifyChange();
        });
    }

    var typoDateFormatEl = document.getElementById('typoDateFormat');
    if (typoDateFormatEl) {
        typoDateFormatEl.value = state.typo.date_format || 'MMM YYYY';
        typoDateFormatEl.addEventListener('change', function () {
            state.typo.date_format = typoDateFormatEl.value;
            notifyChange();
        });
    }

    var headerLayoutOptionsEl = document.getElementById('headerLayoutOptions');
    if (headerLayoutOptionsEl) {
        var activeLayout = state.typo.header_layout || 'centered';
        headerLayoutOptionsEl.querySelectorAll('.layout-option').forEach(function (btn) {
            if (btn.dataset.layout === activeLayout) btn.classList.add('active');
            else btn.classList.remove('active');
            btn.addEventListener('click', function () {
                headerLayoutOptionsEl.querySelectorAll('.layout-option').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                state.typo.header_layout = btn.dataset.layout;
                notifyChange();
            });
        });
    }

    var typoContactSeparatorEl = document.getElementById('typoContactSeparator');
    if (typoContactSeparatorEl) {
        typoContactSeparatorEl.value = state.typo.contact_separator || 'pipe';
        typoContactSeparatorEl.addEventListener('change', function () {
            state.typo.contact_separator = typoContactSeparatorEl.value;
            notifyChange();
        });
    }

    var typoSectionDividerStyleEl = document.getElementById('typoSectionDividerStyle');
    if (typoSectionDividerStyleEl) {
        typoSectionDividerStyleEl.value = state.typo.section_divider_style || 'thin';
        typoSectionDividerStyleEl.addEventListener('change', function () {
            pushHistory();
            state.typo.section_divider_style = typoSectionDividerStyleEl.value;
            notifyChange();
        });
    }

    var skillsLayoutOptionsEl = document.getElementById('skillsLayoutOptions');
    if (skillsLayoutOptionsEl) {
        var activeSkillsLayout = state.typo.skills_layout || 'inline';
        skillsLayoutOptionsEl.querySelectorAll('.layout-option').forEach(function (btn) {
            if (btn.dataset.layout === activeSkillsLayout) btn.classList.add('active');
            else btn.classList.remove('active');
            btn.addEventListener('click', function () {
                skillsLayoutOptionsEl.querySelectorAll('.layout-option').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                state.typo.skills_layout = btn.dataset.layout;
                notifyChange();
            });
        });
    }

    var typoBulletStyleEl = document.getElementById('typoBulletStyle');
    if (typoBulletStyleEl) {
        typoBulletStyleEl.value = state.typo.bullet_style || 'filled';
        typoBulletStyleEl.addEventListener('change', function () {
            pushHistory();
            state.typo.bullet_style = typoBulletStyleEl.value;
            notifyChange();
        });
    }

    var typoSizeNameSlider = document.getElementById('typoSizeName');
    var typoSizeNameNum = document.getElementById('typoSizeNameNum');
    if (typoSizeNameSlider && typoSizeNameNum) {
        typoSizeNameSlider.value = state.typo.font_size_name;
        typoSizeNameNum.value = state.typo.font_size_name;
        typoSizeNameSlider.addEventListener('input', function () {
            var v = parseFloat(typoSizeNameSlider.value);
            state.typo.font_size_name = v;
            typoSizeNameNum.value = v;
            notifyChange();
        });
        typoSizeNameNum.addEventListener('input', function () {
            var v = Math.min(28, Math.max(14, parseFloat(typoSizeNameNum.value) || state.typo.font_size_name));
            state.typo.font_size_name = v;
            typoSizeNameSlider.value = v;
            notifyChange();
        });
    }

    bindTypoSlider('typoSizeSectionHeader', 'typoSizeSectionHeaderVal', 'font_size_section_header', 'pt');
    bindTypoSlider('typoSizeBody', 'typoSizeBodyVal', 'font_size_body', 'pt');
    bindTypoSlider('typoSizeDetail', 'typoSizeDetailVal', 'font_size_detail', 'pt');
    bindTypoSlider('typoLineHeight', 'typoLineHeightVal', 'line_height', '');
    bindTypoSlider('typoParagraphSpacing', 'typoParagraphSpacingVal', 'paragraph_spacing', 'pt');
    bindTypoSlider('typoSectionSpacing', 'typoSectionSpacingVal', 'section_spacing', 'pt');

    // ── Margin controls ──────────────────────
    var marginSliders = [
        { sliderId: 'typoMarginTop',    valId: 'typoMarginTopVal',    key: 'margin_top' },
        { sliderId: 'typoMarginBottom', valId: 'typoMarginBottomVal', key: 'margin_bottom' },
        { sliderId: 'typoMarginLeft',   valId: 'typoMarginLeftVal',   key: 'margin_left' },
        { sliderId: 'typoMarginRight',  valId: 'typoMarginRightVal',  key: 'margin_right' }
    ];
    var linkMarginsEl = document.getElementById('typoLinkMargins');

    marginSliders.forEach(function (cfg) {
        var slider = document.getElementById(cfg.sliderId);
        var valEl = document.getElementById(cfg.valId);
        if (!slider) return;
        slider.value = state.typo[cfg.key];
        if (valEl) valEl.textContent = state.typo[cfg.key].toFixed(2) + 'in';
        slider.addEventListener('input', function () {
            var v = parseFloat(slider.value);
            if (linkMarginsEl && linkMarginsEl.checked) {
                marginSliders.forEach(function (other) {
                    var otherSlider = document.getElementById(other.sliderId);
                    var otherVal = document.getElementById(other.valId);
                    var clamped = Math.min(parseFloat(otherSlider.max), Math.max(parseFloat(otherSlider.min), v));
                    state.typo[other.key] = clamped;
                    otherSlider.value = clamped;
                    if (otherVal) otherVal.textContent = clamped.toFixed(2) + 'in';
                });
            } else {
                state.typo[cfg.key] = v;
                if (valEl) valEl.textContent = v.toFixed(2) + 'in';
            }
            notifyChange();
        });
    });

    // ── Page fill indicator ──────────────────────
    var pageFillTimer = null;
    var pageFillIndicatorEl = document.getElementById('pageFillIndicator');
    var pageFillBarEl = document.getElementById('pageFillBar');
    var pageFillPctEl = document.getElementById('pageFillPct');
    var overflowWarningEl = document.getElementById('overflowWarning');
    var resumePageEl = document.getElementById('resumePage');

    function updatePageFillIndicator(pct) {
        if (!pageFillBarEl || !pageFillPctEl || !pageFillIndicatorEl) return;
        var clamped = Math.min(pct, 100);
        pageFillBarEl.style.height = clamped + '%';
        pageFillPctEl.textContent = Math.round(pct) + '%';
        pageFillBarEl.className = 'page-fill-bar';
        pageFillPctEl.className = 'page-fill-pct';
        if (pct >= 100) {
            pageFillBarEl.classList.add('page-fill-bar--red');
            pageFillPctEl.classList.add('page-fill-pct--overflow');
        } else if (pct >= 90) {
            pageFillBarEl.classList.add('page-fill-bar--yellow');
        }
        pageFillIndicatorEl.classList.add('has-data');
    }

    function schedulePageCheck() {
        clearTimeout(pageFillTimer);
        pageFillTimer = setTimeout(function () {
            fetch('/api/resume/page-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: state.data, typography: state.typo })
            })
            .then(function (r) { return r.json(); })
            .then(function (result) {
                if (typeof result.content_height_pct === 'number') {
                    updatePageFillIndicator(result.content_height_pct);
                }
                if (typeof result.fits === 'boolean') {
                    updateAutoFitBtnState(result.fits);
                }
            })
            .catch(function () {});
        }, 300);
    }

    // ── Auto-fit button ──────────────────────────
    var autoFitBtn = document.getElementById('autoFitBtn');
    var autoFitToastEl = document.getElementById('autoFitToast');
    var autoFitToastTimer = null;

    function updateAutoFitBtnState(fits) {
        if (autoFitBtn) {
            autoFitBtn.disabled = fits;
            if (fits) {
                autoFitBtn.classList.remove('auto-fit-btn--overflow');
            } else {
                autoFitBtn.classList.add('auto-fit-btn--overflow');
            }
        }
        if (overflowWarningEl) {
            if (fits) {
                overflowWarningEl.classList.remove('visible');
            } else {
                overflowWarningEl.classList.add('visible');
            }
        }
        if (resumePageEl) {
            if (fits) {
                resumePageEl.classList.remove('page--overflow');
            } else {
                resumePageEl.classList.add('page--overflow');
            }
        }
    }

    function showAutoFitToast(message) {
        if (!autoFitToastEl) return;
        autoFitToastEl.textContent = message;
        autoFitToastEl.classList.add('toast--visible');
        clearTimeout(autoFitToastTimer);
        autoFitToastTimer = setTimeout(function () {
            autoFitToastEl.classList.remove('toast--visible');
        }, 4000);
    }

    function applyTypoToControls(typo) {
        Object.assign(state.typo, typo);

        var fontFamilyEl = document.getElementById('typoFontFamily');
        if (fontFamilyEl) fontFamilyEl.value = typo.font_family;

        var dateFormatEl = document.getElementById('typoDateFormat');
        if (dateFormatEl && typo.date_format) dateFormatEl.value = typo.date_format;

        var layoutOptionsEl = document.getElementById('headerLayoutOptions');
        if (layoutOptionsEl && typo.header_layout) {
            layoutOptionsEl.querySelectorAll('.layout-option').forEach(function (btn) {
                btn.classList.toggle('active', btn.dataset.layout === typo.header_layout);
            });
        }

        var contactSepEl = document.getElementById('typoContactSeparator');
        if (contactSepEl) contactSepEl.value = typo.contact_separator || 'pipe';

        var sectionDividerEl = document.getElementById('typoSectionDividerStyle');
        if (sectionDividerEl) sectionDividerEl.value = typo.section_divider_style || 'thin';

        var skillsLayoutEl = document.getElementById('skillsLayoutOptions');
        if (skillsLayoutEl && typo.skills_layout) {
            skillsLayoutEl.querySelectorAll('.layout-option').forEach(function (btn) {
                btn.classList.toggle('active', btn.dataset.layout === typo.skills_layout);
            });
        }

        var bulletStyleEl = document.getElementById('typoBulletStyle');
        if (bulletStyleEl) bulletStyleEl.value = typo.bullet_style || 'filled';

        var sizeNameSlider = document.getElementById('typoSizeName');
        var sizeNameNum = document.getElementById('typoSizeNameNum');
        if (sizeNameSlider) sizeNameSlider.value = typo.font_size_name;
        if (sizeNameNum) sizeNameNum.value = typo.font_size_name;

        [
            ['typoSizeSectionHeader', 'typoSizeSectionHeaderVal', 'font_size_section_header', 'pt'],
            ['typoSizeBody',          'typoSizeBodyVal',          'font_size_body',            'pt'],
            ['typoSizeDetail',        'typoSizeDetailVal',        'font_size_detail',          'pt'],
            ['typoLineHeight',        'typoLineHeightVal',        'line_height',               ''],
            ['typoParagraphSpacing',  'typoParagraphSpacingVal',  'paragraph_spacing',         'pt'],
            ['typoSectionSpacing',    'typoSectionSpacingVal',    'section_spacing',           'pt'],
        ].forEach(function (cfg) {
            var slider = document.getElementById(cfg[0]);
            var valEl  = document.getElementById(cfg[1]);
            if (slider) slider.value = typo[cfg[2]];
            if (valEl)  valEl.textContent = typo[cfg[2]] + cfg[3];
        });

        [
            ['typoMarginTop',    'typoMarginTopVal',    'margin_top'],
            ['typoMarginBottom', 'typoMarginBottomVal', 'margin_bottom'],
            ['typoMarginLeft',   'typoMarginLeftVal',   'margin_left'],
            ['typoMarginRight',  'typoMarginRightVal',  'margin_right'],
        ].forEach(function (cfg) {
            var slider = document.getElementById(cfg[0]);
            var valEl  = document.getElementById(cfg[1]);
            if (slider) slider.value = typo[cfg[2]];
            if (valEl)  valEl.textContent = typo[cfg[2]].toFixed(2) + 'in';
        });
    }

    // ── Import modal ─────────────────────────────
    var importModal     = document.getElementById('importModal');
    var importDropzone  = document.getElementById('importDropzone');
    var importFileInput = document.getElementById('importFileInput');
    var importBrowseBtn = document.getElementById('importBrowseBtn');
    var importFileInfo  = document.getElementById('importFileInfo');
    var importFileName  = document.getElementById('importFileName');
    var importFileSize  = document.getElementById('importFileSize');
    var importFileClear = document.getElementById('importFileClear');
    var importError     = document.getElementById('importError');
    var importConfirmBtn = document.getElementById('importConfirmBtn');
    var importSpinner   = document.getElementById('importSpinner');
    var importCancelBtn = document.getElementById('importCancelBtn');
    var importModalClose = document.getElementById('importModalClose');
    var importBtn       = document.getElementById('importBtn');

    var selectedFile = null;

    function openImportModal() {
        resetImportModal();
        if (importModal) importModal.hidden = false;
    }

    function closeImportModal() {
        if (importModal) importModal.hidden = true;
    }

    function resetImportModal() {
        selectedFile = null;
        if (importFileInput) importFileInput.value = '';
        if (importFileInfo) importFileInfo.hidden = true;
        if (importError) importError.hidden = true;
        if (importConfirmBtn) importConfirmBtn.disabled = true;
        if (importSpinner) importSpinner.hidden = true;
        if (importDropzone) importDropzone.classList.remove('drag-over');
    }

    function formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function setSelectedFile(file) {
        selectedFile = file;
        if (importFileName) importFileName.textContent = file.name;
        if (importFileSize) importFileSize.textContent = formatBytes(file.size);
        if (importFileInfo) importFileInfo.hidden = false;
        if (importError) importError.hidden = true;
        if (importConfirmBtn) importConfirmBtn.disabled = false;
    }

    function showImportError(msg) {
        if (importError) {
            importError.textContent = msg;
            importError.hidden = false;
        }
    }

    function loadImportedData(data) {
        var defaults = defaultData();
        var merged = Object.assign(defaults, data);
        if (!merged.section_order || !merged.section_order.length) {
            merged.section_order = DEFAULT_SECTION_ORDER.slice();
        }
        Object.assign(state.data, merged);

        expOpenStates.length = 0;
        eduOpenStates.length = 0;
        skillOpenStates.length = 0;
        certOpenStates.length = 0;
        projOpenStates.length = 0;
        awardOpenStates.length = 0;

        var h = state.data.header || {};
        ['name','email','phone','location','linkedin','website'].forEach(function (f) {
            var el = document.getElementById(f);
            if (el) el.value = h[f] || '';
        });

        if (summaryEl) summaryEl.value = state.data.summary || '';
        updateCharCount();

        if (summaryVisibleEl) summaryVisibleEl.checked = !!state.data.show_summary;

        var certsVisibleEl = document.getElementById('certsVisible');
        if (certsVisibleEl) certsVisibleEl.checked = state.data.show_certifications !== false;

        var projectsVisibleEl = document.getElementById('projectsVisible');
        if (projectsVisibleEl) projectsVisibleEl.checked = state.data.show_projects !== false;

        var awardsVisibleEl = document.getElementById('awardsVisible');
        if (awardsVisibleEl) awardsVisibleEl.checked = state.data.show_awards !== false;

        renderSidebarNav();
        renderExperienceList();
        renderEducationList();
        renderSkillList();
        renderCertList();
        renderProjectList();
        renderAwardList();
        notifyChange();
    }

    if (importBtn) {
        importBtn.addEventListener('click', openImportModal);
    }

    if (importModalClose) importModalClose.addEventListener('click', closeImportModal);
    if (importCancelBtn) importCancelBtn.addEventListener('click', closeImportModal);

    if (importModal) {
        importModal.addEventListener('click', function (e) {
            if (e.target === importModal) closeImportModal();
        });
    }

    if (importBrowseBtn) {
        importBrowseBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (importFileInput) importFileInput.click();
        });
    }

    if (importFileInput) {
        importFileInput.addEventListener('change', function () {
            var file = importFileInput.files && importFileInput.files[0];
            if (file) setSelectedFile(file);
        });
    }

    if (importFileClear) {
        importFileClear.addEventListener('click', function () {
            selectedFile = null;
            if (importFileInput) importFileInput.value = '';
            if (importFileInfo) importFileInfo.hidden = true;
            if (importError) importError.hidden = true;
            if (importConfirmBtn) importConfirmBtn.disabled = true;
        });
    }

    if (importDropzone) {
        importDropzone.addEventListener('dragover', function (e) {
            e.preventDefault();
            importDropzone.classList.add('drag-over');
        });

        importDropzone.addEventListener('dragleave', function (e) {
            if (!importDropzone.contains(e.relatedTarget)) {
                importDropzone.classList.remove('drag-over');
            }
        });

        importDropzone.addEventListener('drop', function (e) {
            e.preventDefault();
            importDropzone.classList.remove('drag-over');
            var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) {
                var ext = file.name.split('.').pop().toLowerCase();
                if (ext !== 'pdf' && ext !== 'docx') {
                    showImportError('Unsupported file type. Please upload a PDF or DOCX file.');
                    return;
                }
                setSelectedFile(file);
            }
        });
    }

    if (importConfirmBtn) {
        importConfirmBtn.addEventListener('click', function () {
            if (!selectedFile) return;

            importConfirmBtn.disabled = true;
            if (importSpinner) importSpinner.hidden = false;
            if (importError) importError.hidden = true;

            var formData = new FormData();
            formData.append('file', selectedFile);

            fetch('/api/import', { method: 'POST', body: formData })
                .then(function (r) {
                    return r.json().then(function (body) {
                        return { ok: r.ok, status: r.status, body: body };
                    });
                })
                .then(function (res) {
                    if (importSpinner) importSpinner.hidden = true;
                    if (!res.ok) {
                        showImportError(res.body.error || 'Import failed. Please try again.');
                        importConfirmBtn.disabled = false;
                        return;
                    }
                    loadImportedData(res.body.data);
                    resumeId = res.body.id;
                    lastSavedSnapshot = JSON.stringify({ data: state.data, typo: state.typo });
                    closeImportModal();
                    showAutoFitToast('Resume imported successfully.');
                })
                .catch(function () {
                    if (importSpinner) importSpinner.hidden = true;
                    showImportError('Network error. Please check your connection and try again.');
                    importConfirmBtn.disabled = false;
                });
        });
    }

    // ── Shortcuts popover ────────────────────────
    var shortcutsWrap    = document.getElementById('shortcutsWrap');
    var shortcutsBtn     = document.getElementById('shortcutsBtn');
    var shortcutsPopover = document.getElementById('shortcutsPopover');

    function openShortcutsPopover() {
        if (shortcutsPopover) shortcutsPopover.hidden = false;
    }

    function closeShortcutsPopover() {
        if (shortcutsPopover) shortcutsPopover.hidden = true;
    }

    if (shortcutsBtn) {
        shortcutsBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (shortcutsPopover && shortcutsPopover.hidden) {
                openShortcutsPopover();
            } else {
                closeShortcutsPopover();
            }
        });
    }

    document.addEventListener('click', function (e) {
        if (shortcutsWrap && !shortcutsWrap.contains(e.target)) {
            closeShortcutsPopover();
        }
    });

    // ── Export dropdown ──────────────────────────
    var exportDropdown  = document.getElementById('exportDropdown');
    var exportBtn       = document.getElementById('exportBtn');
    var exportMenu      = document.getElementById('exportMenu');
    var exportPdfBtn    = document.getElementById('exportPdfBtn');
    var exportDocxBtn   = document.getElementById('exportDocxBtn');
    var exportPdfSpinner  = document.getElementById('exportPdfSpinner');
    var exportDocxSpinner = document.getElementById('exportDocxSpinner');

    function openExportMenu() {
        if (exportMenu) exportMenu.hidden = false;
        if (exportDropdown) exportDropdown.classList.add('open');
    }

    function closeExportMenu() {
        if (exportMenu) exportMenu.hidden = true;
        if (exportDropdown) exportDropdown.classList.remove('open');
    }

    function getExportFilename(ext) {
        var name = (state.data && state.data.header && state.data.header.name) || 'resume';
        var slug = name.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '') || 'resume';
        return slug + '-resume.' + ext;
    }

    function triggerDownload(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function doExport(format) {
        var spinner = format === 'pdf' ? exportPdfSpinner : exportDocxSpinner;
        var btn = format === 'pdf' ? exportPdfBtn : exportDocxBtn;
        var endpoint = '/api/resume/' + format;
        var mimeType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        if (btn) btn.disabled = true;
        if (spinner) spinner.hidden = false;
        closeExportMenu();

        fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: state.data, typography: state.typo })
        })
        .then(function (r) {
            if (!r.ok) {
                return r.json().then(function (body) {
                    throw new Error(body.error || 'Export failed');
                });
            }
            return r.blob();
        })
        .then(function (blob) {
            var typedBlob = new Blob([blob], { type: mimeType });
            triggerDownload(typedBlob, getExportFilename(format));
        })
        .catch(function (err) {
            showAutoFitToast((err && err.message) || 'Export failed. Please try again.');
        })
        .finally(function () {
            if (btn) btn.disabled = false;
            if (spinner) spinner.hidden = true;
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (exportMenu && exportMenu.hidden) {
                openExportMenu();
            } else {
                closeExportMenu();
            }
        });
    }

    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', function () { doExport('pdf'); });
    }

    if (exportDocxBtn) {
        exportDocxBtn.addEventListener('click', function () { doExport('docx'); });
    }

    document.addEventListener('click', function (e) {
        if (exportDropdown && !exportDropdown.contains(e.target)) {
            closeExportMenu();
        }
    });

    // ── Auto-fit button ──────────────────────────
    if (autoFitBtn) {
        autoFitBtn.addEventListener('click', function () {
            autoFitBtn.disabled = true;
            fetch('/api/resume/auto-fit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: state.data, typography: state.typo })
            })
            .then(function (r) { return r.json(); })
            .then(function (result) {
                if (result.typography) {
                    applyTypoToControls(result.typography);
                    notifyChange();
                }
                updateAutoFitBtnState(!!result.fits);
                var msg;
                if (!result.changes || result.changes.length === 0) {
                    msg = 'Already fits one page';
                } else {
                    msg = 'Adjusted to fit one page: ' + result.changes.join(', ');
                }
                showAutoFitToast(msg);
            })
            .catch(function () {
                autoFitBtn.disabled = false;
                showAutoFitToast('Auto-fit failed. Please try again.');
            });
        });
    }

    // ── Unified keyboard shortcuts ───────────────
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (importModal && !importModal.hidden) closeImportModal();
            if (exportMenu && !exportMenu.hidden) closeExportMenu();
            if (shortcutsPopover && !shortcutsPopover.hidden) closeShortcutsPopover();
            return;
        }

        var mod = e.metaKey || e.ctrlKey;
        if (!mod) return;

        if (e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            if (e.shiftKey) redo(); else undo();
            return;
        }

        if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            clearTimeout(saveTimer);
            doSave();
            return;
        }

        if (e.key === 'p' || e.key === 'P') {
            e.preventDefault();
            doExport('pdf');
            return;
        }
    });

    window.addEventListener('beforeunload', function () {
        if (!resumeId) return;
        var snapshot = JSON.stringify({ data: state.data, typo: state.typo });
        if (snapshot === lastSavedSnapshot) return;
        navigator.sendBeacon(
            '/api/resume/' + resumeId,
            new Blob(
                [JSON.stringify({ data: state.data, typography: state.typo })],
                { type: 'application/json' }
            )
        );
    });

    initResumeId();
})();
