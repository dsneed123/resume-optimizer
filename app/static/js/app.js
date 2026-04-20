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

    // ── Section tab navigation ───────────────────
    const navBtns = document.querySelectorAll('.sidebar-nav-btn');
    const sections = document.querySelectorAll('.sidebar-section');

    navBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            navBtns.forEach(function (b) { b.classList.remove('active'); });
            sections.forEach(function (s) { s.classList.remove('active'); });

            btn.classList.add('active');
            var target = document.getElementById('section-' + btn.dataset.section);
            if (target) target.classList.add('active');
        });
    });

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
            this._styleEl.textContent = `
                #resumePage {
                    padding: ${t.margin_top}in ${t.margin_right}in ${t.margin_bottom}in ${t.margin_left}in;
                    font-family: ${t.font_family}, Arial, sans-serif;
                    font-size: ${t.font_size_body}pt;
                    line-height: ${t.line_height};
                    color: #000;
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
                    content: " | ";
                    color: #999;
                }
                #resumePage .rv-header {
                    text-align: center;
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
                    border-bottom: 1pt solid #000;
                    padding-bottom: 1pt;
                    margin-bottom: 4pt;
                }
                #resumePage .rv-entry {
                    margin-bottom: ${t.paragraph_spacing}pt;
                }
                #resumePage .rv-entry-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                }
                #resumePage .rv-entry-title {
                    font-weight: bold;
                    font-size: ${t.font_size_body}pt;
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
                    list-style: disc;
                    padding-left: ${t.bullet_indent}pt;
                    margin-top: 2pt;
                }
                #resumePage .rv-bullets li {
                    font-size: ${t.font_size_body}pt;
                    line-height: ${t.line_height};
                    margin-bottom: 1pt;
                }
                #resumePage .rv-skill-cat {
                    font-weight: bold;
                }
                #resumePage .rv-skill-row {
                    margin-bottom: 2pt;
                    font-size: ${t.font_size_body}pt;
                }
                #resumePage .rv-cert {
                    margin-bottom: ${t.paragraph_spacing}pt;
                }
                #resumePage .rv-cert-name {
                    font-weight: bold;
                    font-size: ${t.font_size_body}pt;
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

        _render() {
            const d = this.data;
            if (!d) return;
            let html = '';

            // Header
            const h = d.header || {};
            html += '<div class="rv-header">';
            html += `<div class="rv-name">${this._esc(h.name)}</div>`;
            html += '<div class="rv-contact">';
            if (h.email) html += `<span>${this._esc(h.email)}</span>`;
            if (h.phone) html += `<span>${this._esc(h.phone)}</span>`;
            if (h.location) html += `<span>${this._esc(h.location)}</span>`;
            if (h.linkedin) html += `<span>${this._esc(h.linkedin)}</span>`;
            if (h.website) html += `<span>${this._esc(h.website)}</span>`;
            html += '</div></div>';

            // Summary
            if (d.summary) {
                html += '<div class="rv-section">';
                html += '<div class="rv-section-title">Summary</div>';
                html += `<div>${this._esc(d.summary)}</div>`;
                html += '</div>';
            }

            // Experience
            const exp = (d.experience || []).filter(e => e.company || e.title);
            if (exp.length) {
                html += '<div class="rv-section">';
                html += '<div class="rv-section-title">Experience</div>';
                for (const e of exp) {
                    html += '<div class="rv-entry">';
                    html += '<div class="rv-entry-header">';
                    html += `<span class="rv-entry-title">${this._esc(e.title)}</span>`;
                    const dates = [e.start_date, e.end_date].filter(Boolean).join(' \u2013 ');
                    if (dates) html += `<span class="rv-entry-date">${this._esc(dates)}</span>`;
                    html += '</div>';
                    let sub = this._esc(e.company);
                    if (e.location) sub += ` \u2014 ${this._esc(e.location)}`;
                    html += `<div class="rv-entry-sub">${sub}</div>`;
                    if (e.bullets && e.bullets.length) {
                        html += '<ul class="rv-bullets">';
                        for (const b of e.bullets) html += `<li>${this._esc(b)}</li>`;
                        html += '</ul>';
                    }
                    html += '</div>';
                }
                html += '</div>';
            }

            // Education
            const edu = (d.education || []).filter(e => e.school);
            if (edu.length) {
                html += '<div class="rv-section">';
                html += '<div class="rv-section-title">Education</div>';
                for (const e of edu) {
                    html += '<div class="rv-entry">';
                    html += '<div class="rv-entry-header">';
                    html += `<span class="rv-entry-title">${this._esc(e.school)}</span>`;
                    if (e.graduation_date) html += `<span class="rv-entry-date">${this._esc(e.graduation_date)}</span>`;
                    html += '</div>';
                    const parts = [e.degree, e.field].filter(Boolean).join(', ');
                    let sub = parts;
                    if (e.gpa) sub += ` \u00b7 GPA: ${e.gpa}`;
                    if (e.honors) sub += ` \u00b7 ${e.honors}`;
                    if (sub) html += `<div class="rv-entry-sub">${this._esc(sub)}</div>`;
                    html += '</div>';
                }
                html += '</div>';
            }

            // Skills
            const skills = (d.skills || []).filter(s => s.category || (s.items && s.items.length));
            if (skills.length) {
                html += '<div class="rv-section">';
                html += '<div class="rv-section-title">Skills</div>';
                for (const s of skills) {
                    html += '<div class="rv-skill-row">';
                    if (s.category) html += `<span class="rv-skill-cat">${this._esc(s.category)}:</span> `;
                    html += this._esc((s.items || []).join(', '));
                    html += '</div>';
                }
                html += '</div>';
            }

            // Projects
            const projects = (d.projects || []).filter(p => p.name);
            if (projects.length) {
                html += '<div class="rv-section">';
                html += '<div class="rv-section-title">Projects</div>';
                for (const p of projects) {
                    html += '<div class="rv-entry">';
                    html += '<div class="rv-entry-header">';
                    html += `<span class="rv-entry-title">${this._esc(p.name)}</span>`;
                    if (p.url) html += `<span class="rv-entry-date">${this._esc(p.url)}</span>`;
                    html += '</div>';
                    if (p.technologies) html += `<div class="rv-entry-sub">${this._esc(p.technologies)}</div>`;
                    if (p.description) html += `<div style="margin-top:2pt">${this._esc(p.description)}</div>`;
                    html += '</div>';
                }
                html += '</div>';
            }

            // Certifications
            const certs = (d.certifications || []).filter(c => c.name);
            if (certs.length) {
                html += '<div class="rv-section">';
                html += '<div class="rv-section-title">Certifications</div>';
                for (const c of certs) {
                    html += '<div class="rv-cert">';
                    html += '<div class="rv-entry-header">';
                    html += `<span class="rv-cert-name">${this._esc(c.name)}</span>`;
                    if (c.date) html += `<span class="rv-entry-date">${this._esc(c.date)}</span>`;
                    html += '</div>';
                    if (c.issuer) html += `<div class="rv-entry-sub">${this._esc(c.issuer)}</div>`;
                    html += '</div>';
                }
                html += '</div>';
            }

            // Awards
            const awards = (d.awards || []).filter(a => a.name);
            if (awards.length) {
                html += '<div class="rv-section">';
                html += '<div class="rv-section-title">Awards</div>';
                for (const a of awards) {
                    html += '<div class="rv-entry">';
                    html += '<div class="rv-entry-header">';
                    html += `<span class="rv-entry-title">${this._esc(a.name)}</span>`;
                    if (a.date) html += `<span class="rv-entry-date">${this._esc(a.date)}</span>`;
                    html += '</div>';
                    if (a.issuer) html += `<div class="rv-entry-sub">${this._esc(a.issuer)}</div>`;
                    if (a.description) html += `<div style="margin-top:2pt">${this._esc(a.description)}</div>`;
                    html += '</div>';
                }
                html += '</div>';
            }

            // Show placeholder if nothing was rendered
            if (!html.trim() || (!h.name && !d.summary && !exp.length && !edu.length && !skills.length && !projects.length && !certs.length && !awards.length)) {
                this.page.innerHTML = '<p class="preview-placeholder">Import a resume or fill in the fields on the left to get started.</p>';
                return;
            }

            this.page.innerHTML = html;
        }
    }

    // ── Default state ────────────────────────────
    function defaultData() {
        return {
            header: { name: '', email: '', phone: '', location: '', linkedin: '', website: '' },
            summary: '',
            experience: [],
            education: [],
            skills: [],
            certifications: [],
            projects: [],
            awards: [],
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
        };
    }

    // ── Init preview ─────────────────────────────
    const pageEl = document.getElementById('resumePage');
    const previewEl = document.getElementById('preview');

    if (!pageEl || !previewEl) return;

    const state = { data: defaultData(), typo: defaultTypo() };
    const preview = new ResumePreview(pageEl, previewEl);
    preview.update(state.data, state.typo);

    function notifyChange() {
        preview.update(state.data, state.typo);
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
})();
