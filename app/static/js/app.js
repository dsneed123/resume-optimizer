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
            if (d.summary && d.show_summary !== false) {
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
            show_summary: true,
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
                '<div class="date-row">' +
                    '<div class="field-group">' +
                        '<label class="field-label">Start Date</label>' +
                        '<input class="field-input exp-field" data-field="start_date" type="text" value="' + escHtml(entry.start_date) + '" placeholder="Jan 2020">' +
                    '</div>' +
                    '<div class="field-group">' +
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
            if (this.checked) {
                state.data.experience[index].end_date = 'Present';
                endInput.value = 'Present';
                endInput.disabled = true;
            } else {
                state.data.experience[index].end_date = '';
                endInput.value = '';
                endInput.disabled = false;
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
                bullets.splice(bi, 1);
                bulletList.innerHTML = bullets.map(buildBulletHTML).join('');
                notifyChange();
            } else if (upBtn) {
                bi = parseInt(upBtn.dataset.bi);
                if (bi > 0) {
                    tmp = bullets[bi - 1];
                    bullets[bi - 1] = bullets[bi];
                    bullets[bi] = tmp;
                    bulletList.innerHTML = bullets.map(buildBulletHTML).join('');
                    notifyChange();
                }
            } else if (downBtn) {
                bi = parseInt(downBtn.dataset.bi);
                if (bi < bullets.length - 1) {
                    tmp = bullets[bi];
                    bullets[bi] = bullets[bi + 1];
                    bullets[bi + 1] = tmp;
                    bulletList.innerHTML = bullets.map(buildBulletHTML).join('');
                    notifyChange();
                }
            }
        });

        item.querySelector('.add-bullet-btn').addEventListener('click', function () {
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
            state.data.education.push(newEducationEntry());
            eduOpenStates.push(true);
            renderEducationList();
            notifyChange();
        });
    }

    renderEducationList();
})();
