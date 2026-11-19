import { getGame, getGamesList } from './services/rawgService.js';
import { sortByRelevance, escapeHtml } from './utils.js';
import { navigateWithVee } from './motion.js';
import { readFavorites } from './services/gameStorage.js';
import { readCollection, statusInfo } from './services/collectionStorage.js';

const FAVORITE_NAMES = [
  'Persona 5 Royal', 'Metaphor: ReFantazio', 'The Legend of Zelda: Breath of the Wild',
  'Persona 4 Golden', 'Final Fantasy VII Remake', 'Resident Evil 4 Remake',
  'Super Mario Odyssey', 'Hollow Knight: Silksong', 'Persona 3 Reload',
  'Pokémon HeartGold', 'Pokémon Legends Z-A', 'Pokémon Legends Arceus',
  'Super Mario World', 'Yakuza: Like a Dragon', 'Super Mario 64', 'Super Mario Galaxy',
  'Pokémon Black 2', 'Zelda Ocarina of Time', 'Hollow Knight', 'Resident Evil 2 Remake'
];

const HERO_SLIDES = [
  { slug: 'persona-5-royal', tag: 'Nova coleção' },
  { slug: 'metaphor-refantazio', tag: 'Pré-lançamento' },
  { slug: 'the-legend-of-zelda-breath-of-the-wild', tag: 'Clássico' },
  { slug: 'resident-evil-4-2023', tag: 'Terror premium' },
  { slug: 'super-mario-odyssey', tag: 'Família' }
];

let heroIntervalId = null;
let heroCurrentIndex = 0;

function openGame(id, slug) {
  const target = slug ? `game.html?slug=${encodeURIComponent(slug)}` : `game.html?id=${id}`;
  navigateWithVee(target);
}

function formatReleaseDate(released) {
  const date = new Date(`${released}T12:00:00`);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');
}

function daysUntil(released) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${released}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

// Fileira "Sua coleção": usa só o que está salvo no navegador (sem chamar a RAWG).
function renderCollectionRow(section) {
  const favorites = readFavorites().value.filter((item) => item.name);
  const collection = Object.values(readCollection().value);
  const map = new Map();
  favorites.forEach((item) => map.set(item.id, { ...item, favorite: true }));
  collection.forEach((item) => map.set(item.id, { ...map.get(item.id), ...item }));
  const items = [...map.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 12);

  if (!items.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  const games = items.map((item) => ({
    id: item.id,
    slug: item.slug,
    name: item.name,
    background_image: item.image,
    released: item.released,
    badge: statusInfo(item.status) ? `${statusInfo(item.status).icon} ${statusInfo(item.status).label}` : '★ Favorito'
  }));
  renderSection(section, '📚 Sua coleção', 'Continue de onde parou', games, { moreHref: 'favoritos.html', variant: 'collection' });
}

function createCardMarkup(game, variant = 'default') {
  let year = game.released ? game.released.slice(0, 4) : '—';
  let rating = game.rating ? `${game.rating.toFixed(1)} ★` : 'Sem nota';
  if (variant === 'upcoming' && game.released) {
    const days = daysUntil(game.released);
    year = formatReleaseDate(game.released);
    rating = days <= 0 ? 'Chegou!' : days === 1 ? 'Amanhã' : `em ${days} dias`;
  }
  if (variant === 'collection') rating = escapeHtml(game.badge || '');
  const image = game.background_image || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=80';

  return `
    <article class="card" data-id="${game.id}" data-slug="${game.slug}">
      <div class="card-media">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(game.name)}" loading="lazy" />
      </div>
      <div class="card-body">
        <h3>${escapeHtml(game.name)}</h3>
        <div class="meta">
          <span>${year}</span>
          <span>${rating}</span>
        </div>
      </div>
    </article>
  `;
}

function renderSection(section, title, subtitle, games, { moreHref = 'categorias.html', variant = 'default' } = {}) {
  const safeGames = (games || []).filter(Boolean);
  const cardsMarkup = safeGames.length
    ? safeGames.map((game) => createCardMarkup(game, variant)).join('')
    : '<div class="empty-state">Nenhum jogo encontrado para esta seção.</div>';
  const plainTitle = title.replace(/^[^\p{L}\p{N}]+/u, '');

  section.innerHTML = `
    <div class="section-heading">
      <div>
        <h2>${title}</h2>
        <p>${subtitle}</p>
      </div>
      ${moreHref ? `<a class="section-more" href="${moreHref}">Ver mais<span class="sr-only"> de ${escapeHtml(plainTitle)}</span></a>` : ''}
    </div>
    <div class="carousel-shell">
      <button class="carousel-arrow carousel-arrow--prev" type="button" aria-label="Rolar ${escapeHtml(plainTitle)} para a esquerda" disabled>‹</button>
      <div class="carousel-row">
        ${cardsMarkup}
      </div>
      <button class="carousel-arrow carousel-arrow--next" type="button" aria-label="Rolar ${escapeHtml(plainTitle)} para a direita">›</button>
    </div>
  `;

  section.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => openGame(card.dataset.id, card.dataset.slug));
  });
  setupCarouselArrows(section);
}

function setupCarouselArrows(section) {
  const row = section.querySelector('.carousel-row');
  const prev = section.querySelector('.carousel-arrow--prev');
  const next = section.querySelector('.carousel-arrow--next');
  if (!row || !prev || !next) return;

  const update = () => {
    const maxScroll = row.scrollWidth - row.clientWidth;
    prev.disabled = row.scrollLeft <= 4;
    next.disabled = row.scrollLeft >= maxScroll - 4;
    section.querySelector('.carousel-shell').classList.toggle('is-static', maxScroll <= 4);
  };

  const scrollByPage = (direction) => {
    const reduced = window.GameVerseA11y?.isReducedMotion();
    row.scrollBy({ left: direction * row.clientWidth * 0.85, behavior: reduced ? 'auto' : 'smooth' });
  };

  prev.addEventListener('click', () => scrollByPage(-1));
  next.addEventListener('click', () => scrollByPage(1));
  row.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

const GENRE_SHORTCUTS = [
  { label: 'RPG', icon: '🧙', query: 'genero=role-playing-games-rpg' },
  { label: 'Ação', icon: '⚔️', query: 'genero=action' },
  { label: 'Aventura', icon: '🗺️', query: 'genero=adventure' },
  { label: 'Indie', icon: '🎮', query: 'genero=indie' },
  { label: 'Terror', icon: '👻', query: 'tag=horror' },
  { label: 'Estratégia', icon: '♟️', query: 'genero=strategy' },
  { label: 'Tiro', icon: '🎯', query: 'genero=shooter' },
  { label: 'Corrida', icon: '🏎️', query: 'genero=racing' },
  { label: 'Esportes', icon: '⚽', query: 'genero=sports' },
  { label: 'Puzzle', icon: '🧩', query: 'genero=puzzle' }
];

const PLATFORM_SHORTCUTS = [
  { label: 'PC', icon: '💻', query: 'plataforma=1' },
  { label: 'PlayStation', icon: '🎮', query: 'plataforma=2' },
  { label: 'Xbox', icon: '🟢', query: 'plataforma=3' },
  { label: 'Nintendo', icon: '🍄', query: 'plataforma=7' }
];

function renderShortcuts(section) {
  const tile = (item, kind) => `
    <a class="shortcut-tile shortcut-tile--${kind}" href="categorias.html?${item.query}">
      <span class="shortcut-icon" aria-hidden="true">${item.icon}</span>
      <span>${item.label}</span>
    </a>`;

  section.innerHTML = `
    <div class="section-heading">
      <div>
        <h2>🧭 Explore por estilo</h2>
        <p>Escolha um gênero ou plataforma e vá direto ao catálogo</p>
      </div>
      <div class="shortcut-actions">
        <a class="compare-btn" href="comparar.html">⚖️ Comparar jogos</a>
        <button class="surprise-btn" type="button" id="surpriseButton">
          <img src="assets/vee/transition/vee-jump.webp" alt="" aria-hidden="true" />
          <span>Me surpreenda</span>
        </button>
      </div>
    </div>
    <h3 class="shortcut-label">Gêneros</h3>
    <div class="shortcut-grid">${GENRE_SHORTCUTS.map((item) => tile(item, 'genre')).join('')}</div>
    <h3 class="shortcut-label">Plataformas</h3>
    <div class="shortcut-grid shortcut-grid--platforms">${PLATFORM_SHORTCUTS.map((item) => tile(item, 'platform')).join('')}</div>
    <p class="surprise-status" id="surpriseStatus" role="status" aria-live="polite"></p>
  `;

  section.querySelector('#surpriseButton').addEventListener('click', surpriseMe);
}

// Sorteia um jogo bem avaliado (Metacritic 80+) entre as primeiras páginas da RAWG.
async function surpriseMe(event) {
  const button = event.currentTarget;
  const status = document.getElementById('surpriseStatus');
  if (button.disabled) return;
  button.disabled = true;
  button.classList.add('is-rolling');
  status.textContent = 'A Vee está sorteando um jogo…';

  try {
    const page = 1 + Math.floor(Math.random() * 5);
    const games = await getGamesList({ metacritic: '80,100', ordering: '-added', page, page_size: 40 });
    if (!games.length) throw new Error('Nenhum jogo retornado');
    const game = games[Math.floor(Math.random() * games.length)];
    status.textContent = `Sorteado: ${game.name}!`;
    openGame(game.id, game.slug);
  } catch (error) {
    status.textContent = 'Não foi possível sortear agora. Tente de novo.';
  } finally {
    button.disabled = false;
    button.classList.remove('is-rolling');
  }
}

function isoDate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

async function fetchUpcomingGames() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const games = await fetchGames({ dates: `${isoDate(tomorrow)},${isoDate(nextYear)}`, ordering: '-added', page_size: 20 });
  return games
    .filter((game) => game.released && daysUntil(game.released) > 0)
    .sort((a, b) => a.released.localeCompare(b.released))
    .slice(0, 12);
}

function renderSkeleton(section, type = 'section') {
  if (type === 'hero') {
    section.innerHTML = '<div class="hero-skeleton"></div>';
    return;
  }

  section.innerHTML = `
    <div class="section-heading">
      <div class="skeleton-line skeleton-line--title"></div>
      <div class="skeleton-line skeleton-line--subtitle"></div>
    </div>
    <div class="carousel-row">
      ${Array.from({ length: 4 }, () => '<div class="skeleton-card"></div>').join('')}
    </div>
  `;
}

const HERO_INTERVAL_MS = 6000;
let heroSlides = [];
let heroPausedByUser = false;
let heroHovering = false;

function heroReducedMotion() {
  return window.GameVerseA11y ? window.GameVerseA11y.isReducedMotion() : false;
}

function heroShouldAutoplay() {
  return heroSlides.length > 1 && !heroPausedByUser && !heroHovering && !heroReducedMotion();
}

function stopHeroTimer() {
  if (heroIntervalId) {
    clearInterval(heroIntervalId);
    heroIntervalId = null;
  }
}

function syncHeroTimer() {
  stopHeroTimer();
  if (heroShouldAutoplay()) {
    heroIntervalId = setInterval(() => {
      heroCurrentIndex = (heroCurrentIndex + 1) % heroSlides.length;
      renderHero(heroSlides, heroCurrentIndex);
    }, HERO_INTERVAL_MS);
  }
  updateHeroToggle();
  restartHeroProgress();
}

function restartHeroProgress() {
  const bar = document.querySelector('.hero-progress span');
  if (!bar) return;
  const playing = Boolean(heroIntervalId);
  bar.parentElement.classList.toggle('is-paused', !playing);
  bar.style.animation = 'none';
  void bar.offsetWidth;
  bar.style.animation = '';
}

function updateHeroToggle() {
  const toggle = document.querySelector('.hero-toggle');
  if (!toggle) return;
  // Com "Reduzir animações" ligado não existe troca automática, então o botão some.
  toggle.hidden = heroReducedMotion();
  const playing = !heroPausedByUser;
  toggle.textContent = playing ? '❚❚' : '▶';
  toggle.setAttribute('aria-label', playing ? 'Pausar troca automática de destaques' : 'Retomar troca automática de destaques');
  toggle.setAttribute('aria-pressed', String(!playing));
}

function renderHero(slides, index = 0) {
  const hero = document.getElementById('hero');
  const slide = slides[index];

  if (!slide) {
    hero.innerHTML = '<div class="empty-state">Não foi possível carregar o destaque principal.</div>';
    return;
  }

  const image = slide.background_image || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1600&q=80';
  const description = slide.tagline || slide.description_raw?.slice(0, 140) || 'Uma experiência premium preparada para a sua próxima sessão.';
  const focusedControl = hero.contains(document.activeElement) ? document.activeElement.dataset.heroControl : null;

  hero.setAttribute('aria-roledescription', 'carrossel');
  hero.setAttribute('aria-label', 'Jogos em destaque');
  hero.innerHTML = `
    <article class="hero-slide" style="--hero-image: url('${escapeHtml(image)}')" aria-roledescription="slide" aria-label="${index + 1} de ${slides.length}">
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <span class="hero-badge">${escapeHtml(slide.tag || 'Destaque')}</span>
        <h1>${escapeHtml(slide.name)}</h1>
        <p>${escapeHtml(description)}</p>
        <div class="hero-actions">
          <a class="hero-btn" href="game.html?slug=${encodeURIComponent(slide.slug)}">Ver detalhes<span class="sr-only"> de ${escapeHtml(slide.name)}</span></a>
        </div>
      </div>
    </article>
    <div class="hero-progress" aria-hidden="true"><span></span></div>
    <div class="hero-dots">
      ${slides.length > 1 ? '<button class="hero-toggle" type="button" data-hero-control="toggle"></button>' : ''}
      ${slides.map((item, dotIndex) => `<button class="hero-dot ${dotIndex === index ? 'active' : ''}" data-index="${dotIndex}" data-hero-control="dot-${dotIndex}" type="button" aria-label="Mostrar destaque ${dotIndex + 1}: ${escapeHtml(item.name)}" ${dotIndex === index ? 'aria-current="true"' : ''}></button>`).join('')}
    </div>
  `;

  hero.querySelectorAll('.hero-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      heroCurrentIndex = Number(dot.dataset.index);
      renderHero(slides, heroCurrentIndex);
      syncHeroTimer();
    });
  });

  hero.querySelector('.hero-toggle')?.addEventListener('click', () => {
    heroPausedByUser = !heroPausedByUser;
    syncHeroTimer();
  });

  if (focusedControl) hero.querySelector(`[data-hero-control="${focusedControl}"]`)?.focus();
  updateHeroToggle();
  hero.querySelector('.hero-progress')?.classList.toggle('is-paused', !heroIntervalId);
}

function startHeroSlider(slides) {
  const hero = document.getElementById('hero');
  heroSlides = slides;
  heroCurrentIndex = 0;
  renderHero(slides, heroCurrentIndex);

  // Pausa enquanto o mouse ou o foco do teclado estiverem no destaque.
  hero.addEventListener('mouseenter', () => { heroHovering = true; syncHeroTimer(); });
  hero.addEventListener('mouseleave', () => { heroHovering = false; syncHeroTimer(); });
  hero.addEventListener('focusin', () => { heroHovering = true; syncHeroTimer(); });
  hero.addEventListener('focusout', (event) => {
    if (!hero.contains(event.relatedTarget)) {
      heroHovering = false;
      syncHeroTimer();
    }
  });
  document.addEventListener('gameverse:a11y-change', syncHeroTimer);
  syncHeroTimer();
}

async function fetchGames(params) {
  return getGamesList(params);
}

async function fetchDeveloperFavorites(names) {
  const results = await Promise.all(
    names.map(async (name) => {
      const [game] = await fetchGames({ search: name, page_size: 1 });
      return game || null;
    })
  );

  return results.filter(Boolean);
}

async function renderHome() {
  const hero = document.getElementById('hero');
  const launches = document.getElementById('launches');
  const trending = document.getElementById('trending');
  const developerFavorites = document.getElementById('developerFavorites');
  const topRated = document.getElementById('topRated');
  const rpg = document.getElementById('rpg');
  const action = document.getElementById('action');
  const adventure = document.getElementById('adventure');
  const indie = document.getElementById('indie');
  const shortcuts = document.getElementById('shortcuts');
  const upcoming = document.getElementById('upcoming');

  renderShortcuts(shortcuts);
  renderCollectionRow(document.getElementById('collectionRow'));
  renderSkeleton(hero, 'hero');
  renderSkeleton(upcoming);
  renderSkeleton(launches);
  renderSkeleton(trending);
  renderSkeleton(topRated);
  renderSkeleton(developerFavorites);
  renderSkeleton(rpg);
  renderSkeleton(action);
  renderSkeleton(adventure);
  renderSkeleton(indie);

  try {
    const [heroGames, launchGames, upcomingGames, trendingGames, topRatedGames, developerGames, rpgGames, actionGames, adventureGames, indieGames] = await Promise.all([
      Promise.all(HERO_SLIDES.map(async (slide) => getGame(slide.slug))),
      fetchGames({ dates: '2024-01-01,2026-12-31', ordering: '-added', page_size: 12 }),
      fetchUpcomingGames(),
      fetchGames({ ordering: '-added', page_size: 12 }),
      fetchGames({ ordering: '-rating', page_size: 12 }),
      fetchDeveloperFavorites(FAVORITE_NAMES),
      fetchGames({ genres: '5', ordering: '-rating', page_size: 8 }),
      fetchGames({ genres: '4', ordering: '-rating', page_size: 8 }),
      fetchGames({ genres: '3', ordering: '-rating', page_size: 8 }),
      fetchGames({ genres: '51', ordering: '-rating', page_size: 8 })
    ]);

    startHeroSlider(heroGames.map((game, index) => ({ ...game, tag: HERO_SLIDES[index].tag })));

    renderSection(launches, '🔥 Lançamentos relevantes', 'Novidades recentes com maior impacto', sortByRelevance(launchGames).slice(0, 12), { moreHref: 'categorias.html?ordem=-released' });
    renderSection(upcoming, '📅 Em breve', 'Os próximos lançamentos mais aguardados', upcomingGames, { moreHref: '', variant: 'upcoming' });
    renderSection(trending, '⭐ Em Alta', 'Jogos mais populares da semana', trendingGames, { moreHref: 'categorias.html?ordem=-added' });
    renderSection(topRated, '🏆 Mais bem avaliados', 'Qualidade e popularidade combinadas', sortByRelevance(topRatedGames).slice(0, 12), { moreHref: 'categorias.html?ordem=-rating' });
    renderSection(developerFavorites, '❤️ Favoritos do Desenvolvedor', 'Uma seleção pensada para impressionar', developerGames, { moreHref: '' });
    renderSection(rpg, '🧙 RPG / JRPG', 'Histórias épicas e mundos ricos', rpgGames, { moreHref: 'categorias.html?genero=role-playing-games-rpg' });
    renderSection(action, '⚔️ Ação', 'Combate, ritmo e impacto', actionGames, { moreHref: 'categorias.html?genero=action' });
    renderSection(adventure, '🗺️ Aventura', 'Descobertas e grandes jornadas', adventureGames, { moreHref: 'categorias.html?genero=adventure' });
    renderSection(indie, '🎮 Indies', 'Experiências criativas e originais', indieGames, { moreHref: 'categorias.html?genero=indie' });
  } catch (error) {
    hero.innerHTML = '<div class="empty-state">Não foi possível carregar o destaque.</div>';
    launches.innerHTML = '<div class="empty-state">Erro ao carregar os lançamentos.</div>';
    upcoming.innerHTML = '<div class="empty-state">Erro ao carregar os próximos lançamentos.</div>';
    trending.innerHTML = '<div class="empty-state">Erro ao carregar os destaques.</div>';
    topRated.innerHTML = '<div class="empty-state">Não foi possível carregar esta seção. <button class="btn btn-secondary" onclick="location.reload()">Tentar novamente</button></div>';
    developerFavorites.innerHTML = '<div class="empty-state">Erro ao carregar os favoritos do desenvolvedor.</div>';
    rpg.innerHTML = '<div class="empty-state">Erro ao carregar os RPGs.</div>';
    action.innerHTML = '<div class="empty-state">Erro ao carregar as seções de ação.</div>';
    adventure.innerHTML = '<div class="empty-state">Erro ao carregar as aventuras.</div>';
    indie.innerHTML = '<div class="empty-state">Erro ao carregar os indies.</div>';
  }
}

async function initSearch() {
  const searchInput = document.getElementById('searchInput');
  const suggestionsBox = document.getElementById('searchSuggestions');

  let timeoutId;

  const renderSuggestions = async (value) => {
    const results = await getGamesList({ search: value, page_size: 6 });
    suggestionsBox.innerHTML = results.map((game) => `
      <button class="suggestion-item" data-slug="${escapeHtml(game.slug)}" type="button">
        <span>${escapeHtml(game.name)}</span>
      </button>
    `).join('');
    suggestionsBox.classList.toggle('visible', Boolean(results.length));
  };

  searchInput.addEventListener('input', () => {
    clearTimeout(timeoutId);
    const value = searchInput.value.trim();

    if (!value) {
      suggestionsBox.innerHTML = '';
      suggestionsBox.classList.remove('visible');
      return;
    }

    timeoutId = setTimeout(() => {
      renderSuggestions(value);
    }, 300);
  });

  searchInput.addEventListener('focus', () => {
    const value = searchInput.value.trim();
    if (value) {
      renderSuggestions(value);
    }
  });

  document.addEventListener('click', (event) => {
    if (!searchInput.contains(event.target) && !suggestionsBox.contains(event.target)) {
      suggestionsBox.classList.remove('visible');
    }
  });

  suggestionsBox.addEventListener('click', (event) => {
    const target = event.target.closest('.suggestion-item');
    if (!target) return;
    navigateWithVee(`game.html?slug=${encodeURIComponent(target.dataset.slug)}`);
  });
}

renderHome();
initSearch();
