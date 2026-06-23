gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

// Prevent browser from auto-scrolling to the saved position before our scroll-scrubbed
// Lottie is ready — we restore it manually once everything is initialised.
history.scrollRestoration = 'manual';
window.addEventListener('beforeunload', () => {
    sessionStorage.setItem('scrollY', window.scrollY);
});

// ── Page veil ─────────────────────────────────────────────────────────────────
// Counts down from 2 (Lottie DOMLoaded + content.md fetch). Lifts when both are
// done so the user never sees scroll jumps or half-rendered overlays.
let _veilCount = 2;
function _veilDone() {
    if (--_veilCount > 0) return;
    const veil = document.getElementById('page-veil');
    if (!veil) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        veil.remove();
    } else {
        veil.style.opacity = '0';
        veil.addEventListener('transitionend', () => veil.remove(), { once: true });
    }
}

// ── Cursor ────────────────────────────────────────────────────────────────────
const cur  = document.getElementById('cur');
const ring = document.getElementById('cur-ring');
let mx = 0, my = 0, rx = 0, ry = 0;

gsap.set(cur,  { xPercent: -50, yPercent: -50 });
gsap.set(ring, { xPercent: -50, yPercent: -50 });

document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    gsap.set(cur, { x: mx, y: my });
    tooltip.style.left = mx + 'px';
    tooltip.style.top  = my + 'px';
}, { passive: true });

(function ringLoop() {
    rx += (mx - rx) * .14;
    ry += (my - ry) * .14;
    gsap.set(ring, { x: rx, y: ry });
    requestAnimationFrame(ringLoop);
})();

document.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('hov'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('hov'));
});

// ── Tooltip ───────────────────────────────────────────────────────────────────
const tooltip = document.getElementById('tooltip');
function showTip(text) { tooltip.textContent = text; tooltip.classList.add('show'); }
function hideTip()     { tooltip.classList.remove('show'); }

// ── Layer refs ────────────────────────────────────────────────────────────────
const lottieEl = document.getElementById('lottie-hero');
const svgCont  = document.getElementById('svg-container');
const wHint    = document.querySelector('.workspace-hint');
const heroFoot = document.querySelector('.hero-foot');

// ── Lottie scroll scrub ───────────────────────────────────────────────────────
// Designersintro.json: 281 frames, 29 fps, ~9.7 s
const TOTAL_FRAMES = 281;

const anim = lottie.loadAnimation({
    container: lottieEl,
    renderer: 'svg',
    loop: false,
    autoplay: false,
    path: 'Designersintro.json',
    rendererSettings: { preserveAspectRatio: 'xMidYMid slice' }
});

anim.addEventListener('DOMLoaded', () => {
    anim.goToAndStop(0, true);

    ScrollTrigger.create({
        trigger: '#hero',
        start: 'top top',
        end: '+=280%',
        pin: true,
        scrub: 1.2,
        onUpdate: self => {
            anim.goToAndStop(Math.round(self.progress * TOTAL_FRAMES), true);

            // Scroll cue fades out immediately as user begins scrolling
            heroFoot.style.opacity = Math.max(0, 1 - self.progress * 10);

            if (self.progress > 0.75) {
                const t = (self.progress - 0.75) / 0.25; // 0 → 1

                // Lottie fades out — disable its pointer events so SVG becomes clickable
                lottieEl.style.opacity       = 1 - t;
                lottieEl.style.pointerEvents = t > 0.5 ? 'none' : 'auto';

                // SVG workspace fades in — enable pointer events once visible
                svgCont.style.opacity       = t;
                svgCont.style.pointerEvents = t > 0.5 ? 'all' : 'none';

                wHint.style.opacity = Math.max(0, (t - 0.5) / 0.5) * 0.45;

            } else {
                lottieEl.style.opacity       = 1;
                lottieEl.style.pointerEvents = 'auto';
                svgCont.style.opacity        = 0;
                svgCont.style.pointerEvents  = 'none';
                wHint.style.opacity          = 0;
            }
        },
    });

    // Scroll progress bar
    ScrollTrigger.create({
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: self => {
            document.getElementById('scroll-bar').style.width =
                (self.progress * 100) + '%';
        }
    });

    // Restore scroll position after ScrollTrigger is ready so the Lottie scrub
    // and pinned hero reflect the correct frame instead of jumping back to 0.
    const savedY = +sessionStorage.getItem('scrollY') || 0;
    if (savedY > 0) {
        window.scrollTo(0, savedY);
        ScrollTrigger.refresh();
        // Kill any queued hero-foot tween so it can't override onUpdate's opacity.
        gsap.killTweensOf(heroFoot);
        gsap.set(heroFoot, { clearProps: 'opacity,y' });
    }

    // Restore open overlay — run after scroll settles so the scene is ready.
    const savedOverlay = sessionStorage.getItem('overlayId');
    if (savedOverlay) requestAnimationFrame(() => openOverlay(savedOverlay));

    _veilDone();
});

// ── Scroll cue entrance ───────────────────────────────────────────────────────
// Only animate in when starting from scroll 0 — if scroll is being restored the
// onUpdate handler controls hero-foot opacity and this would fight it.
if (!+sessionStorage.getItem('scrollY')) {
    gsap.from('.hero-foot', { y: 14, opacity: 0, duration: 1, delay: .6, ease: 'power3.out' });
}

// ── SVG interactive elements ──────────────────────────────────────────────────
const SVG_MAP = {
    'Computer':        { overlay: 'ov-computer',        label: 'Portfolio ↗'            },
    'Headphones':      { overlay: 'ov-headphones',      label: "Music"    },
    'Walnut':          { overlay: 'ov-walnut',          label: 'Meet Walnut'             },
    'Calendar':        { overlay: 'ov-calendar',        label: 'Book a call'             },
    'Designer':        { overlay: 'ov-designer',        label: 'About me'                },
    'Microcontroller': { overlay: 'ov-microcontroller', label: 'Hobbies'       },
    'Risograph':       { overlay: 'ov-risograph',       label: 'Traditional Mediums'     },
    'Archivefolder':   { overlay: 'ov-archivefolder',   label: 'Project Archive'         },
    'Diploma':         { overlay: 'ov-diploma',         label: 'Education'               },
    'Map':             { overlay: 'ov-map',             label: 'Hidalgo, Mexico'         },
    'Camera':          { overlay: 'ov-camera',          label: 'Photography'             },
};

// Warn early if opened via file://
if (location.protocol === 'file:') {
    svgCont.innerHTML = `
        <div style="text-align:center;padding:60px 40px;font-family:var(--font-b);">
            <p style="font-family:var(--font-d);font-size:28px;font-style:italic;margin-bottom:14px;">Almost there!</p>
            <p style="font-size:14px;color:rgba(28,24,20,.55);line-height:1.9;max-width:400px;margin:0 auto 20px;">
                Open via a local server — file:// blocks asset loading.
            </p>
            <p style="font-size:13px;color:rgba(28,24,20,.4);margin-bottom:8px;">
                VS Code → right-click index.html → <strong>Open with Live Server</strong>
            </p>
            <code style="font-size:12px;color:rgba(28,24,20,.35);">python3 -m http.server 3000</code>
        </div>`;
}

fetch('Designers_Workspace.svg')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(svgText => {
        svgCont.innerHTML = svgText;
        const svg = svgCont.querySelector('svg');

        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.style.width  = '100%';
        svg.style.height = '100%';

        // Inject defs: hover filter + SVG-scoped CSS
        let defs = svg.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            svg.insertBefore(defs, svg.firstChild);
        }

        // White-tint filter for hover
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', 'hov-white');
        filter.innerHTML = `
            <feColorMatrix type="matrix"
                values="1 0 0 0 0.18
                        0 1 0 0 0.18
                        0 0 1 0 0.18
                        0 0 0 1 0"/>`;
        defs.appendChild(filter);

        // CSS scoped inside the SVG
        const svgStyle = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        svgStyle.textContent = `
            .ws-click { cursor: pointer; transition: filter .25s ease; }
            .ws-click:hover { filter: url(#hov-white); }

            /* Built-in illustrator hover groups */
            #Walnut #Hover,
            #Calendar #Hover-3    { opacity: 0; transition: opacity .25s; }
            #Walnut:hover #Hover,
            #Calendar:hover #Hover-3 { opacity: 1; }

            #Hover-2 { opacity: 0; transition: opacity .28s; }
            #Designer:hover #Hover-2 { opacity: .32; }
        `;
        defs.appendChild(svgStyle);

        // Wire up click + hover for each interactive element
        Object.entries(SVG_MAP).forEach(([id, { overlay, label }]) => {
            const el = document.getElementById(id);
            if (!el) return;

            el.classList.add('ws-click');
            el.addEventListener('click',      ()  => openOverlay(overlay));
            el.addEventListener('mouseenter', ()  => { document.body.classList.add('hov'); showTip(label); });
            el.addEventListener('mouseleave', ()  => { document.body.classList.remove('hov'); hideTip(); });
        });
    })
    .catch(err => {
        console.error('SVG load error:', err);
        svgCont.innerHTML = `
            <p style="text-align:center;padding:80px;opacity:.35;font-family:var(--font-d);font-size:22px;font-style:italic;">
                Workspace needs a local server.<br>
                <small style="font-family:var(--font-b);font-size:14px;">python3 -m http.server 3000</small>
            </p>`;
    });

// ── Overlay system ────────────────────────────────────────────────────────────
let activeId = null;
const backdrop = document.getElementById('backdrop');

function _blockScroll(e) {
    const scrollable = e.target.closest('.b-main, .panel, .b-sidebar');
    if (!scrollable) e.preventDefault();
}

function openOverlay(id) {
    if (activeId) _dismiss(true);

    const el = document.getElementById(id);
    if (!el) return;
    activeId = id;
    sessionStorage.setItem('overlayId', id);

    // Kill any lingering tweens so stale callbacks can't touch pointer-events
    gsap.killTweensOf(el);
    gsap.killTweensOf(backdrop);

    backdrop.style.pointerEvents = 'all';
    el.style.pointerEvents       = 'all';
    document.body.style.overflow = 'hidden';
    document.addEventListener('wheel', _blockScroll, { passive: false });
    document.addEventListener('touchmove', _blockScroll, { passive: false });

    gsap.to(backdrop, { opacity: 1, duration: .3, ease: 'power2.out' });
    gsap.fromTo(el,
        { opacity: 0, scale: .93, y: 24, xPercent: -50, yPercent: -50 },
        { opacity: 1, scale: 1,   y: 0,  xPercent: -50, yPercent: -50, duration: .42, ease: 'back.out(1.6)',
          onComplete: () => { if (id === 'ov-archivefolder') _initArchive(); } }
    );
}

function _dismiss(instant = false) {
    if (!activeId) return;
    const el = document.getElementById(activeId);
    const id = activeId;
    const dur = instant ? 0 : .28;

    // Stop Spotify playback when headphones modal closes
    if (id === 'ov-headphones') {
        const iframe = el.querySelector('iframe');
        if (iframe) { iframe.src = iframe.src; }
    }

    // Archive cards have pointer-events:all in CSS — clear them immediately so
    // they don't sit invisibly over the SVG workspace and swallow clicks.
    if (id === 'ov-archivefolder') {
        const cards = document.getElementById('archive-cards');
        if (cards) cards.innerHTML = '';
    }

    // Reset pointer-events synchronously — never rely on onComplete for this,
    // as interrupted animations leave the backdrop blocking all subsequent clicks.
    el.style.pointerEvents      = 'none';
    backdrop.style.pointerEvents = 'none';
    document.body.style.overflow = '';
    document.removeEventListener('wheel', _blockScroll);
    document.removeEventListener('touchmove', _blockScroll);
    activeId = null;
    sessionStorage.removeItem('overlayId');

    gsap.to(el, { opacity: 0, scale: .95, y: 14, xPercent: -50, yPercent: -50, duration: dur, ease: 'power2.in' });
    gsap.to(backdrop, { opacity: 0, duration: dur });
}

// Exposed globally so inline onclick="closeOverlay()" works
window.closeOverlay = () => _dismiss();

// ── Browser modal interactions ────────────────────────────────────────────────
window.toggleBrowserSidebar = () => {
    const sidebar = document.getElementById('b-sidebar');
    const openBtn = document.getElementById('b-sidebar-open');
    sidebar.classList.toggle('closed');
    openBtn.style.display = sidebar.classList.contains('closed') ? 'flex' : 'none';
};

window.switchBrowserTab = btn => {
    document.querySelectorAll('.b-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    _currentBrowserTab = btn.textContent.trim();
    _currentBrowserProject = Object.keys(_ALL_PROJECTS[_currentBrowserTab])[0] || '';
    _renderSidebarProjects();

    // Disable sidebar transition so content renders at full width instantly — no layout jump
    const sidebar = document.getElementById('b-sidebar');
    if (sidebar) sidebar.style.transition = 'none';
    backToWork();
    requestAnimationFrame(() => { if (sidebar) sidebar.style.transition = ''; });

    _saveBrowserState();
};

window.selectBrowserProject = btn => {
    openBrowserProject(btn.textContent.trim());
};

window.selectBrowserSection = btn => {
    document.querySelectorAll('.b-sec').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const secName = btn.textContent.trim();
    const id = 'bc-sec-' + secName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '');
    const target = document.getElementById(id);
    if (target) {
        const bMain = document.querySelector('.b-main');
        bMain.scrollTo({ top: target.offsetTop - 24, behavior: 'smooth' });
    }
};

window.openBrowserProject = name => {
    _currentBrowserProject = name;
    _currentBrowserView    = 'project';
    document.querySelectorAll('.b-proj').forEach(b => b.classList.toggle('active', b.textContent.trim() === name));
    document.querySelector('.b-main')?.scrollTo({ top: 0, behavior: 'instant' });
    const sidebar = document.getElementById('b-sidebar');
    const openBtn = document.getElementById('b-sidebar-open');
    if (sidebar) sidebar.classList.remove('closed');
    if (openBtn) openBtn.style.display = 'none';
    _renderBrowserContent();
    _renderSidebarSections();
    _saveBrowserState();
};

window.backToWork = () => {
    _currentBrowserView = 'grid';
    document.querySelectorAll('.b-proj, .b-sec').forEach(b => b.classList.remove('active'));
    document.querySelector('.b-main')?.scrollTo({ top: 0 });
    const sidebar = document.getElementById('b-sidebar');
    const openBtn = document.getElementById('b-sidebar-open');
    if (sidebar) sidebar.classList.add('closed');
    if (openBtn) openBtn.style.display = 'none';
    _renderBrowserWorkGrid();
    _saveBrowserState();
};

// ── Browser case study content ────────────────────────────────────────────────
let _currentBrowserTab     = 'UX & UI';
let _currentBrowserProject = 'Clearlight';
let _currentBrowserView    = 'grid'; // 'grid' | 'project'

let _bSaveTimer;
function _saveBrowserState() {
    clearTimeout(_bSaveTimer);
    _bSaveTimer = setTimeout(() => {
        sessionStorage.setItem('browserState', JSON.stringify({
            tab:       _currentBrowserTab,
            project:   _currentBrowserView === 'project' ? _currentBrowserProject : null,
            scrollTop: document.querySelector('.b-main')?.scrollTop || 0,
        }));
    }, 150);
}

// ── Scroll spy — updates sidebar section highlight as you scroll ──────────────
(function _initScrollSpy() {
    const bMain = document.querySelector('.b-main');
    if (!bMain) return;
    bMain.addEventListener('scroll', () => {
        const scrollTop = bMain.scrollTop + 80;
        let active = null;
        document.querySelectorAll('.bc-section[data-section]').forEach(el => {
            if (el.offsetTop <= scrollTop) active = el;
        });
        if (active) {
            const name = active.dataset.section;
            document.querySelectorAll('#b-sec-group .b-sec').forEach(b =>
                b.classList.toggle('active', b.textContent.trim() === name)
            );
        }
        _saveBrowserState();
    }, { passive: true });
})();

// ── Content.md parser ─────────────────────────────────────────────────────────
let _ALL_PROJECTS = {};

function _secSlug(name) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '');
}

function _parseContentMd(md) {
    _ALL_PROJECTS = {};
    const tabBlocks = md.split(/^# /m).filter(s => s.trim());
    tabBlocks.forEach(tabBlock => {
        const tabName = tabBlock.split('\n')[0].trim();
        _ALL_PROJECTS[tabName] = {};
        const projBlocks = tabBlock.split(/^## /m).filter(s => s.trim()).slice(1);
        projBlocks.forEach(projBlock => {
            const lines = projBlock.split('\n');
            const projName = lines[0].trim();
            const meta = {};
            let i = 1;
            while (i < lines.length && !lines[i].startsWith('### ')) {
                const m = lines[i].match(/^([a-z]+):\s*(.+)/);
                if (m) meta[m[1]] = m[2].trim();
                i++;
            }
            const remaining = lines.slice(i).join('\n');
            const sections = {};
            remaining.split(/^### /m).filter(s => s.trim()).forEach(secBlock => {
                const secLines = secBlock.split('\n');
                const secName = secLines[0].trim();
                sections[secName] = secLines.slice(1).join('\n').trim();
            });
            const metaFields = [
                { label: 'Year', value: meta.year || '—', sublabel: 'Duration', subvalue: meta.duration || '—' },
                { label: 'Role',  value: meta.role  || '—' },
                { label: 'Tools', value: meta.tools || '—' },
            ];
            if (meta.methods) metaFields.push({ label: 'Methods', value: meta.methods });
            _ALL_PROJECTS[tabName][projName] = {
                accent:   meta.accent   || '#5b5bd6',
                tag:      meta.tag      || '',
                subtitle: meta.subtitle || '',
                image:    meta.image    || null,
                meta:     metaFields,
                sections,
            };
        });
    });
}

function _renderSidebarProjects() {
    const group = document.getElementById('b-proj-group');
    if (!group) return;
    const names = Object.keys(_ALL_PROJECTS[_currentBrowserTab] || {});
    group.innerHTML = `<p class="b-group-label">Projects</p>` +
        names.map(n => `<button class="b-proj" onclick="selectBrowserProject(this)">${n}</button>`).join('');
}

function _renderSidebarSections() {
    const group = document.getElementById('b-sec-group');
    if (!group) return;
    const proj = (_ALL_PROJECTS[_currentBrowserTab] || {})[_currentBrowserProject];
    if (!proj) { group.innerHTML = ''; return; }
    const names = Object.keys(proj.sections);
    group.innerHTML = `<p class="b-group-label">Sections</p>` +
        names.map((n, i) => `<button class="b-sec${i === 0 ? ' active' : ''}" onclick="selectBrowserSection(this)">${n}</button>`).join('');
}

const _imgIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

function _processImages(html) {
    return html.replace(/<img([^>]*)>/g, (_, attrs) => {
        const src = (attrs.match(/src="([^"]*)"/) || [])[1] || '';
        const alt = (attrs.match(/alt="([^"]*)"/) || [])[1] || '';
        if (!src || src === 'placeholder') {
            return `<div class="bc-img-ph">${_imgIcon}<span class="bc-img-ph-label">${alt || 'Image'}</span></div>`;
        }
        return `<img src="${src}" alt="${alt}" class="bc-img-real">`;
    });
}

function _renderBrowserContent() {
    const el = document.getElementById('b-content');
    if (!el) return;
    const proj = (_ALL_PROJECTS[_currentBrowserTab] || {})[_currentBrowserProject];
    if (!proj) return;
    el.style.setProperty('--bc-color', proj.accent);

    const md = (typeof marked !== 'undefined') ? s => _processImages(marked.parse(s)) : s => `<p>${s}</p>`;
    const sectionNames = Object.keys(proj.sections);
    const sectionsHTML = sectionNames.map((name, i) => `
        <section id="bc-sec-${_secSlug(name)}" data-section="${name}" class="bc-section">
            ${i > 0 ? `<h2 class="bc-section-heading">${name}</h2>` : ''}
            <div class="bc-rendered">${md(proj.sections[name])}</div>
        </section>
        ${i < sectionNames.length - 1 ? '<div class="bc-divider"></div>' : ''}
    `).join('');

    const heroStyle = proj.image
        ? `background: linear-gradient(135deg, ${proj.accent}33 0%, transparent 100%); background-image:url('${proj.image}'); background-size:cover; background-position:center;`
        : `background: linear-gradient(135deg, ${proj.accent}44 0%, ${proj.accent}11 100%);`;

    el.innerHTML = `
        <p class="bc-tag">${proj.tag}</p>
        <h2 class="bc-title">${_currentBrowserProject}</h2>
        <p class="bc-subtitle">${proj.subtitle}</p>
        <div class="bc-img-hero" style="${heroStyle}">
            ${proj.image ? '' : `<div class="bc-img-hero-inner">${_imgIcon}<span>Hero image</span></div>`}
        </div>
        <div class="bc-meta-grid">${proj.meta.map(m => `
            <div class="bc-meta-item">
                <p class="bc-meta-label">${m.label}</p>
                <p class="bc-meta-value">${m.value}</p>
                ${m.sublabel ? `<p class="bc-meta-label" style="margin-top:10px">${m.sublabel}</p><p class="bc-meta-value">${m.subvalue}</p>` : ''}
            </div>`
        ).join('')}</div>
        <div class="bc-divider"></div>
        ${sectionsHTML}
    `;
}

function _cardImg(proj) {
    if (proj.image) return `background-image:url('${proj.image}'); background-size:cover; background-position:center;`;
    const hex = proj.accent;
    return `background: linear-gradient(135deg, ${hex}55 0%, ${hex}18 100%);`;
}

function _renderBrowserWorkGrid() {
    const el = document.getElementById('b-content');
    if (!el) return;
    el.style.removeProperty('--bc-color');
    const tabProjects = _ALL_PROJECTS[_currentBrowserTab] || {};
    const entries = Object.entries(tabProjects);

    if (entries.length === 0) {
        el.innerHTML = `
            <div class="bc-coming-soon">
                <p class="bc-coming-soon-eyebrow">${_currentBrowserTab}</p>
                <h2 class="bc-coming-soon-title">Coming<br>Soon</h2>
                <p class="bc-coming-soon-body">New work landing here soon.</p>
            </div>
        `;
        return;
    }

    el.innerHTML = `
        <p class="bc-tag" style="color:rgba(255,255,255,.3)">${_currentBrowserTab}</p>
        <h2 class="bc-title">Work</h2>
        <div class="bc-work-grid">
            ${entries.map(([name, proj]) => `
                <div class="bc-proj-card" style="--bc-color:${proj.accent}" onclick="openBrowserProject('${name}')">
                    <div class="bc-proj-card-img" style="${_cardImg(proj)}"></div>
                    <div class="bc-proj-card-body">
                        <p class="bc-proj-card-type">${proj.tag.split('·')[0].trim()}</p>
                        <h3 class="bc-proj-card-title">${name}</h3>
                        <div class="bc-proj-card-foot">
                            <span class="bc-proj-card-year">${proj.meta[0].value}</span>
                            <span class="bc-proj-card-arrow">&#8594;</span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Fetch content.md, parse it, then initialise the browser modal
fetch('content.md')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(md => {
        _parseContentMd(md);

        const restoringComputer = sessionStorage.getItem('overlayId') === 'ov-computer';
        const savedBS = restoringComputer && sessionStorage.getItem('browserState');
        let restored = false;

        if (savedBS) {
            try {
                const { tab, project, scrollTop } = JSON.parse(savedBS);
                // Restore tab
                if (tab && _ALL_PROJECTS[tab]) {
                    _currentBrowserTab = tab;
                    document.querySelectorAll('.b-tab').forEach(t =>
                        t.classList.toggle('active', t.textContent.trim() === tab)
                    );
                }
                _currentBrowserProject = Object.keys(_ALL_PROJECTS[_currentBrowserTab] || {})[0] || '';
                _renderSidebarProjects();

                // Restore view
                if (project && (_ALL_PROJECTS[_currentBrowserTab] || {})[project]) {
                    openBrowserProject(project);
                    if (scrollTop) requestAnimationFrame(() => {
                        const bm = document.querySelector('.b-main');
                        if (bm) bm.scrollTop = scrollTop;
                    });
                } else {
                    backToWork();
                }
                restored = true;
            } catch (_) { /* fall through to default */ }
        }

        if (!restored) {
            _currentBrowserProject = Object.keys(_ALL_PROJECTS[_currentBrowserTab] || {})[0] || '';
            _renderSidebarProjects();
            backToWork();
        }
        _veilDone();
    })
    .catch(() => {
        const el = document.getElementById('b-content');
        if (el) el.innerHTML = '<p class="bc-body" style="opacity:.4; padding:40px;">Open via a local server to load content.md</p>';
        _veilDone();
    });

backdrop.addEventListener('click', () => _dismiss());
document.addEventListener('keydown', e => { if (e.key === 'Escape') _dismiss(); });

// Archive lightbox — click the dark backdrop area (anywhere outside the card) to close
document.getElementById('archive-lb').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});

// ── Archive ────────────────────────────────────────────────────────────────────
const ARCHIVE_ITEMS = [
    { title: 'The Universe in Their Eyes', genre: 'Typography',      year: '2022', accent: '#c8c8c8', ratio: '17/22', image: 'images/archive/archive-1.png' },
    { title: 'Hummingbird',               genre: 'Photography',      year: '2022', accent: '#4a8a4a', ratio: '3/2',   image: 'images/archive/archive-2.jpg' },
    { title: 'Yosemite',                  genre: 'Photography',      year: '2021', accent: '#4a6a9a', ratio: '3/2',   image: 'images/archive/archive-3.jpg' },
    { title: 'Are You Still Lovin It?',   genre: 'Screen Printing',  year: '2022', accent: '#cc2222', ratio: '5/7',   image: 'images/archive/archive-4.jpg' },
    { title: 'Black Flower',              genre: 'Photography',      year: '2023', accent: '#888888', ratio: '4/5',   image: 'images/archive/archive-5.jpg' },
    { title: 'Beijos',                    genre: 'Illustration',     year: '2022', accent: '#7d1a1a', ratio: '17/22', image: 'images/archive/archive-6.png' },
    { title: 'Impossível',                genre: 'Typography',       year: '2021', accent: '#d0d0d0', ratio: '22/17', image: 'images/archive/archive-7.jpg' },
    { title: 'Music',                     genre: 'Illustration',     year: '2021', accent: '#cc44cc', ratio: '13/14', image: 'images/archive/archive-8.jpg' },
];

function _hexLighten(hex, amount = 0.38) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgb(${Math.round(r+(255-r)*amount)},${Math.round(g+(255-g)*amount)},${Math.round(b+(255-b)*amount)})`;
}

function _archiveCardBg(item) {
    if (item.image) return `background-image:url('${item.image}')`;
    const light = _hexLighten(item.accent, 0.42);
    return `background:linear-gradient(145deg,${light} 0%,${item.accent} 100%)`;
}

function _startFloat(card) {
    gsap.to(card, {
        y: '+=15', rotation: '+=2.5',
        duration: 2 + Math.random() * 1.4,
        ease: 'sine.inOut', repeat: -1, yoyo: true,
    });
}

function _openArchiveLightbox(item) {
    const lb   = document.getElementById('archive-lb');
    const card = document.getElementById('archive-lb-card');
    if (!lb || !card) return;

    // Resize card to match item ratio — portrait gets narrower so it doesn't overflow vertically
    const [rw, rh] = (item.ratio || '4/3').split('/').map(Number);
    const isPortrait = rh > rw;
    card.style.width       = isPortrait ? 'min(420px, 70vw)' : 'min(820px, 86vw)';
    card.style.aspectRatio = item.ratio || '4/3';
    card.style.height      = '';

    card.style.setProperty('--lb-accent', item.accent);
    card.innerHTML = `
        <div class="archive-lb-img" style="${_archiveCardBg(item)}"></div>
        <div class="archive-lb-info">
            <p class="archive-lb-genre">${item.genre}</p>
            <h2 class="archive-lb-title">${item.title}</h2>
            <p class="archive-lb-year">${item.year}</p>
        </div>`;
    gsap.fromTo(card, { scale: .9, opacity: 0 }, { scale: 1, opacity: 1, duration: .32, ease: 'back.out(1.5)' });
    lb.classList.add('open');
}

function _initArchive() {
    const container = document.getElementById('archive-cards');
    if (!container) return;
    container.innerHTML = '';
    document.getElementById('archive-lb')?.classList.remove('open');

    const W     = window.innerWidth;
    const H     = window.innerHeight;
    const cardW = Math.min(280, Math.max(200, W * 0.18));

    // Elliptical resting positions centred in upper viewport, clear of folder at bottom
    const cx = W * 0.5;
    const cy = H * 0.39;
    const rx = W * 0.38;
    const ry = H * 0.26;

    // Folder top edge sits at ~77% viewport height (SVG y=2819/3672).
    // Cards start inside the folder body, below that line, hidden from view.
    const folderTopY = H * 0.77;
    const originX    = W * 0.5 - cardW / 2;
    const originY    = folderTopY + 60; // inside folder, just below opening

    ARCHIVE_ITEMS.forEach((item, i) => {
        const n     = ARCHIVE_ITEMS.length;
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const jx    = (Math.random() - 0.5) * 60;
        const jy    = (Math.random() - 0.5) * 40;
        const tx    = cx + Math.cos(angle) * rx + jx - cardW / 2;
        const ty    = cy + Math.sin(angle) * ry + jy - cardW / 2;
        const rot   = (Math.random() - 0.5) * 22;

        const card = document.createElement('div');
        card.className = 'archive-card';
        card.style.setProperty('--card-accent', item.accent);
        card.innerHTML = `
            <div class="archive-card-img" style="${_archiveCardBg(item)};aspect-ratio:${item.ratio||'3/4'}"></div>
            <div class="archive-card-foot">
                <p class="archive-card-genre">${item.genre}</p>
                <h3 class="archive-card-title">${item.title}</h3>
                <p class="archive-card-year">${item.year}</p>
            </div>
        `;
        container.appendChild(card);

        // Start hidden inside folder (below viewport)
        gsap.set(card, { x: originX, y: originY, rotation: 0, opacity: 0, scale: 0.6, width: cardW });

        const delay = 0.08 + i * 0.09;

        // Burst up through folder opening, then arc to resting spot
        gsap.to(card, {
            y: H * 0.62, opacity: 1,
            duration: 0.3,
            delay,
            ease: 'power3.out',
        });
        gsap.to(card, {
            x: tx, y: ty, rotation: rot, scale: 1,
            duration: 0.65 + Math.random() * 0.2,
            delay: delay + 0.28,
            ease: 'back.out(1.2)',
            onComplete: () => _startFloat(card),
        });

        // Drag
        let moved, startPX, startPY, startGX, startGY;

        card.addEventListener('pointerdown', e => {
            if (e.button !== 0) return;
            e.preventDefault();
            card.setPointerCapture(e.pointerId);
            moved = false;
            startPX = e.clientX; startPY = e.clientY;
            startGX = gsap.getProperty(card, 'x');
            startGY = gsap.getProperty(card, 'y');
            gsap.killTweensOf(card);
            gsap.to(card, { scale: 1.08, duration: .16, ease: 'power2.out' });
            card.style.zIndex = 20; // above folder SVG (z-index 5)
        });

        card.addEventListener('pointermove', e => {
            if (!card.hasPointerCapture(e.pointerId)) return;
            const dx = e.clientX - startPX;
            const dy = e.clientY - startPY;
            if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
            gsap.set(card, { x: startGX + dx, y: startGY + dy });
        });

        card.addEventListener('pointerup', () => {
            card.style.zIndex = '';
            gsap.to(card, { scale: 1, duration: .16, ease: 'power2.out' });
            _startFloat(card);
            if (!moved) _openArchiveLightbox(item);
        });
    });
}
