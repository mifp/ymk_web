const panels = [...document.querySelectorAll('[data-panel]')];
const serviceLinks = [...document.querySelectorAll('[data-service]')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let scene = null;
let active = 'home';
let paused = reducedMotion.matches;
const themeSelect = document.getElementById('themeSelect');

function syncAccent() {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const property = serviceLinks.some(link => link.dataset.service === active) ? `--service-${active}` : '--theme-accent';
  root.style.setProperty('--accent', styles.getPropertyValue(property).trim());
}

function applyTheme(value, { persist = true, announce = false } = {}) {
  const theme = [...themeSelect.options].some(option => option.value === value) ? value : 'signal';
  document.documentElement.dataset.theme = theme;
  themeSelect.value = theme;
  syncAccent();
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  scene?.setTheme();
  if (persist) {
    try { localStorage.setItem('ymk_v6_theme', theme); } catch { /* Themes also work when storage is unavailable. */ }
  }
  if (announce) document.getElementById('announcement').textContent = `Farvetema: ${themeSelect.selectedOptions[0].textContent}.`;
}
themeSelect.addEventListener('change', () => applyTheme(themeSelect.value, { announce: true }));
applyTheme(document.documentElement.dataset.theme, { persist: false });

document.getElementById('year').textContent = new Date().getFullYear();

function navigate({ focus = false } = {}) {
  const requested = location.hash.slice(1) || 'home';
  active = panels.some(panel => panel.dataset.panel === requested) ? requested : 'home';
  for (const panel of panels) panel.hidden = panel.dataset.panel !== active;
  for (const link of serviceLinks) {
    if (link.dataset.service === active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  syncAccent();
  scene?.select(active);
  const visiblePanel = panels.find(panel => !panel.hidden);
  document.title = active === 'home' ? 'YMK — Det hele hænger sammen' : `YMK — ${visiblePanel.querySelector('.eyebrow').textContent.replace(/^\d+ \/ /, '')}`;
  if (focus) {
    const heading = visiblePanel.querySelector('h1, h2');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }
}

// Keep real links, browser history, deep links and keyboard navigation working.
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || link.classList.contains('skip-link') || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  const id = link.getAttribute('href').slice(1);
  if (!panels.some(panel => panel.id === id)) return;
  event.preventDefault();
  if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
  navigate({ focus: true });
});
addEventListener('popstate', () => navigate());
addEventListener('hashchange', () => navigate());
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && active !== 'home' && !event.defaultPrevented && !event.target.closest('select')) {
    history.pushState(null, '', '#home');
    navigate({ focus: true });
  }
});
navigate();

const pauseButton = document.getElementById('pauseScene');
function syncPause() {
  scene?.setPaused(paused);
  pauseButton.setAttribute('aria-pressed', String(paused));
  pauseButton.setAttribute('aria-label', paused ? 'Afspil animation' : 'Sæt animation på pause');
  pauseButton.title = pauseButton.getAttribute('aria-label');
  document.getElementById('pauseIcon').textContent = paused ? '▷' : 'Ⅱ';
}
pauseButton.addEventListener('click', () => { paused = !paused; syncPause(); });
document.getElementById('resetScene').addEventListener('click', () => scene?.reset());
reducedMotion.addEventListener('change', event => {
  paused = event.matches;
  scene?.setReducedMotion(event.matches);
  syncPause();
});
for (const link of serviceLinks) {
  link.addEventListener('pointerenter', () => scene?.highlight(link.dataset.service));
  link.addEventListener('pointerleave', () => scene?.highlight(null));
  link.addEventListener('focus', () => scene?.highlight(link.dataset.service));
  link.addEventListener('blur', () => scene?.highlight(null));
}

let copyTimer;
document.getElementById('copyEmail').addEventListener('click', async event => {
  const button = event.currentTarget;
  clearTimeout(copyTimer);
  try {
    await navigator.clipboard.writeText('hello@ymk.dk');
    button.textContent = 'Kopieret ✓';
    document.getElementById('announcement').textContent = 'E-mailadressen er kopieret.';
  } catch {
    button.textContent = 'hello@ymk.dk';
    document.getElementById('announcement').textContent = 'E-mailadressen er hello@ymk.dk. Markér adressen for at kopiere den.';
  }
  copyTimer = setTimeout(() => { button.textContent = 'Kopiér e-mail ⧉'; }, 3000);
});

// The content and links initialize before Three.js loads, and remain usable if it fails.
function showFallback() {
  document.body.classList.add('scene-unavailable');
  document.body.classList.remove('scene-ready');
  document.getElementById('sceneTools').hidden = true;
  document.getElementById('sceneNote').textContent = 'Udforsk vores kompetencer i menuen nedenfor.';
}
const loadingTimeout = setTimeout(showFallback, 10000);
try {
  const { createScene } = await import('./scene.js');
  scene = createScene({
    canvas: document.getElementById('scene'),
    stage: document.getElementById('sceneStage'),
    labels: document.getElementById('sceneLabels'),
    reducedMotion: reducedMotion.matches,
    onError: showFallback,
  });
  clearTimeout(loadingTimeout);
  document.body.classList.remove('scene-unavailable');
  document.body.classList.add('scene-ready');
  document.getElementById('sceneTools').hidden = false;
  scene.select(active);
  syncPause();
} catch (error) {
  clearTimeout(loadingTimeout);
  console.warn('3D-visningen er ikke tilgængelig:', error);
  showFallback();
}
