// Resume Optimizer — main app entry point

// ── Theme management ─────────────────────────────
(function () {
    var LS_THEME_KEY = 'ro_theme';

    function getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        var resolved = theme === 'system' ? getSystemTheme() : theme;
        document.documentElement.setAttribute('data-theme', resolved);
        var btn = document.getElementById('themeToggleBtn');
        if (!btn) return;
        var sun = btn.querySelector('.theme-icon-sun');
        var moon = btn.querySelector('.theme-icon-moon');
        if (resolved === 'dark') {
            btn.setAttribute('aria-label', 'Switch to light mode');
            if (sun) sun.style.display = 'none';
            if (moon) moon.style.display = '';
        } else {
            btn.setAttribute('aria-label', 'Switch to dark mode');
            if (sun) sun.style.display = '';
            if (moon) moon.style.display = 'none';
        }
    }

    function initTheme() {
        var saved = null;
        try { saved = localStorage.getItem(LS_THEME_KEY); } catch (e) {}
        applyTheme(saved || 'system');

        var btn = document.getElementById('themeToggleBtn');
        if (btn) {
            btn.addEventListener('click', function () {
                var current = document.documentElement.getAttribute('data-theme');
                var next = current === 'dark' ? 'light' : 'dark';
                try { localStorage.setItem(LS_THEME_KEY, next); } catch (e) {}
                applyTheme(next);
            });
        }

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
            var pref = null;
            try { pref = localStorage.getItem(LS_THEME_KEY); } catch (e) {}
            if (!pref) applyTheme('system');
        });
    }

    initTheme();
})();

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

    // Auto-close sidebar when viewport grows past the mobile breakpoint
    var mql = window.matchMedia('(min-width: 1025px)');
    function onBreakpointChange(e) { if (e.matches) closeSidebar(); }
    if (mql.addEventListener) {
        mql.addEventListener('change', onBreakpointChange);
    } else {
        mql.addListener(onBreakpointChange); // Safari <14 fallback
    }

    // Expose closeSidebar for use in nav click handler
    window._closeSidebar = closeSidebar;

    // ── Section tab navigation (dynamic — see renderSidebarNav below) ───

    // ── ResumePreview ────────────────────────────
    class ResumePreview {
        constructor(pageEl, previewEl) {
            this.page = pageEl;
            this.pageWrap = pageEl.parentElement; // .page-wrap shadow container
            this.preview = previewEl;
            this._zoom = null; // null = auto-fit
            this._zoomLevelEl = null;
            this.data = null;
            this.typo = null;

            // Inject a dedicated <style> element for typography
            this._styleEl = document.createElement('style');
            this._styleEl.id = 'rv-typo-style';
            document.head.appendChild(this._styleEl);

            this._ro = new ResizeObserver(() => this._applyScale());
            this._ro.observe(this.preview);

            this._initZoomControls();
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
            let s;

            if (this._zoom !== null) {
                s = this._zoom;
            } else {
                s = (available > 0 && available < PAGE_W) ? available / PAGE_W : 1;
            }

            const el = this.pageWrap || this.page;

            if (s !== 1) {
                el.style.transform = `scale(${s.toFixed(4)})`;
            } else {
                el.style.transform = '';
            }

            if (s < 1) {
                // Shrink layout footprint to match visual size
                const h = el.offsetHeight;
                el.style.marginBottom = `${Math.round(h * (s - 1))}px`;
            } else {
                el.style.marginBottom = '';
            }

            if (this._zoomLevelEl) {
                this._zoomLevelEl.textContent = Math.round(s * 100) + '%';
            }
        }

        _initZoomControls() {
            this._zoomLevelEl = document.getElementById('zoomLevel');

            const zoomInBtn = document.getElementById('zoomInBtn');
            const zoomOutBtn = document.getElementById('zoomOutBtn');
            const zoomFitWidthBtn = document.getElementById('zoomFitWidthBtn');
            const zoomFitHeightBtn = document.getElementById('zoomFitHeightBtn');

            if (zoomInBtn) zoomInBtn.addEventListener('click', () => this._adjustZoom(0.1));
            if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this._adjustZoom(-0.1));
            if (zoomFitWidthBtn) zoomFitWidthBtn.addEventListener('click', () => {
                this._zoom = null;
                this._applyScale();
            });
            if (zoomFitHeightBtn) zoomFitHeightBtn.addEventListener('click', () => {
                this._fitToHeight();
            });

            this.preview.addEventListener('wheel', (e) => {
                if (!e.ctrlKey && !e.metaKey) return;
                e.preventDefault();
                this._adjustZoom(e.deltaY > 0 ? -0.1 : 0.1);
            }, { passive: false });

            this._initPinchZoom();
        }

        _initPinchZoom() {
            let startDist = null;
            let startZoom = null;

            const getTouchDist = (t) => {
                const dx = t[0].clientX - t[1].clientX;
                const dy = t[0].clientY - t[1].clientY;
                return Math.sqrt(dx * dx + dy * dy);
            };

            this.preview.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    startDist = getTouchDist(e.touches);
                    const PAGE_W = 816;
                    const available = this.preview.clientWidth - 64;
                    const autoFit = (available > 0 && available < PAGE_W) ? available / PAGE_W : 1;
                    startZoom = this._zoom !== null ? this._zoom : autoFit;
                }
            }, { passive: true });

            this.preview.addEventListener('touchmove', (e) => {
                if (e.touches.length !== 2 || startDist === null) return;
                e.preventDefault();
                const dist = getTouchDist(e.touches);
                const ratio = dist / startDist;
                this._zoom = Math.min(2, Math.max(0.5, Math.round(startZoom * ratio * 20) / 20));
                this._applyScale();
            }, { passive: false });

            this.preview.addEventListener('touchend', (e) => {
                if (e.touches.length < 2) {
                    startDist = null;
                    startZoom = null;
                }
            }, { passive: true });
        }

        _adjustZoom(delta) {
            const PAGE_W = 816;
            const available = this.preview.clientWidth - 64;
            const autoFit = (available > 0 && available < PAGE_W) ? available / PAGE_W : 1;
            const current = this._zoom !== null ? this._zoom : autoFit;
            this._zoom = Math.min(2, Math.max(0.5, Math.round((current + delta) * 20) / 20));
            this._applyScale();
        }

        _fitToHeight() {
            const PAGE_H = 1056;
            const availableH = this.preview.clientHeight - 64;
            if (availableH > 0) {
                this._zoom = Math.min(2, Math.max(0.5, availableH / PAGE_H));
                this._applyScale();
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
                `<div class="rv-summary rv-editable" data-edit="summary">${this._esc(d.summary)}</div>` +
                '</div>';
        }

        _renderExperienceHtml(d) {
            if (d.show_experience === false) return '';
            const allExp = d.experience || [];
            if (!allExp.some(e => e.company || e.title)) return '';
            let html = '<div class="rv-section"><div class="rv-section-title">Experience</div>';
            allExp.forEach((e, realIdx) => {
                if (!e.company && !e.title) return;
                html += '<div class="rv-entry"><div class="rv-entry-header">';
                html += `<span class="rv-entry-left"><span class="rv-entry-title rv-editable" data-edit="experience.${realIdx}.title">${this._esc(e.title)}</span>`;
                if (e.company) html += ` | <span class="rv-editable" data-edit="experience.${realIdx}.company">${this._esc(e.company)}</span>`;
                if (e.location) html += ` \u00b7 ${this._esc(e.location)}`;
                html += '</span>';
                const fmt = (this.typo && this.typo.date_format) || 'MMM YYYY';
                const dates = [e.start_date, e.end_date].filter(Boolean).map(d => this._formatDate(d, fmt)).join(' \u2013 ');
                if (dates) html += `<span class="rv-entry-date">${this._esc(dates)}</span>`;
                html += '</div>';
                if (e.bullets && e.bullets.length) {
                    html += '<ul class="rv-bullets">';
                    e.bullets.forEach((b, bi) => {
                        html += `<li class="rv-editable" data-edit="experience.${realIdx}.bullet.${bi}">${this._renderInlineMd(b)}</li>`;
                    });
                    html += '</ul>';
                }
                html += '</div>';
            });
            return html + '</div>';
        }

        _renderEducationHtml(d) {
            if (d.show_education === false) return '';
            const allEdu = d.education || [];
            if (!allEdu.some(e => e.school)) return '';
            let html = '<div class="rv-section"><div class="rv-section-title">Education</div>';
            allEdu.forEach((e, realIdx) => {
                if (!e.school) return;
                html += '<div class="rv-entry"><div class="rv-entry-header">';
                html += `<span class="rv-entry-left"><span class="rv-entry-title rv-editable" data-edit="education.${realIdx}.school">${this._esc(e.school)}</span>`;
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
            });
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
            const allProj = d.projects || [];
            if (!allProj.some(p => p.name) || d.show_projects === false) return '';
            let html = '<div class="rv-section"><div class="rv-section-title">Projects</div>';
            allProj.forEach((p, realIdx) => {
                if (!p.name) return;
                html += '<div class="rv-entry"><div class="rv-entry-header">';
                html += `<span class="rv-entry-left"><span class="rv-entry-title rv-editable" data-edit="projects.${realIdx}.name">${this._esc(p.name)}</span>`;
                if (p.technologies) html += ` \u00b7 ${this._esc(p.technologies)}`;
                html += '</span>';
                if (p.url) html += `<span class="rv-entry-date">${this._esc(p.url)}</span>`;
                html += '</div>';
                if (p.description) html += `<div style="font-size:${this.typo.font_size_body}pt;margin-top:2pt">${this._esc(p.description)}</div>`;
                html += '</div>';
            });
            return html + '</div>';
        }

        _renderCertificationsHtml(d) {
            const allCerts = d.certifications || [];
            if (!allCerts.some(c => c.name) || d.show_certifications === false) return '';
            let html = '<div class="rv-section"><div class="rv-section-title">Certifications</div>';
            allCerts.forEach((c, realIdx) => {
                if (!c.name) return;
                html += '<div class="rv-cert"><div class="rv-entry-header">';
                html += `<span class="rv-cert-name rv-editable" data-edit="certifications.${realIdx}.name">${this._esc(c.name)}</span>`;
                if (c.date) { const fmtC = (this.typo && this.typo.date_format) || 'MMM YYYY'; html += `<span class="rv-entry-date">${this._esc(this._formatDate(c.date, fmtC))}</span>`; }
                html += '</div>';
                if (c.issuer) html += `<div class="rv-cert-meta">${this._esc(c.issuer)}</div>`;
                html += '</div>';
            });
            return html + '</div>';
        }

        _renderCustomSectionHtml(d, id) {
            var cs = (d.custom_sections || []).find(function (s) { return s.id === id; });
            if (!cs || cs.show === false) return '';
            var bullets = (cs.bullets || []).filter(Boolean);
            if (!cs.title && !bullets.length) return '';
            var html = '<div class="rv-section"><div class="rv-section-title">' + this._esc(cs.title || 'Custom Section') + '</div>';
            if (bullets.length) {
                html += '<ul class="rv-bullets">';
                for (var i = 0; i < bullets.length; i++) html += '<li>' + this._renderInlineMd(bullets[i]) + '</li>';
                html += '</ul>';
            }
            html += '</div>';
            return html;
        }

        _renderAwardsHtml(d) {
            const allAwards = d.awards || [];
            if (!allAwards.some(a => a.name) || d.show_awards === false) return '';
            let html = '<div class="rv-section"><div class="rv-section-title">Awards</div>';
            allAwards.forEach((a, realIdx) => {
                if (!a.name) return;
                html += '<div class="rv-entry"><div class="rv-entry-header">';
                html += `<span class="rv-entry-left"><span class="rv-entry-title rv-editable" data-edit="awards.${realIdx}.name">${this._esc(a.name)}</span>`;
                if (a.issuer) html += ` | ${this._esc(a.issuer)}`;
                html += '</span>';
                if (a.date) { const fmtA = (this.typo && this.typo.date_format) || 'MMM YYYY'; html += `<span class="rv-entry-date">${this._esc(this._formatDate(a.date, fmtA))}</span>`; }
                html += '</div>';
                if (a.description) html += `<div style="font-size:${this.typo.font_size_body}pt;margin-top:2pt">${this._esc(a.description)}</div>`;
                html += '</div>';
            });
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
            html += `<div class="rv-name rv-editable" data-edit="header.name">${this._esc(h.name)}</div>`;
            html += '<div class="rv-contact">';
            if (h.email) html += `<span class="rv-editable" data-edit="header.email">${this._esc(h.email)}</span>`;
            if (h.phone) html += `<span class="rv-editable" data-edit="header.phone">${this._esc(h.phone)}</span>`;
            if (h.location) html += `<span class="rv-editable" data-edit="header.location">${this._esc(h.location)}</span>`;
            if (h.linkedin) html += `<span class="rv-editable" data-edit="header.linkedin">${this._esc(h.linkedin)}</span>`;
            if (h.website) html += `<span class="rv-editable" data-edit="header.website">${this._esc(h.website)}</span>`;
            html += '</div></div>';
            html += '<hr class="rv-header-rule">';

            // Remaining sections in user-defined order
            const order = d.section_order || ['summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'awards'];
            for (const section of order) {
                if (section.startsWith('custom_')) {
                    const id = parseInt(section.slice(7));
                    html += this._renderCustomSectionHtml(d, id);
                } else {
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
            }

            // Show placeholder if nothing was rendered
            const hasContent = h.name || d.summary ||
                (d.experience || []).some(e => e.company || e.title) ||
                (d.education || []).some(e => e.school) ||
                (d.skills || []).some(s => s.category || (s.items && s.items.length)) ||
                (d.projects || []).some(p => p.name) ||
                (d.certifications || []).some(c => c.name) ||
                (d.awards || []).some(a => a.name) ||
                (d.custom_sections || []).some(cs => cs.title || (cs.bullets && cs.bullets.some(Boolean)));

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

    var customSectionCounter = 0;

    function initCustomSectionCounter() {
        var maxId = (state.data.custom_sections || []).reduce(function (m, s) {
            return Math.max(m, s.id || 0);
        }, 0);
        if (maxId > customSectionCounter) customSectionCounter = maxId;
    }

    function nextCustomSectionId() {
        return ++customSectionCounter;
    }

    var SECTION_META = {
        summary:        { label: 'Summary',     showKey: 'show_summary' },
        experience:     { label: 'Experience',  showKey: 'show_experience' },
        education:      { label: 'Education',   showKey: 'show_education' },
        skills:         { label: 'Skills',      showKey: 'show_skills' },
        projects:       { label: 'Projects',    showKey: 'show_projects' },
        certifications: { label: 'Certs',       showKey: 'show_certifications' },
        awards:         { label: 'Awards',      showKey: 'show_awards' },
    };

    var SECTION_COUNT_GETTERS = {
        experience:     function () { return (state.data.experience || []).length; },
        education:      function () { return (state.data.education || []).length; },
        skills:         function () { return (state.data.skills || []).length; },
        projects:       function () { return (state.data.projects || []).length; },
        certifications: function () { return (state.data.certifications || []).length; },
        awards:         function () { return (state.data.awards || []).length; },
    };

    var LS_COLLAPSED_KEY = 'ro_collapsed_sections';

    function loadCollapsedSections() {
        try { return JSON.parse(localStorage.getItem(LS_COLLAPSED_KEY) || '{}'); }
        catch (e) { return {}; }
    }

    function saveCollapsedSections(map) {
        try { localStorage.setItem(LS_COLLAPSED_KEY, JSON.stringify(map)); }
        catch (e) {}
    }

    var CHEVRON_SVG = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    function updateSectionBadge(key) {
        var getter = SECTION_COUNT_GETTERS[key];
        if (!getter) return;
        var badge = document.getElementById('badge-' + key);
        if (badge) badge.textContent = getter();
    }

    function updateSectionBadges() {
        Object.keys(SECTION_COUNT_GETTERS).forEach(updateSectionBadge);
        (state.data.custom_sections || []).forEach(function (cs) {
            var badge = document.getElementById('badge-custom_' + cs.id);
            if (badge) badge.textContent = (cs.bullets || []).length;
        });
    }

    function initPanelCollapsibility(panel) {
        if (!panel || panel.dataset.collapsibleInit) return;
        panel.dataset.collapsibleInit = '1';

        var header = panel.querySelector('.section-header');
        if (!header) return;

        // Wrap non-header children in section-body if not already present
        if (!panel.querySelector('.section-body')) {
            var body = document.createElement('div');
            body.className = 'section-body';
            Array.from(panel.children).forEach(function (child) {
                if (!child.classList.contains('section-header')) body.appendChild(child);
            });
            panel.appendChild(body);
        }

        var chevron = document.createElement('span');
        chevron.className = 'section-chevron';
        chevron.innerHTML = CHEVRON_SVG;

        var title = header.querySelector('.section-title');
        var sectionKey = panel.id.replace('section-', '');

        if (title) {
            var leftGroup = document.createElement('div');
            leftGroup.className = 'section-header-group';
            leftGroup.appendChild(chevron);
            header.removeChild(title);
            leftGroup.appendChild(title);
            if (SECTION_COUNT_GETTERS[sectionKey] || sectionKey.startsWith('custom_')) {
                var badge = document.createElement('span');
                badge.className = 'section-badge';
                badge.id = 'badge-' + sectionKey;
                leftGroup.appendChild(badge);
            }
            header.insertBefore(leftGroup, header.firstChild);
        } else {
            // Custom section: input-based title — add chevron + badge separately
            header.insertBefore(chevron, header.firstChild);
            var badge = document.createElement('span');
            badge.className = 'section-badge';
            badge.id = 'badge-' + sectionKey;
            var titleInput = header.querySelector('.custom-section-title');
            if (titleInput) titleInput.insertAdjacentElement('afterend', badge);
        }

        var collapsedMap = loadCollapsedSections();
        if (collapsedMap[panel.id]) panel.classList.add('section-collapsed');

        header.addEventListener('click', function (e) {
            if (e.target.closest('.add-btn') ||
                e.target.closest('.summary-toggle') ||
                e.target.tagName === 'INPUT') return;
            var isNowCollapsed = panel.classList.toggle('section-collapsed');
            var map = loadCollapsedSections();
            map[panel.id] = isNowCollapsed;
            saveCollapsedSections(map);
        });
    }

    function initSectionCollapsibility() {
        document.querySelectorAll('.sidebar-section').forEach(initPanelCollapsibility);
        updateSectionBadges();
    }

    function getSectionMeta(key) {
        if (SECTION_META[key]) return SECTION_META[key];
        if (key.startsWith('custom_')) {
            var id = parseInt(key.slice(7));
            var cs = (state.data.custom_sections || []).find(function (s) { return s.id === id; });
            return {
                label: cs ? (cs.title || 'Custom Section') : 'Custom Section',
                showKey: null,
                isCustom: true,
                customId: id
            };
        }
        return null;
    }

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
            custom_sections: [],
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

    // ── Click-to-edit: preview → sidebar ────────────
    function scrollSidebarToEl(el) {
        var sidebar = document.getElementById('sidebar');
        if (!sidebar || !el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function focusSidebarField(path) {
        var parts = path.split('.');
        var section = parts[0];

        var navKey = section;
        var nav = document.getElementById('sidebarNav');
        if (nav) {
            var navBtn = nav.querySelector('.sidebar-nav-btn[data-section="' + navKey + '"]');
            if (navBtn) navBtn.click();
        }

        setTimeout(function () {
            if (section === 'header') {
                var fieldEl = document.getElementById(parts[1]);
                if (fieldEl) { fieldEl.focus(); fieldEl.select(); scrollSidebarToEl(fieldEl); }

            } else if (section === 'summary') {
                var summEl = document.getElementById('summary');
                if (summEl) { summEl.focus(); scrollSidebarToEl(summEl); }

            } else {
                var idx = parseInt(parts[1], 10);
                var fieldName = parts[2];
                var itemSelMap = {
                    experience:     '.exp-item',
                    education:      '.edu-item',
                    skills:         '.skill-item',
                    certifications: '.cert-item',
                    projects:       '.proj-item',
                    awards:         '.award-item',
                };
                var itemSel = itemSelMap[section];
                if (!itemSel) return;

                var itemEl = document.querySelector(itemSel + '[data-index="' + idx + '"]');
                if (!itemEl) return;

                if (itemEl.classList.contains('collapsed')) {
                    var hdrEl = itemEl.querySelector(
                        '.exp-item-header, .edu-item-header, .skill-item-header, ' +
                        '.cert-item-header, .proj-item-header, .award-item-header'
                    );
                    if (hdrEl) hdrEl.click();
                }

                setTimeout(function () {
                    var input;
                    if (fieldName === 'bullet' && parts[3] !== undefined) {
                        var bi = parseInt(parts[3], 10);
                        input = itemEl.querySelector('.bullet-input[data-bi="' + bi + '"]');
                    } else if (section === 'skills' && fieldName === 'category') {
                        input = itemEl.querySelector('.skill-cat-field');
                    } else {
                        input = itemEl.querySelector('[data-field="' + fieldName + '"]');
                    }
                    if (input) {
                        input.focus();
                        if (input.tagName === 'INPUT') input.select();
                        scrollSidebarToEl(input);
                    }
                }, 80);
            }
        }, 0);
    }

    pageEl.addEventListener('click', function (e) {
        var target = e.target.closest('[data-edit]');
        if (!target) return;
        var editPath = target.dataset.edit;
        focusSidebarField(editPath);
        target.classList.add('rv-edit-flash');
        setTimeout(function () { target.classList.remove('rv-edit-flash'); }, 600);
    });

    // ── Auto-save ────────────────────────────────
    var resumeId = null;
    var saveTimer = null;
    var lastSavedSnapshot = null;
    var saveStatusEl = document.getElementById('saveStatus');
    var saveSpinnerEl = document.getElementById('saveSpinner');

    function setSaveStatus(status) {
        if (!saveStatusEl) return;
        saveStatusEl.className = 'save-status';
        if (status === 'saving') {
            saveStatusEl.classList.add('saving');
            saveStatusEl.textContent = 'Saving...';
            if (saveSpinnerEl) saveSpinnerEl.hidden = false;
        } else if (status === 'saved') {
            saveStatusEl.classList.add('saved');
            saveStatusEl.textContent = 'Saved';
            if (saveSpinnerEl) saveSpinnerEl.hidden = true;
        } else if (status === 'error') {
            saveStatusEl.classList.add('error');
            saveStatusEl.textContent = 'Error saving';
            if (saveSpinnerEl) saveSpinnerEl.hidden = true;
        } else {
            saveStatusEl.textContent = '';
            if (saveSpinnerEl) saveSpinnerEl.hidden = true;
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
            showToast('Changes could not be saved. Please try again.', 'error');
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

    // ── Confirmation dialog ──────────────────────
    var confirmModalEl      = document.getElementById('confirmModal');
    var confirmModalTitle   = document.getElementById('confirmModalTitle');
    var confirmModalMessage = document.getElementById('confirmModalMessage');
    var confirmModalOkBtn   = document.getElementById('confirmModalOkBtn');
    var confirmModalCancel  = document.getElementById('confirmModalCancelBtn');
    var confirmModalClose   = document.getElementById('confirmModalClose');
    var _confirmCallback    = null;

    function _closeConfirmModal() {
        if (confirmModalEl) confirmModalEl.hidden = true;
        _confirmCallback = null;
    }

    function confirmDialog(opts, onConfirm) {
        if (!confirmModalEl) { if (onConfirm && confirm(opts.message)) onConfirm(); return; }
        if (confirmModalTitle)   confirmModalTitle.textContent   = opts.title   || 'Confirm';
        if (confirmModalMessage) confirmModalMessage.textContent = opts.message || 'Are you sure?';
        if (confirmModalOkBtn) {
            confirmModalOkBtn.textContent = opts.confirmText || 'Confirm';
            confirmModalOkBtn.className = 'modal-btn ' + (opts.isDanger ? 'modal-btn--danger' : 'modal-btn--primary');
        }
        _confirmCallback = onConfirm || null;
        confirmModalEl.hidden = false;
        if (confirmModalOkBtn) confirmModalOkBtn.focus();
    }

    if (confirmModalOkBtn) {
        confirmModalOkBtn.addEventListener('click', function () {
            var cb = _confirmCallback;
            _closeConfirmModal();
            if (cb) cb();
        });
    }
    if (confirmModalCancel)  confirmModalCancel.addEventListener('click',  _closeConfirmModal);
    if (confirmModalClose)   confirmModalClose.addEventListener('click',   _closeConfirmModal);
    if (confirmModalEl) {
        confirmModalEl.addEventListener('click', function (e) {
            if (e.target === confirmModalEl) _closeConfirmModal();
        });
    }

    function notifyChange() {
        preview.update(state.data, state.typo);
        schedulePageCheck();
        scheduleSave();
        scheduleAtsRefresh();
        updateSectionBadges();
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

        renderAllCustomSectionPanels();
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
            if (key.startsWith('custom_')) {
                var id = parseInt(key.slice(7));
                var cs = (state.data.custom_sections || []).find(function (s) { return s.id === id; });
                var panel = document.getElementById('section-' + key);
                if (panel) panel.classList.toggle('section-content-hidden', cs ? cs.show === false : false);
                return;
            }
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

        // Remove all non-contact, non-typography, non-ats, non-job-match buttons
        Array.from(nav.querySelectorAll('.sidebar-nav-btn:not([data-section="header"]):not([data-section="typography"]):not([data-section="ats"]):not([data-section="job-match"])')).forEach(function (b) {
            nav.removeChild(b);
        });

        // Remove the add custom section button if present (will be re-added below)
        var existingAddBtn = nav.querySelector('.add-custom-section-nav');
        if (existingAddBtn) existingAddBtn.remove();

        // Add buttons in section_order order, each with a drag handle
        // Insert before the Typography button so it stays last
        var typoNavBtn = nav.querySelector('.sidebar-nav-btn[data-section="typography"]');
        var order = state.data.section_order || DEFAULT_SECTION_ORDER;
        order.forEach(function (key) {
            var meta = getSectionMeta(key);
            if (!meta) return;
            var isVisible;
            if (meta.isCustom) {
                var cs = (state.data.custom_sections || []).find(function (s) { return s.id === meta.customId; });
                isVisible = !cs || cs.show !== false;
            } else {
                isVisible = !meta.showKey || state.data[meta.showKey] !== false;
            }
            var btn = document.createElement('button');
            btn.className = 'sidebar-nav-btn' + (activeSection === key ? ' active' : '') + (isVisible ? '' : ' section-hidden');
            btn.dataset.section = key;
            btn.innerHTML = '<span class="nav-drag-handle" title="Drag to reorder">⠿</span>' +
                '<span class="nav-label">' + escHtml(meta.label) + '</span>' +
                '<button class="nav-eye-btn" title="' + (isVisible ? 'Hide section' : 'Show section') + '" aria-label="' + (isVisible ? 'Hide section' : 'Show section') + '">' +
                (isVisible ? EYE_OPEN_SVG : EYE_CLOSED_SVG) +
                '</button>';
            if (typoNavBtn) {
                nav.insertBefore(btn, typoNavBtn);
            } else {
                nav.appendChild(btn);
            }
        });

        // Add "Add Custom Section" button before Typography
        var addCustomBtn = document.createElement('button');
        addCustomBtn.className = 'add-custom-section-nav';
        addCustomBtn.textContent = '+ Add Custom Section';
        addCustomBtn.addEventListener('click', addCustomSection);
        if (typoNavBtn) {
            nav.insertBefore(addCustomBtn, typoNavBtn);
        } else {
            nav.appendChild(addCustomBtn);
        }

        updateSectionPanelVisibility();

        bindNavClicks();
        bindNavDragDrop();
    }

    function bindNavClicks() {
        var nav = document.getElementById('sidebarNav');
        if (!nav) return;
        var allNavBtns = nav.querySelectorAll('.sidebar-nav-btn');

        allNavBtns.forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                if (e.target.closest('.nav-drag-handle')) return;
                if (e.target.closest('.nav-eye-btn')) {
                    pushHistory();
                    var key = btn.dataset.section;
                    if (key && key.startsWith('custom_')) {
                        var id = parseInt(key.slice(7));
                        var cs = (state.data.custom_sections || []).find(function (s) { return s.id === id; });
                        if (cs) {
                            cs.show = cs.show === false ? true : false;
                            renderSidebarNav();
                            notifyChange();
                        }
                    } else {
                        var meta = SECTION_META[key];
                        if (meta && meta.showKey) {
                            state.data[meta.showKey] = state.data[meta.showKey] === false ? true : false;
                            renderSidebarNav();
                            notifyChange();
                        }
                    }
                    return;
                }
                // Query allSections fresh to include dynamically added custom section panels
                var allSections = document.querySelectorAll('.sidebar-section');
                allNavBtns.forEach(function (b) { b.classList.remove('active'); });
                allSections.forEach(function (s) { s.classList.remove('active'); });
                btn.classList.add('active');
                var target = document.getElementById('section-' + btn.dataset.section);
                if (target) target.classList.add('active');
                // Close sidebar on mobile after selecting a section
                if (window.innerWidth <= 1024 && window._closeSidebar) window._closeSidebar();
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

    var VERB_CATEGORIES = [
        { label: 'Leadership',  verbs: ['Led', 'Directed', 'Managed', 'Oversaw'] },
        { label: 'Achievement', verbs: ['Achieved', 'Increased', 'Reduced', 'Improved'] },
        { label: 'Technical',   verbs: ['Developed', 'Engineered', 'Implemented', 'Architected'] }
    ];

    var _ACTION_VERB_SET = new Set([
        'accelerated', 'achieved', 'administered', 'advanced', 'analyzed',
        'architected', 'automated', 'built', 'championed', 'collaborated',
        'communicated', 'completed', 'conducted', 'configured', 'consolidated',
        'contributed', 'coordinated', 'created', 'cut', 'debugged', 'defined',
        'delivered', 'deployed', 'designed', 'developed', 'directed', 'drove',
        'engineered', 'established', 'evaluated', 'executed', 'expanded',
        'facilitated', 'generated', 'guided', 'identified', 'implemented',
        'improved', 'increased', 'initiated', 'integrated', 'launched', 'led',
        'maintained', 'managed', 'mentored', 'migrated', 'modernized', 'monitored',
        'negotiated', 'optimized', 'orchestrated', 'oversaw', 'owned', 'partnered',
        'performed', 'planned', 'produced', 'provided', 'reduced', 'refactored',
        'researched', 'resolved', 'reviewed', 'scaled', 'shipped', 'simplified',
        'solved', 'spearheaded', 'streamlined', 'supported', 'tested', 'trained',
        'transformed', 'updated', 'wrote'
    ]);

    function bulletStartsWithActionVerb(text) {
        var trimmed = text.trim();
        if (!trimmed) return true;
        var firstWord = trimmed.split(/\s+/)[0].replace(/[^a-zA-Z]/g, '').toLowerCase();
        return _ACTION_VERB_SET.has(firstWord);
    }

    function buildVerbDropdownHTML() {
        return '<div class="verb-dropdown" hidden>' +
            VERB_CATEGORIES.map(function (cat) {
                return '<div class="verb-dropdown-cat">' +
                    '<span class="verb-dropdown-cat-label">' + cat.label + '</span>' +
                    '<div class="verb-chips">' +
                    cat.verbs.map(function (v) {
                        return '<button class="verb-chip" type="button" data-verb="' + v + '">' + v + '</button>';
                    }).join('') +
                    '</div>' +
                    '</div>';
            }).join('') +
            '</div>';
    }

    function buildBulletHTML(text, bi) {
        return '<div class="bullet-item" draggable="true" data-bi="' + bi + '">' +
            '<span class="bullet-drag-handle" title="Drag to reorder">⠿</span>' +
            '<div class="bullet-reorder">' +
            '<button class="bullet-up" data-bi="' + bi + '" title="Move up">▲</button>' +
            '<button class="bullet-down" data-bi="' + bi + '" title="Move down">▼</button>' +
            '</div>' +
            '<div class="bullet-input-wrap">' +
            '<input class="field-input bullet-input" data-bi="' + bi + '" type="text" value="' + escHtml(text) + '" placeholder="Describe an achievement...">' +
            buildVerbDropdownHTML() +
            '</div>' +
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

        var renderBullets = function () {
            bulletList.innerHTML = state.data.experience[index].bullets.map(buildBulletHTML).join('');
            bindBulletDragDrop(bulletList, state.data.experience[index].bullets, renderBullets);
        };
        bindBulletDragDrop(bulletList, state.data.experience[index].bullets, renderBullets);

        header.addEventListener('click', function (e) {
            if (e.target.closest('.exp-delete-btn') || e.target.closest('.drag-handle')) return;
            var nowCollapsed = item.classList.toggle('collapsed');
            expOpenStates[index] = !nowCollapsed;
            toggleBtn.textContent = nowCollapsed ? '▸' : '▾';
        });

        item.querySelector('.exp-delete-btn').addEventListener('click', function () {
            confirmDialog({
                title: 'Delete Experience',
                message: 'Delete this experience entry? This cannot be undone.',
                confirmText: 'Delete',
                isDanger: true
            }, function () {
                pushHistory();
                state.data.experience.splice(index, 1);
                expOpenStates.splice(index, 1);
                renderExperienceList();
                notifyChange();
            });
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
                var dropdown = e.target.parentElement.querySelector('.verb-dropdown');
                if (dropdown) dropdown.hidden = bulletStartsWithActionVerb(e.target.value);
            }
        });

        bulletList.addEventListener('focusin', function (e) {
            if (e.target.classList.contains('bullet-input')) {
                var dropdown = e.target.parentElement.querySelector('.verb-dropdown');
                if (dropdown) dropdown.hidden = bulletStartsWithActionVerb(e.target.value);
            }
        });

        bulletList.addEventListener('focusout', function (e) {
            if (e.target.classList.contains('bullet-input')) {
                var wrap = e.target.parentElement;
                setTimeout(function () {
                    var dropdown = wrap.querySelector('.verb-dropdown');
                    if (dropdown) dropdown.hidden = true;
                }, 150);
            }
        });

        bulletList.addEventListener('click', function (e) {
            var removeBtn = e.target.closest('.bullet-remove');
            var upBtn = e.target.closest('.bullet-up');
            var downBtn = e.target.closest('.bullet-down');
            var verbChip = e.target.closest('.verb-chip');
            var bullets = state.data.experience[index].bullets;
            var bi, tmp;

            if (verbChip) {
                var wrap = verbChip.closest('.bullet-input-wrap');
                var input = wrap.querySelector('.bullet-input');
                bi = parseInt(input.dataset.bi);
                var verb = verbChip.dataset.verb;
                var current = input.value.trim();
                input.value = verb + (current ? ' ' + current : ' ');
                bullets[bi] = input.value;
                wrap.querySelector('.verb-dropdown').hidden = true;
                input.focus();
                notifyChange();
            } else if (removeBtn) {
                bi = parseInt(removeBtn.dataset.bi);
                pushHistory();
                bullets.splice(bi, 1);
                renderBullets();
                notifyChange();
            } else if (upBtn) {
                bi = parseInt(upBtn.dataset.bi);
                if (bi > 0) {
                    pushHistory();
                    tmp = bullets[bi - 1];
                    bullets[bi - 1] = bullets[bi];
                    bullets[bi] = tmp;
                    renderBullets();
                    notifyChange();
                }
            } else if (downBtn) {
                bi = parseInt(downBtn.dataset.bi);
                if (bi < bullets.length - 1) {
                    pushHistory();
                    tmp = bullets[bi];
                    bullets[bi] = bullets[bi + 1];
                    bullets[bi + 1] = tmp;
                    renderBullets();
                    notifyChange();
                }
            }
        });

        item.querySelector('.add-bullet-btn').addEventListener('click', function () {
            pushHistory();
            state.data.experience[index].bullets.push('');
            renderBullets();
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

    function bindBulletDragDrop(bulletList, bullets, renderFn) {
        var items = bulletList.querySelectorAll('.bullet-item');
        var dragSrcIndex = null;

        items.forEach(function (item) {
            item.addEventListener('dragstart', function (e) {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
                    e.preventDefault();
                    return;
                }
                dragSrcIndex = parseInt(item.dataset.bi);
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

            item.addEventListener('dragleave', function (e) {
                if (!item.contains(e.relatedTarget)) {
                    item.classList.remove('drag-over');
                }
            });

            item.addEventListener('drop', function (e) {
                e.preventDefault();
                var dropIndex = parseInt(item.dataset.bi);
                if (dragSrcIndex !== null && dragSrcIndex !== dropIndex) {
                    pushHistory();
                    var moved = bullets.splice(dragSrcIndex, 1)[0];
                    bullets.splice(dropIndex, 0, moved);
                    renderFn();
                    notifyChange();
                }
                item.classList.remove('drag-over');
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
            confirmDialog({
                title: 'Delete Education',
                message: 'Delete this education entry? This cannot be undone.',
                confirmText: 'Delete',
                isDanger: true
            }, function () {
                pushHistory();
                state.data.education.splice(index, 1);
                eduOpenStates.splice(index, 1);
                renderEducationList();
                notifyChange();
            });
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
            confirmDialog({
                title: 'Delete Skill Category',
                message: 'Delete this skill category? This cannot be undone.',
                confirmText: 'Delete',
                isDanger: true
            }, function () {
                pushHistory();
                state.data.skills.splice(index, 1);
                skillOpenStates.splice(index, 1);
                renderSkillList();
                notifyChange();
            });
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
            confirmDialog({
                title: 'Delete Certification',
                message: 'Delete this certification? This cannot be undone.',
                confirmText: 'Delete',
                isDanger: true
            }, function () {
                pushHistory();
                state.data.certifications.splice(index, 1);
                certOpenStates.splice(index, 1);
                renderCertList();
                notifyChange();
            });
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
            confirmDialog({
                title: 'Delete Project',
                message: 'Delete this project? This cannot be undone.',
                confirmText: 'Delete',
                isDanger: true
            }, function () {
                pushHistory();
                state.data.projects.splice(index, 1);
                projOpenStates.splice(index, 1);
                renderProjectList();
                notifyChange();
            });
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
            confirmDialog({
                title: 'Delete Award',
                message: 'Delete this award? This cannot be undone.',
                confirmText: 'Delete',
                isDanger: true
            }, function () {
                pushHistory();
                state.data.awards.splice(index, 1);
                awardOpenStates.splice(index, 1);
                renderAwardList();
                notifyChange();
            });
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

    // ── Custom sections ──────────────────────────
    function buildCustomSectionPanel(cs) {
        var panel = document.createElement('div');
        panel.className = 'sidebar-section';
        panel.id = 'section-custom_' + cs.id;

        var bulletsHtml = (cs.bullets || []).map(buildBulletHTML).join('');

        panel.innerHTML =
            '<div class="section-header">' +
                '<input class="field-input custom-section-title" type="text" value="' + escHtml(cs.title || '') + '" placeholder="Section Title">' +
                '<button class="add-btn">+ Add</button>' +
            '</div>' +
            '<div class="section-body">' +
                '<div class="bullet-list" id="customBulletList_' + cs.id + '">' + bulletsHtml + '</div>' +
                '<div class="custom-section-footer">' +
                    '<button class="delete-custom-section-btn">Delete this section</button>' +
                '</div>' +
            '</div>';

        var titleInput = panel.querySelector('.custom-section-title');
        titleInput.addEventListener('input', function () {
            cs.title = this.value;
            renderSidebarNav();
            notifyChange();
        });

        var addBulletBtn = panel.querySelector('.add-btn');
        var bulletList = panel.querySelector('#customBulletList_' + cs.id);

        var renderCustomBullets = function () {
            if (!cs.bullets) cs.bullets = [];
            bulletList.innerHTML = cs.bullets.map(buildBulletHTML).join('');
            bindBulletDragDrop(bulletList, cs.bullets, renderCustomBullets);
        };
        bindBulletDragDrop(bulletList, cs.bullets || [], renderCustomBullets);

        addBulletBtn.addEventListener('click', function () {
            pushHistory();
            if (!cs.bullets) cs.bullets = [];
            cs.bullets.push('');
            renderCustomBullets();
            notifyChange();
            var inputs = bulletList.querySelectorAll('.bullet-input');
            if (inputs.length) inputs[inputs.length - 1].focus();
        });

        bulletList.addEventListener('input', function (e) {
            if (e.target.classList.contains('bullet-input')) {
                var bi = parseInt(e.target.dataset.bi);
                if (!cs.bullets) cs.bullets = [];
                cs.bullets[bi] = e.target.value;
                notifyChange();
            }
        });

        bulletList.addEventListener('click', function (e) {
            var removeBtn = e.target.closest('.bullet-remove');
            var upBtn = e.target.closest('.bullet-up');
            var downBtn = e.target.closest('.bullet-down');
            var bullets = cs.bullets || [];
            var bi, tmp;

            if (removeBtn) {
                bi = parseInt(removeBtn.dataset.bi);
                pushHistory();
                bullets.splice(bi, 1);
                renderCustomBullets();
                notifyChange();
            } else if (upBtn) {
                bi = parseInt(upBtn.dataset.bi);
                if (bi > 0) {
                    pushHistory();
                    tmp = bullets[bi - 1];
                    bullets[bi - 1] = bullets[bi];
                    bullets[bi] = tmp;
                    renderCustomBullets();
                    notifyChange();
                }
            } else if (downBtn) {
                bi = parseInt(downBtn.dataset.bi);
                if (bi < bullets.length - 1) {
                    pushHistory();
                    tmp = bullets[bi];
                    bullets[bi] = bullets[bi + 1];
                    bullets[bi + 1] = tmp;
                    renderCustomBullets();
                    notifyChange();
                }
            }
        });

        panel.querySelector('.delete-custom-section-btn').addEventListener('click', function () {
            confirmDialog({
                title: 'Delete Section',
                message: 'Delete this custom section? This cannot be undone.',
                confirmText: 'Delete',
                isDanger: true
            }, function () {
                pushHistory();
                var idx = (state.data.custom_sections || []).findIndex(function (s) { return s.id === cs.id; });
                if (idx !== -1) state.data.custom_sections.splice(idx, 1);
                var orderIdx = state.data.section_order.indexOf('custom_' + cs.id);
                if (orderIdx !== -1) state.data.section_order.splice(orderIdx, 1);
                renderAllCustomSectionPanels();
                renderSidebarNav();
                notifyChange();
            });
        });

        return panel;
    }

    function renderAllCustomSectionPanels() {
        var container = document.getElementById('customSectionsContainer');
        if (!container) return;
        container.innerHTML = '';
        (state.data.custom_sections || []).forEach(function (cs) {
            container.appendChild(buildCustomSectionPanel(cs));
        });
        initCustomSectionCounter();
        initSectionCollapsibility();
    }

    function addCustomSection() {
        pushHistory();
        var id = nextCustomSectionId();
        var cs = { id: id, title: '', bullets: [], show: true };
        if (!state.data.custom_sections) state.data.custom_sections = [];
        state.data.custom_sections.push(cs);
        state.data.section_order.push('custom_' + id);
        renderAllCustomSectionPanels();
        renderSidebarNav();
        notifyChange();
        var newNavBtn = document.querySelector('[data-section="custom_' + id + '"]');
        if (newNavBtn) newNavBtn.click();
    }

    renderAllCustomSectionPanels();

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
    var toastContainerEl = document.getElementById('toastContainer');

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

    function showToast(message, type) {
        if (!toastContainerEl) return;
        var autoDismiss = type === 'error' ? 0 : (type === 'success' ? 3000 : 4000);

        var toast = document.createElement('div');
        toast.className = 'toast toast--' + (type || 'info');

        var msg = document.createElement('span');
        msg.className = 'toast__message';
        msg.textContent = message;
        toast.appendChild(msg);

        var closeBtn = document.createElement('button');
        closeBtn.className = 'toast__close';
        closeBtn.setAttribute('aria-label', 'Dismiss');
        closeBtn.textContent = '\u00d7';
        toast.appendChild(closeBtn);

        function dismiss() {
            toast.classList.add('toast--hiding');
            toast.addEventListener('transitionend', function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, { once: true });
        }

        closeBtn.addEventListener('click', dismiss);

        toastContainerEl.appendChild(toast);
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                toast.classList.add('toast--visible');
            });
        });

        if (autoDismiss > 0) {
            setTimeout(dismiss, autoDismiss);
        }
    }

    function showAutoFitToast(message) {
        showToast(message, 'info');
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

    // ── Import preview modal ──────────────────────
    var importPreviewModal      = document.getElementById('importPreviewModal');
    var importPreviewBody       = document.getElementById('importPreviewBody');
    var importPreviewAcceptBtn  = document.getElementById('importPreviewAcceptBtn');
    var importPreviewReimportBtn = document.getElementById('importPreviewReimportBtn');
    var importPreviewModalClose = document.getElementById('importPreviewModalClose');

    var pendingImportData = null;
    var pendingImportId   = null;

    function openImportPreviewModal() {
        if (importPreviewModal) importPreviewModal.hidden = false;
    }

    function closeImportPreviewModal() {
        if (importPreviewModal) importPreviewModal.hidden = true;
        pendingImportData = null;
        pendingImportId = null;
    }

    function buildSectionContentHTML(key, sectionData) {
        if (key === 'header') {
            var h = sectionData || {};
            var parts = [];
            if (h.name) parts.push('<strong>' + escHtml(h.name) + '</strong>');
            if (h.email) parts.push(escHtml(h.email));
            if (h.phone) parts.push(escHtml(h.phone));
            if (h.location) parts.push(escHtml(h.location));
            if (h.linkedin) parts.push(escHtml(h.linkedin));
            if (h.website) parts.push(escHtml(h.website));
            return parts.length ? parts.join(' &middot; ') : '<span class="import-preview-empty">No contact info detected</span>';
        }
        if (key === 'summary') {
            if (!sectionData) return '<span class="import-preview-empty">No summary</span>';
            var text = sectionData.length > 160 ? sectionData.slice(0, 160) + '\u2026' : sectionData;
            return escHtml(text);
        }
        if (key === 'experience') {
            if (!sectionData || !sectionData.length) return '<span class="import-preview-empty">No entries</span>';
            var lis = sectionData.map(function (e) {
                var who = [e.title, e.company].filter(Boolean).join(' at ');
                var dates = [e.start_date, e.end_date].filter(Boolean).join(' \u2013 ');
                var bcount = e.bullets && e.bullets.length ? e.bullets.length + ' bullet' + (e.bullets.length === 1 ? '' : 's') : '';
                return '<li>' + escHtml(who || '(Untitled)') +
                    (dates ? ' <span class="import-preview-detail">(' + escHtml(dates) + ')</span>' : '') +
                    (bcount ? ' <span class="import-preview-detail">\u00b7 ' + escHtml(bcount) + '</span>' : '') +
                    '</li>';
            });
            return '<ul class="import-preview-list">' + lis.join('') + '</ul>';
        }
        if (key === 'education') {
            if (!sectionData || !sectionData.length) return '<span class="import-preview-empty">No entries</span>';
            var lis = sectionData.map(function (e) {
                var deg = e.degree && e.field ? e.degree + ' in ' + e.field : (e.degree || e.field || '');
                var desc = [deg, e.school].filter(Boolean).join(' \u2014 ');
                return '<li>' + escHtml(desc || '(Untitled)') +
                    (e.graduation_date ? ' <span class="import-preview-detail">(' + escHtml(e.graduation_date) + ')</span>' : '') +
                    '</li>';
            });
            return '<ul class="import-preview-list">' + lis.join('') + '</ul>';
        }
        if (key === 'skills') {
            if (!sectionData || !sectionData.length) return '<span class="import-preview-empty">No skills</span>';
            var lis = sectionData.map(function (s) {
                return '<li><strong>' + escHtml(s.category || 'General') + '</strong>: ' + escHtml((s.items || []).join(', ')) + '</li>';
            });
            return '<ul class="import-preview-list">' + lis.join('') + '</ul>';
        }
        if (key === 'certifications' || key === 'projects' || key === 'awards') {
            if (!sectionData || !sectionData.length) return '<span class="import-preview-empty">None</span>';
            var lis = sectionData.map(function (e) {
                var desc = key === 'projects' && e.description
                    ? ' \u2014 ' + (e.description.length > 80 ? e.description.slice(0, 80) + '\u2026' : e.description)
                    : (e.issuer ? ' \u2014 ' + e.issuer : '');
                return '<li>' + escHtml(e.name || '(Untitled)') +
                    (desc ? '<span class="import-preview-detail">' + escHtml(desc) + '</span>' : '') + '</li>';
            });
            return '<ul class="import-preview-list">' + lis.join('') + '</ul>';
        }
        return '';
    }

    function showImportPreview(data, parseMeta) {
        if (!importPreviewBody) return;
        var sections = [
            { key: 'header',         label: 'Contact Information' },
            { key: 'summary',        label: 'Summary'             },
            { key: 'experience',     label: 'Experience'          },
            { key: 'education',      label: 'Education'           },
            { key: 'skills',         label: 'Skills'              },
            { key: 'certifications', label: 'Certifications'      },
            { key: 'projects',       label: 'Projects'            },
            { key: 'awards',         label: 'Awards'              },
        ];
        var html = '';
        sections.forEach(function (sec) {
            var meta = (parseMeta && parseMeta[sec.key]) || { confidence: 'high', notes: [] };
            var isLow = meta.confidence === 'low';
            html += '<div class="import-preview-section' + (isLow ? ' import-preview-section--low' : '') + '">' +
                '<div class="import-preview-section-head">' +
                    '<span class="import-preview-section-name">' + escHtml(sec.label) + '</span>' +
                    '<span class="import-preview-confidence import-preview-confidence--' + (isLow ? 'low">\u26a0 Low confidence' : 'high">\u2713 Parsed') + '</span>' +
                '</div>';
            if (meta.notes && meta.notes.length) {
                html += '<div class="import-preview-section-notes">' + escHtml(meta.notes.join('; ')) + '</div>';
            }
            html += '<div class="import-preview-section-content">' +
                buildSectionContentHTML(sec.key, data[sec.key]) +
                '</div></div>';
        });
        importPreviewBody.innerHTML = html;
        openImportPreviewModal();
    }

    if (importPreviewModalClose) {
        importPreviewModalClose.addEventListener('click', closeImportPreviewModal);
    }

    if (importPreviewModal) {
        importPreviewModal.addEventListener('click', function (e) {
            if (e.target === importPreviewModal) closeImportPreviewModal();
        });
    }

    if (importPreviewReimportBtn) {
        importPreviewReimportBtn.addEventListener('click', function () {
            closeImportPreviewModal();
            openImportModal();
        });
    }

    if (importPreviewAcceptBtn) {
        importPreviewAcceptBtn.addEventListener('click', function () {
            if (!pendingImportData) return;
            confirmDialog({
                title: 'Replace Current Resume',
                message: 'This will replace your current resume with the imported content. This cannot be undone.',
                confirmText: 'Import',
                isDanger: true
            }, function () {
                var data = pendingImportData;
                var id   = pendingImportId;
                closeImportPreviewModal();
                pushHistory();
                loadImportedData(data);
                resumeId = id;
                lastSavedSnapshot = JSON.stringify({ data: state.data, typo: state.typo });
                showToast('Resume imported successfully.', 'success');
            });
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
    var importProgress  = document.getElementById('importProgress');
    var importCancelBtn = document.getElementById('importCancelBtn');
    var importModalClose = document.getElementById('importModalClose');
    var importBtn       = document.getElementById('importBtn');
    var importTabFile        = document.getElementById('importTabFile');
    var importTabText        = document.getElementById('importTabText');
    var importTabLinkedIn    = document.getElementById('importTabLinkedIn');
    var importPanelFile      = document.getElementById('importPanelFile');
    var importPanelText      = document.getElementById('importPanelText');
    var importPanelLinkedIn  = document.getElementById('importPanelLinkedIn');
    var importTextarea       = document.getElementById('importTextarea');
    var importLinkedInTextarea = document.getElementById('importLinkedInTextarea');

    var selectedFile = null;
    var importActiveTab = 'file';

    function switchImportTab(tab) {
        importActiveTab = tab;
        var isFile = tab === 'file';
        var isText = tab === 'text';
        var isLinkedIn = tab === 'linkedin';
        if (importTabFile) {
            importTabFile.classList.toggle('import-tab--active', isFile);
            importTabFile.setAttribute('aria-selected', isFile ? 'true' : 'false');
        }
        if (importTabText) {
            importTabText.classList.toggle('import-tab--active', isText);
            importTabText.setAttribute('aria-selected', isText ? 'true' : 'false');
        }
        if (importTabLinkedIn) {
            importTabLinkedIn.classList.toggle('import-tab--active', isLinkedIn);
            importTabLinkedIn.setAttribute('aria-selected', isLinkedIn ? 'true' : 'false');
        }
        if (importPanelFile) importPanelFile.hidden = !isFile;
        if (importPanelText) importPanelText.hidden = !isText;
        if (importPanelLinkedIn) importPanelLinkedIn.hidden = !isLinkedIn;
        if (importError) importError.hidden = true;
        if (importConfirmBtn) {
            if (isFile) {
                importConfirmBtn.disabled = !selectedFile;
            } else if (isText) {
                importConfirmBtn.disabled = !(importTextarea && importTextarea.value.trim());
            } else {
                importConfirmBtn.disabled = !(importLinkedInTextarea && importLinkedInTextarea.value.trim());
            }
        }
    }

    function openImportModal() {
        resetImportModal();
        if (importModal) importModal.hidden = false;
    }

    function closeImportModal() {
        if (importModal) importModal.hidden = true;
    }

    function resetImportModal() {
        selectedFile = null;
        importActiveTab = 'file';
        if (importFileInput) importFileInput.value = '';
        if (importFileInfo) importFileInfo.hidden = true;
        if (importError) importError.hidden = true;
        if (importProgress) importProgress.hidden = true;
        if (importConfirmBtn) importConfirmBtn.disabled = true;
        if (importSpinner) importSpinner.hidden = true;
        if (importDropzone) importDropzone.classList.remove('drag-over');
        if (importTextarea) importTextarea.value = '';
        if (importTabFile) {
            importTabFile.classList.add('import-tab--active');
            importTabFile.setAttribute('aria-selected', 'true');
        }
        if (importTabText) {
            importTabText.classList.remove('import-tab--active');
            importTabText.setAttribute('aria-selected', 'false');
        }
        if (importTabLinkedIn) {
            importTabLinkedIn.classList.remove('import-tab--active');
            importTabLinkedIn.setAttribute('aria-selected', 'false');
        }
        if (importLinkedInTextarea) importLinkedInTextarea.value = '';
        if (importPanelFile) importPanelFile.hidden = false;
        if (importPanelText) importPanelText.hidden = true;
        if (importPanelLinkedIn) importPanelLinkedIn.hidden = true;
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

    function showImportError(msg, offerPasteText) {
        if (!importError) return;
        importError.hidden = false;
        while (importError.firstChild) importError.removeChild(importError.firstChild);
        importError.appendChild(document.createTextNode(msg));
        if (offerPasteText) {
            var link = document.createElement('button');
            link.type = 'button';
            link.className = 'import-error-link';
            link.textContent = ' Try pasting text instead.';
            link.addEventListener('click', function () { switchImportTab('text'); });
            importError.appendChild(link);
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

        renderAllCustomSectionPanels();
        renderSidebarNav();
        renderExperienceList();
        renderEducationList();
        renderSkillList();
        renderCertList();
        renderProjectList();
        renderAwardList();
        notifyChange();
    }

    if (importTabFile) {
        importTabFile.addEventListener('click', function () { switchImportTab('file'); });
    }

    if (importTabText) {
        importTabText.addEventListener('click', function () { switchImportTab('text'); });
    }

    if (importTabLinkedIn) {
        importTabLinkedIn.addEventListener('click', function () { switchImportTab('linkedin'); });
    }

    if (importTextarea) {
        importTextarea.addEventListener('input', function () {
            if (importActiveTab === 'text' && importConfirmBtn) {
                importConfirmBtn.disabled = !importTextarea.value.trim();
            }
        });
    }

    if (importLinkedInTextarea) {
        importLinkedInTextarea.addEventListener('input', function () {
            if (importActiveTab === 'linkedin' && importConfirmBtn) {
                importConfirmBtn.disabled = !importLinkedInTextarea.value.trim();
            }
        });
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

    var _LARGE_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

    if (importConfirmBtn) {
        importConfirmBtn.addEventListener('click', function () {
            importConfirmBtn.disabled = true;
            if (importSpinner) importSpinner.hidden = false;
            if (importError) importError.hidden = true;
            if (importProgress) importProgress.hidden = true;

            var isFileTab = importActiveTab === 'file';
            var fetchPromise;
            if (importActiveTab === 'text') {
                var text = importTextarea ? importTextarea.value : '';
                if (!text.trim()) {
                    importConfirmBtn.disabled = false;
                    if (importSpinner) importSpinner.hidden = true;
                    return;
                }
                fetchPromise = fetch('/api/import/text', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: text }),
                });
            } else if (importActiveTab === 'linkedin') {
                var liText = importLinkedInTextarea ? importLinkedInTextarea.value : '';
                if (!liText.trim()) {
                    importConfirmBtn.disabled = false;
                    if (importSpinner) importSpinner.hidden = true;
                    return;
                }
                fetchPromise = fetch('/api/import/linkedin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: liText }),
                });
            } else {
                if (!selectedFile) {
                    importConfirmBtn.disabled = false;
                    if (importSpinner) importSpinner.hidden = true;
                    return;
                }
                if (importProgress && selectedFile.size > _LARGE_FILE_BYTES) {
                    importProgress.hidden = false;
                }
                var formData = new FormData();
                formData.append('file', selectedFile);
                fetchPromise = fetch('/api/import', { method: 'POST', body: formData });
            }

            fetchPromise
                .then(function (r) {
                    return r.json().then(function (body) {
                        return { ok: r.ok, status: r.status, body: body };
                    });
                })
                .then(function (res) {
                    if (importSpinner) importSpinner.hidden = true;
                    if (importProgress) importProgress.hidden = true;
                    if (!res.ok) {
                        showImportError(res.body.error || 'Import failed. Please try again.', isFileTab);
                        importConfirmBtn.disabled = false;
                        return;
                    }
                    pendingImportData = res.body.data;
                    pendingImportId   = res.body.id;
                    closeImportModal();
                    showImportPreview(res.body.data, res.body.parse_meta || {});
                })
                .catch(function () {
                    if (importSpinner) importSpinner.hidden = true;
                    if (importProgress) importProgress.hidden = true;
                    showImportError('Network error. Please check your connection and try again.', isFileTab);
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
            showToast(format.toUpperCase() + ' export complete.', 'success');
        })
        .catch(function (err) {
            showToast((err && err.message) || 'Export failed. Please try again.', 'error');
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

    var printBtn = document.getElementById('printBtn');
    if (printBtn) {
        printBtn.addEventListener('click', function () { window.print(); });
    }

    // ── New Resume button ────────────────────────
    var newResumeBtn = document.getElementById('newResumeBtn');
    if (newResumeBtn) {
        newResumeBtn.addEventListener('click', function () {
            confirmDialog({
                title: 'Start New Resume',
                message: 'Start a new resume? Your current resume will be discarded.',
                confirmText: 'Start New',
                isDanger: true
            }, function () {
                pushHistory();
                Object.assign(state.data, defaultData());
                expOpenStates.length = 0;
                eduOpenStates.length = 0;
                skillOpenStates.length = 0;
                certOpenStates.length = 0;
                projOpenStates.length = 0;
                awardOpenStates.length = 0;
                ['name','email','phone','location','linkedin','website'].forEach(function (f) {
                    var el = document.getElementById(f);
                    if (el) el.value = '';
                });
                if (summaryEl) summaryEl.value = '';
                updateCharCount();
                renderAllCustomSectionPanels();
                renderSidebarNav();
                renderExperienceList();
                renderEducationList();
                renderSkillList();
                renderCertList();
                renderProjectList();
                renderAwardList();
                notifyChange();
                showToast('Started a new resume.', 'success');
            });
        });
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
                showToast(msg, 'info');
            })
            .catch(function () {
                autoFitBtn.disabled = false;
                showToast('Auto-fit failed. Please try again.', 'error');
            });
        });
    }

    // ── ATS Score Panel ──────────────────────────
    var atsScoreTimer = null;
    var atsGaugeWrapEl  = document.getElementById('atsGaugeWrap');
    var atsGaugeFillEl  = document.getElementById('atsGaugeFill');
    var atsScoreNumEl   = document.getElementById('atsScoreNumber');
    var atsScoreLblEl   = document.getElementById('atsScoreLabel');
    var atsIssuesEl     = document.getElementById('atsIssuesList');
    var atsSuggestionsEl = document.getElementById('atsSuggestionsList');
    var refreshAtsBtnEl  = document.getElementById('refreshAtsBtn');

    var ATS_CIRCUMFERENCE = 2 * Math.PI * 40; // ≈ 251.33

    var ATS_ERROR_ICON =
        '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">' +
        '<circle cx="6.5" cy="6.5" r="5.75" stroke="currentColor" stroke-width="1.3"/>' +
        '<path d="M6.5 4v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
        '<circle cx="6.5" cy="9" r="0.65" fill="currentColor"/>' +
        '</svg>';

    var ATS_WARNING_ICON =
        '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">' +
        '<path d="M6.5 1.5L12 11H1L6.5 1.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>' +
        '<path d="M6.5 5v2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
        '<circle cx="6.5" cy="9.5" r="0.65" fill="currentColor"/>' +
        '</svg>';

    var ATS_SUGGEST_ICON =
        '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">' +
        '<circle cx="6.5" cy="6.5" r="5.75" stroke="currentColor" stroke-width="1.3"/>' +
        '<path d="M6.5 3.5v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
        '<circle cx="6.5" cy="9.5" r="0.65" fill="currentColor"/>' +
        '</svg>';

    function scheduleAtsRefresh() {
        clearTimeout(atsScoreTimer);
        atsScoreTimer = setTimeout(fetchAtsScore, 2000);
    }

    function fetchAtsScore() {
        if (refreshAtsBtnEl) refreshAtsBtnEl.disabled = true;
        if (atsGaugeWrapEl) atsGaugeWrapEl.classList.add('ats-loading');
        fetch('/api/resume/ats-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: state.data })
        })
        .then(function (r) { return r.json(); })
        .then(function (result) {
            if (atsGaugeWrapEl) atsGaugeWrapEl.classList.remove('ats-loading');
            renderAtsScore(result);
            if (refreshAtsBtnEl) refreshAtsBtnEl.disabled = false;
        })
        .catch(function () {
            if (atsGaugeWrapEl) atsGaugeWrapEl.classList.remove('ats-loading');
            if (refreshAtsBtnEl) refreshAtsBtnEl.disabled = false;
        });
    }

    function renderAtsScore(result) {
        var score = typeof result.score === 'number' ? result.score : 0;

        if (atsScoreNumEl) atsScoreNumEl.textContent = score;

        if (atsGaugeFillEl) {
            var filled = (score / 100) * ATS_CIRCUMFERENCE;
            atsGaugeFillEl.style.strokeDashoffset = String(ATS_CIRCUMFERENCE - filled);
        }

        var colorClass, label;
        if (score >= 75) {
            colorClass = 'ats-gauge-wrap--green';
            label = 'Good';
        } else if (score >= 50) {
            colorClass = 'ats-gauge-wrap--yellow';
            label = 'Fair';
        } else {
            colorClass = 'ats-gauge-wrap--red';
            label = 'Needs Work';
        }
        if (atsGaugeWrapEl) atsGaugeWrapEl.className = 'ats-gauge-wrap ' + colorClass;
        if (atsScoreLblEl) atsScoreLblEl.textContent = label;

        if (atsIssuesEl) {
            var issues = result.issues || [];
            if (issues.length === 0) {
                atsIssuesEl.innerHTML = '<p class="ats-empty">No issues found.</p>';
            } else {
                atsIssuesEl.innerHTML = '<div class="ats-list-title">Issues</div>' +
                    issues.map(function (issue) {
                        var icon = issue.severity === 'error' ? ATS_ERROR_ICON : ATS_WARNING_ICON;
                        return '<div class="ats-item ats-item--' + escHtml(issue.severity) + '">' +
                            '<span class="ats-item-icon">' + icon + '</span>' +
                            '<span>' + escHtml(issue.message) + '</span>' +
                            '</div>';
                    }).join('');
            }
        }

        if (atsSuggestionsEl) {
            var suggestions = result.suggestions || [];
            if (suggestions.length > 0) {
                atsSuggestionsEl.innerHTML = '<div class="ats-list-title">Suggestions</div>' +
                    suggestions.map(function (s) {
                        return '<div class="ats-item ats-item--suggestion">' +
                            '<span class="ats-item-icon">' + ATS_SUGGEST_ICON + '</span>' +
                            '<span>' + escHtml(s.message) + '</span>' +
                            '</div>';
                    }).join('');
            } else {
                atsSuggestionsEl.innerHTML = '';
            }
        }
    }

    if (refreshAtsBtnEl) {
        refreshAtsBtnEl.addEventListener('click', fetchAtsScore);
    }

    // ── Job Match Panel ───────────────────────────
    var jobDescInputEl       = document.getElementById('jobDescriptionInput');
    var analyzeJobMatchBtnEl = document.getElementById('analyzeJobMatchBtn');
    var clearJobMatchBtnEl   = document.getElementById('clearJobMatchBtn');
    var jobMatchResultsEl    = document.getElementById('jobMatchResults');
    var jobMatchScoreNumEl   = document.getElementById('jobMatchScoreNumber');
    var jobMatchScoreLblEl   = document.getElementById('jobMatchScoreLabel');
    var jobMatchScoreBarEl   = document.getElementById('jobMatchScoreBar');
    var jobMatchMatchedEl    = document.getElementById('jobMatchMatched');
    var jobMatchMissingEl    = document.getElementById('jobMatchMissing');
    var jobMatchSuggestionsEl = document.getElementById('jobMatchSuggestions');

    var JM_CHECK_ICON =
        '<svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">' +
        '<circle cx="5.5" cy="5.5" r="5" fill="#22c55e"/>' +
        '<path d="M3 5.5l2 2 3-3" stroke="#fff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';

    var JM_MISS_ICON =
        '<svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">' +
        '<circle cx="5.5" cy="5.5" r="5" fill="#ef4444"/>' +
        '<path d="M3.5 3.5l4 4M7.5 3.5l-4 4" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>' +
        '</svg>';

    function fetchJobMatch() {
        var jd = jobDescInputEl ? jobDescInputEl.value.trim() : '';
        if (!jd) return;
        if (analyzeJobMatchBtnEl) analyzeJobMatchBtnEl.disabled = true;
        fetch('/api/resume/job-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: state.data, job_description: jd })
        })
        .then(function (r) { return r.json(); })
        .then(function (result) {
            renderJobMatch(result);
            if (analyzeJobMatchBtnEl) analyzeJobMatchBtnEl.disabled = false;
        })
        .catch(function () {
            if (analyzeJobMatchBtnEl) analyzeJobMatchBtnEl.disabled = false;
        });
    }

    function renderJobMatch(result) {
        var pct = typeof result.match_percentage === 'number' ? result.match_percentage : 0;
        if (jobMatchScoreNumEl) jobMatchScoreNumEl.textContent = pct + '%';
        if (jobMatchScoreLblEl) {
            jobMatchScoreLblEl.textContent = pct >= 75 ? 'Strong Match' : pct >= 50 ? 'Partial Match' : 'Low Match';
        }
        if (jobMatchScoreBarEl) {
            jobMatchScoreBarEl.style.width = pct + '%';
            jobMatchScoreBarEl.className = 'jm-score-bar-fill' +
                (pct >= 75 ? ' jm-bar--green' : pct >= 50 ? ' jm-bar--yellow' : ' jm-bar--red');
        }

        var matched = result.matched_keywords || [];
        var missing = result.missing_keywords || [];

        if (jobMatchMatchedEl) {
            if (matched.length > 0) {
                jobMatchMatchedEl.innerHTML =
                    '<div class="ats-list-title">Matched Keywords (' + matched.length + ')</div>' +
                    '<div class="jm-chips">' +
                    matched.map(function (m) {
                        return '<span class="jm-chip jm-chip--match" title="Found in: ' + escHtml(m.locations.join(', ')) + '">' +
                            JM_CHECK_ICON + ' ' + escHtml(m.keyword) + '</span>';
                    }).join('') +
                    '</div>';
            } else {
                jobMatchMatchedEl.innerHTML = '<p class="ats-empty">No keywords matched.</p>';
            }
        }

        if (jobMatchMissingEl) {
            if (missing.length > 0) {
                jobMatchMissingEl.innerHTML =
                    '<div class="ats-list-title">Missing Keywords (' + missing.length + ')</div>' +
                    '<div class="jm-chips">' +
                    missing.map(function (m) {
                        return '<span class="jm-chip jm-chip--miss" title="' + escHtml(m.suggestion) + '">' +
                            JM_MISS_ICON + ' ' + escHtml(m.keyword) + '</span>';
                    }).join('') +
                    '</div>';
            } else {
                jobMatchMissingEl.innerHTML = '<p class="ats-empty">All keywords found!</p>';
            }
        }

        if (jobMatchSuggestionsEl) {
            var uniqueSuggestions = [];
            var seen = {};
            missing.forEach(function (m) {
                if (m.suggestion && !seen[m.suggestion]) {
                    seen[m.suggestion] = true;
                    uniqueSuggestions.push({ suggestion: m.suggestion, keywords: [] });
                }
                uniqueSuggestions.forEach(function (s) {
                    if (s.suggestion === m.suggestion) s.keywords.push(m.keyword);
                });
            });
            if (uniqueSuggestions.length > 0) {
                jobMatchSuggestionsEl.innerHTML =
                    '<div class="ats-list-title">Suggestions</div>' +
                    '<ul class="jm-suggestions">' +
                    uniqueSuggestions.map(function (s) {
                        return '<li class="jm-suggestion-item">' +
                            '<span class="jm-suggestion-text">' + escHtml(s.suggestion) + '</span>' +
                            '<span class="jm-suggestion-kws">' + s.keywords.map(function (k) {
                                return '<code class="jm-kw-code">' + escHtml(k) + '</code>';
                            }).join('') + '</span>' +
                            '</li>';
                    }).join('') +
                    '</ul>';
            } else {
                jobMatchSuggestionsEl.innerHTML = '';
            }
        }

        if (jobMatchResultsEl) jobMatchResultsEl.hidden = false;
    }

    if (analyzeJobMatchBtnEl) {
        analyzeJobMatchBtnEl.addEventListener('click', fetchJobMatch);
    }

    if (clearJobMatchBtnEl) {
        clearJobMatchBtnEl.addEventListener('click', function () {
            if (jobDescInputEl) jobDescInputEl.value = '';
            if (jobMatchResultsEl) jobMatchResultsEl.hidden = true;
            if (jobMatchMatchedEl) jobMatchMatchedEl.innerHTML = '';
            if (jobMatchMissingEl) jobMatchMissingEl.innerHTML = '';
            if (jobMatchSuggestionsEl) jobMatchSuggestionsEl.innerHTML = '';
            if (jobMatchScoreNumEl) jobMatchScoreNumEl.textContent = '0%';
            if (jobMatchScoreLblEl) jobMatchScoreLblEl.textContent = 'Match';
            if (jobMatchScoreBarEl) {
                jobMatchScoreBarEl.style.width = '0%';
                jobMatchScoreBarEl.className = 'jm-score-bar-fill';
            }
        });
    }

    // ── Template presets ─────────────────────────
    var TEMPLATE_PRESETS = {
        classic: {
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
            header_layout: 'centered',
            contact_separator: 'pipe',
            section_divider_style: 'thin',
            skills_layout: 'inline',
            bullet_style: 'filled',
        },
        modern: {
            font_family: 'Calibri',
            font_size_name: 22,
            font_size_section_header: 12,
            font_size_body: 10.5,
            font_size_detail: 9.5,
            line_height: 1.3,
            paragraph_spacing: 5,
            section_spacing: 12,
            margin_top: 0.6,
            margin_bottom: 0.6,
            margin_left: 0.7,
            margin_right: 0.7,
            bullet_indent: 12,
            header_layout: 'left-aligned',
            contact_separator: 'dot',
            section_divider_style: 'thick',
            skills_layout: 'inline',
            bullet_style: 'filled',
        },
        compact: {
            font_family: 'Arial',
            font_size_name: 17,
            font_size_section_header: 11,
            font_size_body: 9.5,
            font_size_detail: 8.5,
            line_height: 1.05,
            paragraph_spacing: 2,
            section_spacing: 6,
            margin_top: 0.4,
            margin_bottom: 0.4,
            margin_left: 0.5,
            margin_right: 0.5,
            bullet_indent: 10,
            header_layout: 'two-line',
            contact_separator: 'pipe',
            section_divider_style: 'thin',
            skills_layout: 'inline',
            bullet_style: 'filled',
        },
        academic: {
            font_family: 'Times New Roman',
            font_size_name: 20,
            font_size_section_header: 12,
            font_size_body: 11,
            font_size_detail: 10,
            line_height: 1.2,
            paragraph_spacing: 4,
            section_spacing: 10,
            margin_top: 1.0,
            margin_bottom: 1.0,
            margin_left: 1.0,
            margin_right: 1.0,
            bullet_indent: 14,
            header_layout: 'centered',
            contact_separator: 'pipe',
            section_divider_style: 'thin',
            skills_layout: 'inline',
            bullet_style: 'filled',
        },
    };

    var templatesBtn         = document.getElementById('templatesBtn');
    var templatesModal       = document.getElementById('templatesModal');
    var templatesModalClose  = document.getElementById('templatesModalClose');
    var templatesApplyBtn    = document.getElementById('templatesApplyBtn');
    var templatesCancelBtn   = document.getElementById('templatesModalCancelBtn');
    var selectedTemplate     = null;

    function openTemplatesModal() {
        if (!templatesModal) return;
        templatesModal.hidden = false;
        selectedTemplate = null;
        templatesModal.querySelectorAll('.template-card').forEach(function (card) {
            card.classList.remove('selected');
        });
        if (templatesApplyBtn) templatesApplyBtn.disabled = true;
    }

    function closeTemplatesModal() {
        if (templatesModal) templatesModal.hidden = true;
        selectedTemplate = null;
    }

    if (templatesBtn) {
        templatesBtn.addEventListener('click', openTemplatesModal);
    }

    if (templatesModalClose) {
        templatesModalClose.addEventListener('click', closeTemplatesModal);
    }

    if (templatesCancelBtn) {
        templatesCancelBtn.addEventListener('click', closeTemplatesModal);
    }

    if (templatesModal) {
        templatesModal.addEventListener('click', function (e) {
            if (e.target === templatesModal) closeTemplatesModal();
        });

        templatesModal.querySelectorAll('.template-card').forEach(function (card) {
            card.addEventListener('click', function () {
                templatesModal.querySelectorAll('.template-card').forEach(function (c) {
                    c.classList.remove('selected');
                });
                card.classList.add('selected');
                selectedTemplate = card.dataset.template;
                if (templatesApplyBtn) templatesApplyBtn.disabled = false;
            });
        });
    }

    if (templatesApplyBtn) {
        templatesApplyBtn.addEventListener('click', function () {
            if (!selectedTemplate || !TEMPLATE_PRESETS[selectedTemplate]) return;
            pushHistory();
            applyTypoToControls(TEMPLATE_PRESETS[selectedTemplate]);
            notifyChange();
            closeTemplatesModal();
            var name = selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1);
            showToast('Applied ' + name + ' template.', 'success');
        });
    }

    // ── My Resumes modal ─────────────────────────
    var myResumesBtn   = document.getElementById('myResumesBtn');
    var resumesModal   = document.getElementById('resumesModal');
    var resumesModalClose = document.getElementById('resumesModalClose');
    var resumesModalBody  = document.getElementById('resumesModalBody');
    var resumesNewBtn  = document.getElementById('resumesNewBtn');

    function openResumesModal() {
        if (resumesModal) resumesModal.hidden = false;
        loadResumesList();
    }

    function closeResumesModal() {
        if (resumesModal) resumesModal.hidden = true;
    }

    function _formatResumeDate(isoStr) {
        if (!isoStr) return '';
        try {
            var d = new Date(isoStr);
            return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) { return ''; }
    }

    function loadResumesList() {
        if (!resumesModalBody) return;
        resumesModalBody.innerHTML = '<div class="resumes-loading">Loading\u2026</div>';
        fetch('/api/resumes')
            .then(function (r) { return r.json(); })
            .then(function (resumes) {
                if (!resumes.length) {
                    resumesModalBody.innerHTML = '<div class="resumes-empty">No saved resumes yet. Create one below.</div>';
                    return;
                }
                var html = '<div class="resumes-list">';
                resumes.forEach(function (resume) {
                    var name = resume.name || 'Untitled Resume';
                    var date = _formatResumeDate(resume.updated_at);
                    var fill = (resume.page_fill_pct !== null && resume.page_fill_pct !== undefined)
                        ? resume.page_fill_pct + '%' : '\u2014';
                    var fillClass = resume.page_fill_pct > 100
                        ? 'fill-over'
                        : (resume.page_fill_pct >= 80 ? 'fill-good' : 'fill-low');
                    var isActive = resume.id === resumeId;
                    html += '<div class="resume-card' + (isActive ? ' resume-card--active' : '') + '" data-id="' + escHtml(resume.id) + '">';
                    html += '<div class="resume-card-info">';
                    html += '<div class="resume-card-name">' + escHtml(name);
                    if (isActive) html += ' <span class="resume-badge-current">current</span>';
                    html += '</div>';
                    html += '<div class="resume-card-meta">';
                    html += '<span class="resume-meta-date">Modified ' + escHtml(date) + '</span>';
                    html += '<span class="resume-meta-fill ' + fillClass + '">' + escHtml(fill) + ' page fill</span>';
                    html += '</div>';
                    html += '</div>';
                    html += '<div class="resume-card-actions">';
                    html += '<button class="resume-action-btn" data-action="open" data-id="' + escHtml(resume.id) + '">' + (isActive ? 'Editing' : 'Open') + '</button>';
                    html += '<button class="resume-action-btn" data-action="duplicate" data-id="' + escHtml(resume.id) + '">Duplicate</button>';
                    html += '<button class="resume-action-btn resume-action-btn--danger" data-action="delete" data-id="' + escHtml(resume.id) + '">Delete</button>';
                    html += '</div>';
                    html += '</div>';
                });
                html += '</div>';
                resumesModalBody.innerHTML = html;
            })
            .catch(function () {
                if (resumesModalBody) resumesModalBody.innerHTML = '<div class="resumes-error">Failed to load resumes.</div>';
            });
    }

    function _loadResumeIntoEditor(id) {
        fetch('/api/resume/' + id)
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (!res.data || !res.typography) throw new Error('bad response');
                pushHistory();
                resumeId = id;
                state.data = res.data;
                applyTypoToControls(res.typography);
                lastSavedSnapshot = JSON.stringify({ data: state.data, typo: state.typo });
                expOpenStates.length = 0;
                eduOpenStates.length = 0;
                skillOpenStates.length = 0;
                certOpenStates.length = 0;
                projOpenStates.length = 0;
                awardOpenStates.length = 0;
                ['name','email','phone','location','linkedin','website'].forEach(function (f) {
                    var el = document.getElementById(f);
                    if (el) el.value = (state.data.header && state.data.header[f]) ? state.data.header[f] : '';
                });
                if (summaryEl) summaryEl.value = state.data.summary || '';
                updateCharCount();
                renderAllCustomSectionPanels();
                renderSidebarNav();
                renderExperienceList();
                renderEducationList();
                renderSkillList();
                renderCertList();
                renderProjectList();
                renderAwardList();
                notifyChange();
                closeResumesModal();
                var displayName = (res.data.header && res.data.header.name) ? res.data.header.name : 'Untitled';
                showToast('Opened \u201c' + displayName + '\u201d', 'success');
            })
            .catch(function () {
                showToast('Failed to load resume.', 'error');
            });
    }

    function _resetEditorToNew(newId, newData) {
        resumeId = newId;
        state.data = newData || defaultData();
        applyTypoToControls(state.typo);
        expOpenStates.length = 0;
        eduOpenStates.length = 0;
        skillOpenStates.length = 0;
        certOpenStates.length = 0;
        projOpenStates.length = 0;
        awardOpenStates.length = 0;
        ['name','email','phone','location','linkedin','website'].forEach(function (f) {
            var el = document.getElementById(f);
            if (el) el.value = '';
        });
        if (summaryEl) summaryEl.value = '';
        updateCharCount();
        renderAllCustomSectionPanels();
        renderSidebarNav();
        renderExperienceList();
        renderEducationList();
        renderSkillList();
        renderCertList();
        renderProjectList();
        renderAwardList();
        notifyChange();
        lastSavedSnapshot = JSON.stringify({ data: state.data, typo: state.typo });
    }

    if (resumesModalBody) {
        resumesModalBody.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var action = btn.dataset.action;
            var id = btn.dataset.id;

            if (action === 'open') {
                if (id === resumeId) { closeResumesModal(); return; }
                _loadResumeIntoEditor(id);
            } else if (action === 'duplicate') {
                fetch('/api/resume/' + id + '/duplicate', { method: 'POST' })
                    .then(function (r) { return r.json(); })
                    .then(function () {
                        showToast('Resume duplicated.', 'success');
                        loadResumesList();
                    })
                    .catch(function () { showToast('Failed to duplicate resume.', 'error'); });
            } else if (action === 'delete') {
                var card = btn.closest('.resume-card');
                var cardName = card ? card.querySelector('.resume-card-name').textContent.replace('current', '').trim() : 'this resume';
                confirmDialog({
                    title: 'Delete Resume',
                    message: 'Delete \u201c' + cardName + '\u201d? This cannot be undone.',
                    confirmText: 'Delete',
                    isDanger: true
                }, function () {
                    fetch('/api/resume/' + id, { method: 'DELETE' })
                        .then(function (r) {
                            if (!r.ok) throw new Error('delete failed');
                            if (id === resumeId) {
                                return fetch('/api/resume/new', { method: 'POST' })
                                    .then(function (r2) { return r2.json(); })
                                    .then(function (res) { _resetEditorToNew(res.id); });
                            }
                        })
                        .then(function () {
                            showToast('Resume deleted.', 'success');
                            loadResumesList();
                        })
                        .catch(function () { showToast('Failed to delete resume.', 'error'); });
                });
            }
        });
    }

    if (myResumesBtn) myResumesBtn.addEventListener('click', openResumesModal);
    if (resumesModalClose) resumesModalClose.addEventListener('click', closeResumesModal);
    if (resumesModal) {
        resumesModal.addEventListener('click', function (e) {
            if (e.target === resumesModal) closeResumesModal();
        });
    }

    if (resumesNewBtn) {
        resumesNewBtn.addEventListener('click', function () {
            doSave();
            fetch('/api/resume/new', { method: 'POST' })
                .then(function (r) { return r.json(); })
                .then(function (res) {
                    _resetEditorToNew(res.id);
                    closeResumesModal();
                    showToast('New resume created.', 'success');
                })
                .catch(function () { showToast('Failed to create resume.', 'error'); });
        });
    }

    // ── Unified keyboard shortcuts ───────────────
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (resumesModal && !resumesModal.hidden) { closeResumesModal(); return; }
            if (importModal && !importModal.hidden) closeImportModal();
            if (exportMenu && !exportMenu.hidden) closeExportMenu();
            if (shortcutsPopover && !shortcutsPopover.hidden) closeShortcutsPopover();
            if (templatesModal && !templatesModal.hidden) closeTemplatesModal();
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
            window.print();
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

    initSectionCollapsibility();
    initResumeId();

    var appEl = document.getElementById('app');
    if (appEl) appEl.classList.remove('app-loading');
})();
