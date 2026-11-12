gsap.registerPlugin(ScrollTrigger);

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

// ── Tooltip ───────────────────────────────────────────────────────────────────
const tooltip = document.getElementById('tooltip');
function showTip(text) { tooltip.textContent = text; tooltip.classList.add('show'); }
function hideTip()     { tooltip.classList.remove('show'); }

document.addEventListener('mousemove', e => {
    tooltip.style.left = e.clientX + 'px';
    tooltip.style.top  = e.clientY + 'px';
}, { passive: true });

// ── Layer refs ────────────────────────────────────────────────────────────────
const lottieEl  = document.getElementById('lottie-hero');
const svgCont   = document.getElementById('svg-container');
const wHint     = document.querySelector('.workspace-hint');
const heroFoot  = document.querySelector('.hero-foot');
const scrollBar = document.getElementById('scroll-bar');

// On portrait mobile the 16:9 scene uses meet (letterbox) so it fits the width
const isMobile = window.matchMedia('(max-width: 767px)').matches;
const sceneAR  = isMobile ? 'xMidYMid meet' : 'xMidYMid slice';

// ── Lottie scroll scrub ───────────────────────────────────────────────────────
// Designersintro-4.json: 482 frames, 29 fps
const TOTAL_FRAMES = 482;

const anim = lottie.loadAnimation({
    container: lottieEl,
    renderer: 'svg',
    loop: false,
    autoplay: false,
    path: 'images/Designersintro-4.json',
    rendererSettings: { preserveAspectRatio: sceneAR }
});

anim.addEventListener('data_failed', () => {
    console.error('Lottie failed to load Designersintro-4.json');
});

anim.addEventListener('DOMLoaded', () => {
    // Lottie may reset preserveAspectRatio after initial render — override here.
    const lottieSvg = lottieEl.querySelector('svg');
    if (lottieSvg) lottieSvg.setAttribute('preserveAspectRatio', sceneAR);

    anim.goToAndStop(0, true);

    let _heroFootKilled = false;

    ScrollTrigger.create({
        trigger: '#hero',
        start: 'top top',
        end: isMobile ? '+=180%' : '+=280%',
        pin: true,
        scrub: 0.5,
        onUpdate: self => {
            anim.goToAndStop(Math.round(self.progress * TOTAL_FRAMES), true);

            // Kill entrance tween once on first scroll tick — guards against it
            // overriding the direct opacity assignment below.
            if (!_heroFootKilled) { gsap.killTweensOf(heroFoot); _heroFootKilled = true; }
            heroFoot.style.opacity = Math.max(0, 1 - self.progress * 10);

            // Kick off SVG load at 50% — gives 38% of scroll travel to download
            if (self.progress > 0.5) _loadWorkspaceSVG();

            // Crossfade starts at 88% (almost at final scene) and ends at 100%
            if (self.progress > 0.88) {
                const t = (self.progress - 0.88) / 0.12; // 0 → 1

                svgCont.style.visibility    = 'visible';
                svgCont.style.opacity       = t;
                svgCont.style.pointerEvents = t > 0.5 ? 'all' : 'none';

                lottieEl.style.opacity       = 1 - Math.max(0, (t - 0.3) / 0.7);
                lottieEl.style.pointerEvents = t > 0.5 ? 'none' : 'auto';

                wHint.style.opacity = Math.max(0, (t - 0.7) / 0.3) * 0.45;

            } else {
                lottieEl.style.opacity       = 1;
                lottieEl.style.pointerEvents = 'auto';
                svgCont.style.visibility    = 'hidden';
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
            scrollBar.style.transform = `scaleX(${self.progress})`;
        }
    });

    // Restore scroll position after ScrollTrigger is ready so the Lottie scrub
    // and pinned hero reflect the correct frame instead of jumping back to 0.
    const savedY = +sessionStorage.getItem('scrollY') || 0;
    if (savedY > 0) {
        window.scrollTo(0, savedY);
        ScrollTrigger.refresh();
        // If restoring to a scroll position past 50%, load SVG immediately
        const heroH = document.getElementById('hero')?.offsetHeight || window.innerHeight;
        const totalH = heroH * (isMobile ? 1.8 : 2.8);
        if (savedY / totalH > 0.5) _loadWorkspaceSVG();
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

// Lazy-load the 40MB workspace SVG only when user scrolls past 50% —
// it becomes visible at 88% so this gives plenty of load time without
// penalising the initial page load / LCP.
let _svgFetched = false;
function _loadWorkspaceSVG() {
    if (_svgFetched) return;
    _svgFetched = true;
    fetch('images/Designers_Workspace.svg')
        .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(svgText => {
            svgCont.innerHTML = svgText;
            const svg = svgCont.querySelector('svg');

            svg.removeAttribute('width');
            svg.removeAttribute('height');
            svg.setAttribute('preserveAspectRatio', sceneAR);
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
                el.addEventListener('mouseenter', ()  => showTip(label));
                el.addEventListener('mouseleave', hideTip);
            });
        })
        .catch(err => {
            console.error('SVG load error:', err);
        });
}

// ── Overlay system ────────────────────────────────────────────────────────────
let activeId   = null;
let _lastFocus = null;
const backdrop = document.getElementById('backdrop');

backdrop.addEventListener('click', () => { if (activeId) _dismiss(); });
document.addEventListener('keydown', e => {
    const lb = document.getElementById('bc-photo-lb');
    if (lb?.classList.contains('open')) {
        if (e.key === 'Escape')     { window._closePhotoLb(); return; }
        if (e.key === 'ArrowLeft')  { window._photoLbNav(-1); return; }
        if (e.key === 'ArrowRight') { window._photoLbNav(1);  return; }
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const galleryScroll = document.getElementById('bc-gallery-scroll');
        if (galleryScroll) {
            e.preventDefault();
            window._galleryArrow(e.key === 'ArrowLeft' ? -1 : 1);
            return;
        }
    }
    if (e.key === 'Escape' && activeId) _dismiss();
});

function _blockScroll(e) {
    const scrollable = e.target.closest('.b-main, .panel, .b-sidebar, .peg-content');
    if (!scrollable) e.preventDefault();
}

let _calendlyLoaded = false;
function _loadCalendly() {
    if (_calendlyLoaded || typeof Calendly !== 'undefined') { _calendlyLoaded = true; return; }
    _calendlyLoaded = true;
    const s = document.createElement('script');
    s.src = 'https://assets.calendly.com/assets/external/widget.js';
    s.onload = () => {
        const w = document.querySelector('.calendly-inline-widget');
        if (w && typeof Calendly !== 'undefined') Calendly.initInlineWidgets();
    };
    document.head.appendChild(s);
}

let _focusRafId = null;

function openOverlay(id) {
    if (activeId) _dismiss(true);
    if (id === 'ov-calendar') _loadCalendly();

    const el = document.getElementById(id);
    if (!el) return;
    _lastFocus = document.activeElement;
    activeId = id;
    sessionStorage.setItem('overlayId', id);

    // Kill every tween on both elements before starting new ones
    gsap.killTweensOf(el);
    gsap.killTweensOf(backdrop);

    backdrop.style.pointerEvents = 'all';
    el.style.pointerEvents       = 'all';
    document.body.style.overflow            = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.addEventListener('wheel', _blockScroll, { passive: false });
    document.addEventListener('touchmove', _blockScroll, { passive: false });

    // Cancel any previous pending focus RAF so it doesn't land in a dismissed overlay
    if (_focusRafId) { cancelAnimationFrame(_focusRafId); _focusRafId = null; }
    _focusRafId = requestAnimationFrame(() => {
        _focusRafId = null;
        if (activeId !== id) return; // overlay was dismissed before RAF fired
        const focusable = el.querySelector('button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])');
        if (focusable) focusable.focus();
    });

    gsap.to(backdrop, { opacity: 1, duration: .3, ease: 'power2.out' });
    // On mobile skip scale/y so fullscreen overlays don't scale the whole screen
    gsap.fromTo(el,
        { opacity: 0, scale: isMobile ? 1 : .93, y: isMobile ? 0 : 24, xPercent: -50, yPercent: -50 },
        { opacity: 1, scale: 1,                   y: 0,                  xPercent: -50, yPercent: -50,
          duration: isMobile ? .28 : .42, ease: isMobile ? 'power2.out' : 'back.out(1.6)',
          onComplete: () => { if (id === 'ov-archivefolder') _initArchive(); } }
    );
}

function _dismiss(instant = false) {
    if (!activeId) return;
    const el = document.getElementById(activeId);
    const id = activeId;

    // Kill any in-progress open/close tweens FIRST — without this, a
    // fromTo open animation running on `el` fights the close tweens and
    // leaves the element frozen at an intermediate state.
    gsap.killTweensOf(el);
    gsap.killTweensOf(backdrop);

    // Cancel any pending focus RAF so it doesn't land inside a dismissed overlay
    if (_focusRafId) { cancelAnimationFrame(_focusRafId); _focusRafId = null; }

    // Stop Spotify playback when headphones modal closes
    if (id === 'ov-headphones') {
        const iframe = el.querySelector('iframe');
        if (iframe) { iframe.src = iframe.src; }
    }

    // Archive cards have pointer-events:all in CSS — clear them immediately so
    // they don't sit invisibly over the SVG workspace and swallow clicks.
    // Kill their infinite floating tweens before removing, otherwise GSAP
    // keeps animating detached DOM nodes.
    if (id === 'ov-archivefolder') {
        const cards = document.getElementById('archive-cards');
        if (cards) {
            gsap.killTweensOf('.archive-card');
            cards.innerHTML = '';
        }
    }

    // Reset pointer-events synchronously — never rely on onComplete for this,
    // as interrupted animations leave the backdrop blocking all subsequent clicks.
    el.style.pointerEvents      = 'none';
    backdrop.style.pointerEvents = 'none';
    document.body.style.overflow            = '';
    document.documentElement.style.overflow = '';
    document.removeEventListener('wheel', _blockScroll);
    document.removeEventListener('touchmove', _blockScroll);
    activeId = null;
    sessionStorage.removeItem('overlayId');

    // Return focus to whatever triggered the overlay
    if (_lastFocus instanceof HTMLElement) {
        try { _lastFocus.focus(); } catch (_) {}
    }
    _lastFocus = null;

    if (instant) {
        gsap.set(el,       { opacity: 0, scale: 1, y: 0, xPercent: -50, yPercent: -50 });
        gsap.set(backdrop, { opacity: 0 });
    } else {
        gsap.to(el,       { opacity: 0, scale: isMobile ? 1 : .95, y: isMobile ? 0 : 14,
                            xPercent: -50, yPercent: -50, duration: .28, ease: 'power2.in' });
        gsap.to(backdrop, { opacity: 0, duration: .28 });
    }
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
    const _bMain = document.querySelector('.b-main');
    if (_bMain) _bMain.scrollTop = 0;
    const sidebar = document.getElementById('b-sidebar');
    const openBtn = document.getElementById('b-sidebar-open');
    // On mobile start with sidebar closed so the project content has full width
    if (sidebar) sidebar.classList.toggle('closed', isMobile);
    if (openBtn) openBtn.style.display = isMobile ? 'flex' : 'none';
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
                gallery:  meta.gallery  === 'true',
                flipbook: meta.flipbook === 'true',
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
    if (!proj || proj.gallery || proj.flipbook) { group.innerHTML = ''; return; }
    const names = Object.keys(proj.sections);
    group.innerHTML = `<p class="b-group-label">Sections</p>` +
        names.map((n, i) => `<button class="b-sec${i === 0 ? ' active' : ''}" onclick="selectBrowserSection(this)">${n}</button>`).join('');
}

const _imgIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

function _processImages(html) {
    const replaced = html.replace(/<img([^>]*)>/g, (_, attrs) => {
        const src = (attrs.match(/src="([^"]*)"/) || [])[1] || '';
        const alt = (attrs.match(/alt="([^"]*)"/) || [])[1] || '';
        if (!src || src === 'placeholder') {
            return `<div class="bc-img-ph">${_imgIcon}<span class="bc-img-ph-label">${alt || 'Image'}</span></div>`;
        }
        return `<img src="${src}" alt="${alt}" class="bc-img-real">`;
    });
    // Multiple images in one <p> (marked groups consecutive img lines together)
    const grouped = replaced.replace(/<p>((?:\s*<img[^>]+>\s*(?:<br\s*\/?>)?\s*){2,})<\/p>/g, (_, content) => {
        const imgs = content.match(/<img[^>]+>/g) || [];
        return `<div class="bc-img-grid">${imgs.join('')}</div>`;
    });
    // Fallback: consecutive single-image <p> tags
    return grouped.replace(/(<p><img[^>]+class="bc-img-real"[^>]*><\/p>\s*){2,}/g, match => {
        const imgs = match.match(/<img[^>]+>/g) || [];
        return `<div class="bc-img-grid">${imgs.join('')}</div>`;
    });
}

function _renderBrowserContent() {
    const el = document.getElementById('b-content');
    if (!el) return;
    const proj = (_ALL_PROJECTS[_currentBrowserTab] || {})[_currentBrowserProject];
    if (!proj) return;
    el.style.setProperty('--bc-color', proj.accent);
    if (proj.gallery)  { _renderPhotoGallery(el, proj); return; }
    document.querySelector('.b-main')?.classList.remove('gallery-active');

    const md = (typeof marked !== 'undefined') ? s => _processImages(marked.parse(s)) : s => `<p>${s}</p>`;

    // For flipbook projects render sections normally but swap hero for the flipbook embed
    if (proj.flipbook) {
        const sectionNames = Object.keys(proj.sections).filter(n => n !== 'Pages');
        const sectionsHTML = sectionNames.map((name, i) => `
            <section id="bc-sec-${_secSlug(name)}" data-section="${name}" class="bc-section">
                ${i > 0 ? `<h2 class="bc-section-heading">${name}</h2>` : ''}
                <div class="bc-rendered">${md(proj.sections[name])}</div>
            </section>
            ${i < sectionNames.length - 1 ? '<div class="bc-divider"></div>' : ''}
        `).join('');
        el.innerHTML = `
            <p class="bc-tag">${proj.tag}</p>
            <h2 class="bc-title">${_currentBrowserProject}</h2>
            <p class="bc-subtitle">${proj.subtitle}</p>
            <div class="bc-flipbook-embed">
                <div class="bc-flipbook-stage" id="bc-flipbook-stage">
                    <div id="bc-flipbook"></div>
                </div>
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
        _initFlipbookEmbed(proj);
        return;
    }

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
    document.querySelector('.b-main')?.classList.remove('gallery-active');
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

// ── Flipbook embed ─────────────────────────────────────────────────────────────
let _pageFlipInstance = null;

function _initFlipbookEmbed(proj) {
    // Parse page images from ### Pages section if present
    const parseMd = (typeof marked !== 'undefined') ? s => marked.parse(s) : s => s;
    const pagesMd = proj.sections['Pages'] || '';
    const tmp = document.createElement('div');
    tmp.innerHTML = parseMd(pagesMd);
    const pageImgs = Array.from(tmp.querySelectorAll('img'));
    const useImages = pageImgs.length > 0;

    const container = document.getElementById('bc-flipbook');
    if (!container) return;
    container.innerHTML = useImages
        ? pageImgs.map(img =>
            `<div class="pf-page"><img src="${img.src}" alt="${img.alt}" style="width:100%;height:100%;display:block;"></div>`
          ).join('')
        : _flipbookPlaceholderPages();

    const initWithRatio = (ratio) => {
        const stage = document.getElementById('bc-flipbook-stage');
        if (!stage || !container) return;
        const w = Math.min(Math.floor(stage.clientWidth / 2) - 16, 300);
        const h = Math.round(w * ratio);
        stage.style.height = (h + 24) + 'px';
        if (_pageFlipInstance) { try { _pageFlipInstance.destroy(); } catch(e) {} _pageFlipInstance = null; }
        _pageFlipInstance = new St.PageFlip(container, {
            width: w, height: h,
            showCover: true,
            flippingTime: 700,
            drawShadow: true,
            usePortrait: false,
            mobileScrollSupport: true,
            swipeDistance: 30,
        });
        _pageFlipInstance.loadFromHTML(container.querySelectorAll('.pf-page'));
    };

    const doInit = () => {
        if (useImages) {
            const firstImg = container.querySelector('.pf-page img');
            if (firstImg?.naturalWidth > 0) {
                initWithRatio(firstImg.naturalHeight / firstImg.naturalWidth);
            } else if (firstImg) {
                firstImg.onload = () => initWithRatio(firstImg.naturalHeight / firstImg.naturalWidth);
            } else {
                initWithRatio(1.41);
            }
        } else {
            initWithRatio(1.41);
        }
    };

    const src = 'https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js';
    if (window.St?.PageFlip) { doInit(); }
    else {
        const s = document.createElement('script');
        s.src = src; s.onload = doInit;
        document.head.appendChild(s);
    }
}

function _flipbookPlaceholderPages() {
    const bg = `background:linear-gradient(160deg,#1c1208 0%,#3a1a06 100%)`;
    const cream = `background:#f8f1e8`;
    const white = `background:#ffffff`;
    const gold = `#c47a35`;
    const dark = `#2a1a08`;
    const body = `font-family:Georgia,serif`;
    const muted = `color:#6a5040;font-family:Georgia,serif;line-height:1.55;font-size:8px`;

    const page = (bg, inner) =>
        `<div class="pf-page" style="overflow:hidden;box-sizing:border-box;">
            <div style="width:100%;height:100%;${bg};padding:28px 24px;box-sizing:border-box;display:flex;flex-direction:column;position:relative;">
                ${inner}
            </div>
        </div>`;

    const heading = (label, marginBottom='16px') =>
        `<div style="font-size:8px;letter-spacing:.25em;text-transform:uppercase;color:${gold};margin-bottom:6px;${body}">${label}</div>
         <div style="width:28px;height:1px;background:${gold};margin-bottom:${marginBottom};"></div>`;

    const pages = [
        // 1 — Cover
        page(bg, `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
                <div style="letter-spacing:.35em;font-size:9px;text-transform:uppercase;color:${gold};${body};margin-bottom:6px;">Clearlight</div>
                <div style="font-size:18px;font-weight:300;color:#f0e6d6;letter-spacing:.07em;${body};margin-bottom:2px;">Infrared Sauna</div>
                <div style="font-size:10px;color:rgba(240,230,214,.45);letter-spacing:.12em;${body};margin-bottom:18px;">Sanctuary Series</div>
                <div style="width:40px;height:1px;background:${gold};margin-bottom:18px;"></div>
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style="margin-bottom:18px;">
                    <circle cx="22" cy="22" r="21" stroke="${gold}" stroke-width="1" fill="none"/>
                    <path d="M22 11 C22 11 16 17 16 22 C16 28 18 32 22 34 C26 32 28 28 28 22 C28 17 22 11 22 11Z" stroke="${gold}" stroke-width="1.1" fill="none"/>
                    <path d="M16 19 C14 21 14 24 15 26" stroke="${gold}" stroke-width=".9" stroke-linecap="round"/>
                    <path d="M28 19 C30 21 30 24 29 26" stroke="${gold}" stroke-width=".9" stroke-linecap="round"/>
                </svg>
                <div style="font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:rgba(240,230,214,.3);${body};">Owner's Manual</div>
            </div>
            <div style="text-align:center;font-size:7px;color:rgba(240,230,214,.18);${body};letter-spacing:.08em;">CL-SAUNA-2P · REV 2026</div>`),

        // 2 — Welcome
        page(cream, `
            <div style="width:100%;height:3px;background:linear-gradient(90deg,${gold},transparent);margin-bottom:20px;flex-shrink:0;border-radius:2px;"></div>
            ${heading('Welcome', '12px')}
            <div style="font-size:15px;font-weight:normal;color:${dark};${body};line-height:1.3;margin-bottom:12px;">Thank you for choosing Clearlight.</div>
            <p style="${muted};margin-bottom:10px;">Your Clearlight Infrared Sauna has been crafted to deliver a genuine wellness experience — combining the therapeutic benefits of true infrared heat with thoughtful, lasting design.</p>
            <p style="${muted};margin-bottom:16px;">Please read this manual carefully before first use. Following these instructions will help you get the most from your sauna and ensure years of safe, restorative sessions.</p>
            <div style="border-left:2px solid ${gold};padding-left:10px;">
                <div style="font-size:7px;letter-spacing:.15em;text-transform:uppercase;color:${gold};margin-bottom:7px;${body};">What's included</div>
                ${['Sauna cabin & panels','True Wave™ carbon heaters','Chromotherapy lighting','Audio system & remote','Power supply cable','This owner\'s manual'].map(i=>`<div style="${muted};padding:2px 0;">· ${i}</div>`).join('')}
            </div>
            <div style="position:absolute;bottom:16px;right:16px;font-size:7px;color:rgba(90,58,32,.3);${body};">clearlight.com</div>`),

        // 3 — Contents
        page(white, `
            ${heading('Contents')}
            ${[['01','Safety Information','4'],['02','Quick Start Guide','6'],['03','Infrared Technology','10'],['04','Chromotherapy','12'],['05','Audio & Controls','14'],['06','Clearlight App','16'],['07','Care & Maintenance','18'],['08','Troubleshooting','20']].map(([n,t,p])=>`
                <div style="display:flex;align-items:baseline;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0e8dc;">
                    <div style="display:flex;align-items:baseline;gap:8px;">
                        <span style="font-size:7px;color:${gold};${body};letter-spacing:.08em;">${n}</span>
                        <span style="font-size:8.5px;color:${dark};${body};">${t}</span>
                    </div>
                    <span style="font-size:7.5px;color:#9a7a5a;${body};">${p}</span>
                </div>`).join('')}`),

        // 4 — Safety
        page(white, `
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;">
                <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1L11 10H1L6 1Z" stroke="#c0392b" stroke-width="1.1" fill="none"/><line x1="6" y1="4.5" x2="6" y2="7.5" stroke="#c0392b" stroke-width="1" stroke-linecap="round"/><circle cx="6" cy="9" r=".65" fill="#c0392b"/></svg>
                <div style="font-size:8px;letter-spacing:.2em;text-transform:uppercase;color:#c0392b;${body};">Safety</div>
            </div>
            <div style="width:100%;height:1px;background:#f0e8dc;margin-bottom:12px;"></div>
            ${[['Consult physician','Consult a doctor before use if you have cardiovascular conditions, are pregnant, or take medications.'],['Hydration','Drink water before and after each session. Avoid alcohol during use.'],['Session limits','Begin with 15–20 min sessions. Do not exceed 45 minutes.'],['Children','Always supervise children. Elderly users should limit session duration.'],['Exit if unwell','Exit immediately if you feel dizzy, nauseous, or unwell.'],['Keep dry','Keep liquids away from heaters. No electrical devices inside.']].map(([t,d])=>`
                <div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start;">
                    <div style="width:4px;height:4px;background:${gold};border-radius:50%;flex-shrink:0;margin-top:4px;"></div>
                    <div>
                        <div style="font-size:8px;font-weight:bold;color:${dark};${body};margin-bottom:1px;">${t}</div>
                        <div style="${muted};">${d}</div>
                    </div>
                </div>`).join('')}`),

        // 5 — Quick Start
        page(cream, `
            ${heading('Quick Start')}
            ${[['01','Position & Assemble','Place on a level, dry surface with 6 inches clearance on all sides.'],['02','Power Connection','Plug into a dedicated 120V / 20A circuit. Do not use extension cords.'],['03','Preheat','Set to 120–130°F. Allow 20–30 minutes to preheat before entering.'],['04','First Session','Start with 15 minutes at low temperature. Increase gradually.']].map(([n,t,d])=>`
                <div style="display:flex;gap:10px;margin-bottom:12px;align-items:flex-start;">
                    <div style="width:20px;height:20px;border:1px solid ${gold};border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <span style="font-size:7px;color:${gold};${body};">${n}</span>
                    </div>
                    <div>
                        <div style="font-size:8.5px;font-weight:bold;color:${dark};${body};margin-bottom:2px;">${t}</div>
                        <div style="${muted};">${d}</div>
                    </div>
                </div>`).join('')}
            <div style="background:${dark};border-radius:5px;padding:9px 12px;margin-top:auto;">
                <div style="font-size:7px;letter-spacing:.1em;text-transform:uppercase;color:${gold};margin-bottom:5px;${body};">Recommended first session</div>
                <div style="display:flex;justify-content:space-between;">
                    ${[['120°F','Temp'],['15 min','Duration'],['Low','Level']].map(([v,l])=>`<div style="text-align:center;"><div style="font-size:13px;color:#f0e6d6;${body};">${v}</div><div style="font-size:6.5px;color:rgba(240,230,214,.4);${body};margin-top:1px;">${l}</div></div>`).join('')}
                </div>
            </div>`),

        // 6 — Features
        page(white, `
            ${heading('Features')}
            ${[['True Wave™ Infrared','Full-spectrum carbon heaters deliver far, mid, and near infrared for deep tissue penetration with ultra-low EMF.'],['Chromotherapy','7-colour LED therapy system. Each colour targets different therapeutic and mood benefits.'],['Bluetooth Audio','Built-in speakers support any Bluetooth device. Manage playback from the panel or your phone.'],['Clearlight App','Control temperature, session timer, chromotherapy, and audio from the Clearlight mobile app.']].map(([t,d])=>`
                <div style="margin-bottom:11px;padding-bottom:11px;border-bottom:1px solid #f0e8dc;">
                    <div style="font-size:8.5px;font-weight:bold;color:${dark};${body};margin-bottom:2px;">${t}</div>
                    <div style="${muted};">${d}</div>
                </div>`).join('')}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:auto;">
                ${[['−8mG','Ultra Low EMF'],['360°','IR Coverage'],['7','Colour Therapy'],['20yr','Heater Life']].map(([v,l])=>`<div style="background:#f8f1e8;border-radius:4px;padding:7px;text-align:center;"><div style="font-size:13px;color:${gold};${body};">${v}</div><div style="font-size:6.5px;color:#9a7a5a;${body};margin-top:2px;">${l}</div></div>`).join('')}
            </div>`),

        // 7 — Care
        page(cream, `
            ${heading('Care & Maintenance')}
            <div style="font-size:7px;letter-spacing:.1em;text-transform:uppercase;color:#9a7a5a;margin-bottom:7px;${body};">Cleaning schedule</div>
            ${[['After each use','Wipe benches and floor with a dry towel. Leave door open 30 min.'],['Weekly','Wipe wood with a barely damp cloth. No soaps or chemicals on cedar.'],['Monthly','Inspect heater connections. Vacuum dust from vents.'],['Yearly','Sand bench surfaces with fine-grit paper. Inspect door seals.']].map(([f,d])=>`
                <div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start;">
                    <div style="background:${gold};border-radius:2px;padding:2px 5px;flex-shrink:0;"><span style="font-size:6.5px;color:#fff;${body};">${f}</span></div>
                    <div style="${muted};">${d}</div>
                </div>`).join('')}
            <div style="margin-top:12px;border-top:1px solid rgba(196,122,53,.2);padding-top:10px;">
                <div style="font-size:7px;letter-spacing:.1em;text-transform:uppercase;color:#9a7a5a;margin-bottom:6px;${body};">Do not use</div>
                ${['Bleach or harsh chemicals','Pressure washers or steam cleaners','Oils or waxes near heaters'].map(i=>`<div style="${muted};color:#c0392b;padding:2px 0;">✕ ${i}</div>`).join('')}
            </div>`),

        // 8 — Back Cover
        page(bg, `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
                <div style="letter-spacing:.35em;font-size:9px;text-transform:uppercase;color:${gold};${body};margin-bottom:20px;">Clearlight</div>
                <div style="width:36px;height:1px;background:rgba(196,122,53,.3);margin-bottom:20px;"></div>
                <div style="font-size:8px;color:rgba(240,230,214,.35);${body};line-height:2.2;letter-spacing:.05em;">clearlight.com<br>support@clearlight.com<br>1-800-CLEARLT</div>
            </div>
            <div style="text-align:center;font-size:7px;color:rgba(240,230,214,.15);${body};letter-spacing:.08em;">&copy; 2026 Clearlight Infrared. All rights reserved.</div>`),
    ];
    return pages.join('');
}


// ── Photo gallery renderer ────────────────────────────────────────────────────
function _renderPhotoGallery(el, proj) {
    document.querySelector('.b-main')?.classList.add('gallery-active');

    const md = (typeof marked !== 'undefined') ? s => marked.parse(s) : s => s;
    const galleryMd = proj.sections['Gallery'] || '';
    const tmp = document.createElement('div');
    tmp.innerHTML = md(galleryMd);
    const imgs = Array.from(tmp.querySelectorAll('img'));

    if (imgs.length === 0) {
        el.innerHTML = `
            <div class="bc-coming-soon">
                <p class="bc-coming-soon-eyebrow">${_currentBrowserProject}</p>
                <h2 class="bc-coming-soon-title">Coming<br>Soon</h2>
                <p class="bc-coming-soon-body">Photos landing here soon.</p>
            </div>`;
        return;
    }

    el.innerHTML = `
        <div class="bc-gallery-wrap">
            <div class="bc-gallery-header">
                <p class="bc-tag">${proj.tag}</p>
                <h2 class="bc-title" style="margin-bottom:0">${_currentBrowserProject}</h2>
            </div>
            <div class="bc-gallery-main">
                <button class="bc-gallery-arrow bc-gallery-arrow-l" id="bc-arrow-l" onclick="window._galleryArrow(-1)" style="opacity:.25;pointer-events:none">&#8592;</button>
                <div class="bc-gallery-scroll" id="bc-gallery-scroll">
                    ${imgs.map((img, i) => `
                        <div class="bc-gallery-photo${i === 0 ? ' active' : ''}" id="bc-gphoto-${i}" data-idx="${i}">
                            <img src="${img.src}" alt="${img.alt}" loading="${i < 2 ? 'eager' : 'lazy'}">
                        </div>`
                    ).join('')}
                    <div class="bc-gallery-counter" id="bc-gallery-counter">1 / ${imgs.length}</div>
                </div>
                <button class="bc-gallery-arrow bc-gallery-arrow-r" id="bc-arrow-r" onclick="window._galleryArrow(1)"${imgs.length <= 1 ? ' style="opacity:.25;pointer-events:none"' : ''}>&#8594;</button>
            </div>
            <div class="bc-gallery-strip" id="bc-gallery-strip">
                ${imgs.map((img, i) => `
                    <button class="bc-thumb${i === 0 ? ' active' : ''}" data-idx="${i}" onclick="window._jumpToPhoto(${i})">
                        <img src="${img.src}" alt="${img.alt}" loading="lazy">
                    </button>`
                ).join('')}
            </div>
        </div>`;
}

window._jumpToPhoto = idx => {
    const photos = document.querySelectorAll('#bc-gallery-scroll .bc-gallery-photo');
    const thumbs = document.querySelectorAll('#bc-gallery-strip .bc-thumb');
    photos.forEach((p, i) => p.classList.toggle('active', i === idx));
    thumbs.forEach((t, i) => t.classList.toggle('active', i === idx));
    document.querySelector(`#bc-gallery-strip .bc-thumb[data-idx="${idx}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    const counter = document.getElementById('bc-gallery-counter');
    if (counter) counter.textContent = `${idx + 1} / ${photos.length}`;
    // Dim arrows at boundaries
    const arrowL = document.getElementById('bc-arrow-l');
    const arrowR = document.getElementById('bc-arrow-r');
    const atStart = idx === 0, atEnd = idx === photos.length - 1;
    if (arrowL) { arrowL.style.opacity = atStart ? '0.25' : '1'; arrowL.style.pointerEvents = atStart ? 'none' : 'auto'; }
    if (arrowR) { arrowR.style.opacity = atEnd   ? '0.25' : '1'; arrowR.style.pointerEvents = atEnd   ? 'none' : 'auto'; }
};

window._galleryArrow = dir => {
    const photos = Array.from(document.querySelectorAll('#bc-gallery-scroll .bc-gallery-photo'));
    const current = photos.findIndex(p => p.classList.contains('active'));
    const next = Math.max(0, Math.min(photos.length - 1, current + dir));
    window._jumpToPhoto(next);
};

window._closePhotoLb = () => {
    document.getElementById('bc-photo-lb')?.classList.remove('open');
};

window._photoLbNav = _dir => {};

// Close lightbox on backdrop click
document.getElementById('bc-photo-lb')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) window._closePhotoLb();
});

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
            // Kill existing float tweens before restarting to avoid stacking
            // infinite tweens on every drag release.
            gsap.killTweensOf(card, 'y,rotation');
            _startFloat(card);
            if (!moved) _openArchiveLightbox(item);
        });
    });
}
