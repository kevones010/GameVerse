const TRANSITION_MS = 900;
const REDUCED_TRANSITION_MS = 120;
const JUMP_AT_MS = 650;
const RUN_FRAME_MS = 72;

const VEE_ASSETS = Object.freeze({
  runFrames: [
    'assets/vee/transition/vee-run-01.webp',
    'assets/vee/transition/vee-run-02.webp',
    'assets/vee/transition/vee-run-03.webp',
    'assets/vee/transition/vee-run-04.webp'
  ],
  jump: 'assets/vee/transition/vee-jump.webp',
  portal: 'assets/vee/effects/portal.webp',
  particles: 'assets/vee/effects/particles.webp'
});

let isTransitioning = false;
let frameAnimationId = 0;
let jumpTimerId = 0;
let navigationTimerId = 0;
let fallbackCleanupTimerId = 0;
let overlayElement = null;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function preloadTransitionAssets() {
  if (prefersReducedMotion()) return;

  [...VEE_ASSETS.runFrames, VEE_ASSETS.jump, VEE_ASSETS.portal].forEach((source) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = source;
  });
}

function createOverlay(reducedMotion = false) {
  const overlay = document.createElement('div');
  overlay.className = 'gv-transition';
  overlay.setAttribute('aria-hidden', 'true');

  if (!reducedMotion) {
    overlay.innerHTML = `
      <div class="gv-transition-stage">
        <div class="gv-runner-wrap" aria-hidden="true">
          <span class="gv-speed-line line-a"></span>
          <span class="gv-speed-line line-b"></span>
          <img class="gv-particles gv-particles--trail" src="${VEE_ASSETS.particles}" alt="" />
          <img class="gv-runner" src="${VEE_ASSETS.runFrames[0]}" alt="" />
        </div>
        <img class="gv-portal" src="${VEE_ASSETS.portal}" alt="" aria-hidden="true" />
        <img class="gv-particles gv-particles--portal" src="${VEE_ASSETS.particles}" alt="" aria-hidden="true" />
        <img class="gv-particles gv-particles--entry" src="${VEE_ASSETS.particles}" alt="" aria-hidden="true" />
        <p class="gv-transition-copy">Vee está abrindo o próximo universo...</p>
      </div>`;
  }

  document.body.appendChild(overlay);
  overlayElement = overlay;
  return overlay;
}

function stopRunFrames() {
  if (frameAnimationId) {
    window.cancelAnimationFrame(frameAnimationId);
    frameAnimationId = 0;
  }
}

function startRunFrames(runner) {
  let frameIndex = 0;
  let lastFrameTime = performance.now();

  const updateFrame = (currentTime) => {
    if (!isTransitioning || runner.closest('.gv-runner-wrap')?.classList.contains('is-jumping')) {
      frameAnimationId = 0;
      return;
    }

    if (currentTime - lastFrameTime >= RUN_FRAME_MS) {
      const elapsedFrames = Math.floor((currentTime - lastFrameTime) / RUN_FRAME_MS);
      frameIndex = (frameIndex + elapsedFrames) % VEE_ASSETS.runFrames.length;
      runner.src = VEE_ASSETS.runFrames[frameIndex];
      lastFrameTime += elapsedFrames * RUN_FRAME_MS;
    }

    frameAnimationId = window.requestAnimationFrame(updateFrame);
  };

  frameAnimationId = window.requestAnimationFrame(updateFrame);
}

function clearTransitionTimers() {
  if (jumpTimerId) window.clearTimeout(jumpTimerId);
  if (navigationTimerId) window.clearTimeout(navigationTimerId);
  if (fallbackCleanupTimerId) window.clearTimeout(fallbackCleanupTimerId);
  jumpTimerId = 0;
  navigationTimerId = 0;
  fallbackCleanupTimerId = 0;
}

function cleanupTransition() {
  stopRunFrames();
  clearTransitionTimers();
  overlayElement?.remove();
  overlayElement = null;
  isTransitioning = false;
}

function finishNavigation(url) {
  stopRunFrames();
  if (jumpTimerId) window.clearTimeout(jumpTimerId);
  jumpTimerId = 0;
  navigationTimerId = 0;

  window.location.href = url;

  // Se a navegação for cancelada, libera a página sem deixar o overlay preso.
  fallbackCleanupTimerId = window.setTimeout(cleanupTransition, 1200);
}

export function navigateWithVee(url) {
  if (!url || isTransitioning) return false;

  isTransitioning = true;
  const reducedMotion = prefersReducedMotion();
  const overlay = createOverlay(reducedMotion);

  window.requestAnimationFrame(() => {
    overlay.classList.add('is-active');
  });

  if (!reducedMotion) {
    const runnerWrap = overlay.querySelector('.gv-runner-wrap');
    const runner = overlay.querySelector('.gv-runner');
    startRunFrames(runner);

    jumpTimerId = window.setTimeout(() => {
      stopRunFrames();
      runner.src = VEE_ASSETS.jump;
      runnerWrap.classList.add('is-jumping');
    }, JUMP_AT_MS);
  }

  navigationTimerId = window.setTimeout(
    () => finishNavigation(url),
    reducedMotion ? REDUCED_TRANSITION_MS : TRANSITION_MS
  );

  return true;
}

function getInternalHref(link) {
  const href = link.getAttribute('href')?.trim();
  const target = link.getAttribute('target')?.trim().toLowerCase();

  if (
    !href ||
    href.startsWith('#') ||
    link.hasAttribute('download') ||
    (target && target !== '_self') ||
    /^(mailto:|tel:|javascript:)/i.test(href)
  ) {
    return null;
  }

  let destination;
  try {
    destination = new URL(href, window.location.href);
  } catch {
    return null;
  }

  const isSameHttpOrigin = /^https?:$/.test(destination.protocol) && destination.origin === window.location.origin;
  const isLocalFile = window.location.protocol === 'file:' && destination.protocol === 'file:';

  if (!isSameHttpOrigin && !isLocalFile) {
    return null;
  }

  // Mantém o href original para preservar a query string sem normalização.
  return href;
}

function isClickFromExcludedControl(target, link) {
  const control = target.closest('button, input, select, textarea, label, [role="button"], [data-no-vee-transition]');
  return Boolean(control && control !== link);
}

function handleNavigationClick(event) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !(event.target instanceof Element)
  ) {
    return;
  }

  const link = event.target.closest('a[href]');
  if (!link || isClickFromExcludedControl(event.target, link)) return;

  const href = getInternalHref(link);
  if (!href) return;

  // Impede tanto a primeira navegação imediata quanto cliques rápidos subsequentes.
  event.preventDefault();
  navigateWithVee(href);
}

function replayClass(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  element.addEventListener('animationend', () => element.classList.remove(className), { once: true });
}

function handleMicrointeractionClick(event) {
  if (prefersReducedMotion() || !(event.target instanceof Element)) return;

  const favoriteButton = event.target.closest('#favoriteButton.favorite-btn');
  if (favoriteButton && favoriteButton.textContent.includes('Favoritado')) {
    replayClass(favoriteButton, 'gv-favorite-burst');
    return;
  }

  if (!event.target.closest('.star-btn')) return;

  window.requestAnimationFrame(() => {
    document.querySelectorAll('.star-btn.active').forEach((star, index) => {
      star.style.setProperty('--gv-star-index', index);
      replayClass(star, 'gv-star-selected');
    });
  });
}

export function setupVeeTransitions() {
  preloadTransitionAssets();
  document.addEventListener('click', handleNavigationClick);
  document.addEventListener('click', handleMicrointeractionClick);
  window.addEventListener('pagehide', cleanupTransition);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) cleanupTransition();
  });
}

setupVeeTransitions();
