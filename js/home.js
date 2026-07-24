import { getGame, getGamesList } from './services/rawgService.js';

const HERO_SLIDES = [
  { slug: 'persona-5-royal', tag: 'Nova coleção' },
  { slug: 'metaphor-refantazio', tag: 'Pré-lançamento' },
  { slug: 'the-legend-of-zelda-breath-of-the-wild', tag: 'Clássico' },
  { slug: 'resident-evil-4-remake', tag: 'Terror premium' },
  { slug: 'super-mario-odyssey', tag: 'Família' }
];

let heroIntervalId = null;
let heroCurrentIndex = 0;

function openGame(id, slug) {
  const target = slug ? `game.html?slug=${encodeURIComponent(slug)}` : `game.html?id=${id}`;
  window.location.href = target;
}

function createCardMarkup(game) {
  const year = game.released ? game.released.slice(0, 4) : '—';
  const rating = game.rating ? `${game.rating.toFixed(1)} ★` : 'Sem nota';
  const image = game.background_image || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=80';

  return `
    <article class="card" data-id="${game.id}" data-slug="${game.slug}">
      <div class="card-media">
        <img src="${image}" alt="${game.name}" loading="lazy" />
      </div>
      <div class="card-body">
        <h3>${game.name}</h3>
        <div class="meta">
          <span>${year}</span>
          <span>${rating}</span>
        </div>
      </div>
    </article>
  `;
}

function renderSection(section, title, subtitle, games) {
  const safeGames = (games || []).filter(Boolean);
  const cardsMarkup = safeGames.length
    ? safeGames.map((game) => createCardMarkup(game)).join('')
    : '<div class="empty-state">Nenhum jogo encontrado para esta seção.</div>';

  section.innerHTML = `
    <div class="section-heading">
      <div>
        <h2>${title}</h2>
        <p>${subtitle}</p>
      </div>
    </div>
    <div class="carousel-row">
      ${cardsMarkup}
    </div>
  `;

  section.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => openGame(card.dataset.id, card.dataset.slug));
  });
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

function renderHero(slides, index = 0) {
  const hero = document.getElementById('hero');
  const slide = slides[index];

  if (!slide) {
    hero.innerHTML = '<div class="empty-state">Não foi possível carregar o destaque principal.</div>';
    return;
  }

  hero.innerHTML = `
    <article class="hero-slide" style="--hero-image: url('${slide.background_image || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1600&q=80'}')">
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <span class="hero-badge">${slide.tag || 'Destaque'}</span>
        <h1>${slide.name}</h1>
        <p>${slide.tagline || slide.description_raw?.slice(0, 140) || 'Uma experiência premium preparada para a sua próxima sessão.'}</p>
        <div class="hero-actions">
          <a class="hero-btn" href="game.html?slug=${encodeURIComponent(slide.slug)}">Ver detalhes</a>
        </div>
      </div>
    </article>
    <div class="hero-dots">
      ${slides.map((_, dotIndex) => `<button class="hero-dot ${dotIndex === index ? 'active' : ''}" data-index="${dotIndex}" type="button"></button>`).join('')}
    </div>
  `;

  hero.querySelectorAll('.hero-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      heroCurrentIndex = Number(dot.dataset.index);
      renderHero(slides, heroCurrentIndex);
    });
  });
}

function startHeroSlider(slides) {
  if (heroIntervalId) {
    clearInterval(heroIntervalId);
  }

  heroCurrentIndex = 0;
  renderHero(slides, heroCurrentIndex);

  heroIntervalId = setInterval(() => {
    heroCurrentIndex = (heroCurrentIndex + 1) % slides.length;
    renderHero(slides, heroCurrentIndex);
  }, 6000);
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
  const rpg = document.getElementById('rpg');
  const action = document.getElementById('action');
  const indie = document.getElementById('indie');

  renderSkeleton(hero, 'hero');
  renderSkeleton(launches);
  renderSkeleton(trending);
  renderSkeleton(developerFavorites);
  renderSkeleton(rpg);
  renderSkeleton(action);
  renderSkeleton(indie);

  try {
    const [heroGames, launchGames, trendingGames, developerGames, rpgGames, actionGames, indieGames] = await Promise.all([
      Promise.all(HERO_SLIDES.map(async (slide) => getGame(slide.slug))),
      fetchGames({ dates: '2024-01-01,2026-12-31', ordering: '-released', page_size: 8 }),
      fetchGames({ ordering: '-rating', page_size: 8 }),
      fetchDeveloperFavorites([
        'Persona 5 Royal',
        'Metaphor: ReFantazio',
        'The Legend of Zelda: Breath of the Wild',
        'Persona 4 Golden',
        'Final Fantasy VII Remake',
        'Resident Evil 4 Remake',
        'Super Mario Odyssey',
        'Hollow Knight: Silksong',
        'Persona 3 Reload',
        'Pokémon HeartGold',
        'Pokémon Legends Z-A',
        'Pokémon Legends Arceus',
        'Super Mario World',
        'Yakuza: Like a Dragon',
        'Super Mario 64',
        'Super Mario Galaxy',
        'Pokémon Black 2',
        'Zelda Ocarina of Time',
        'Hollow Knight',
        'Resident Evil 2 Remake'
      ]),
      fetchGames({ genres: '5', ordering: '-rating', page_size: 8 }),
      fetchGames({ genres: '4', ordering: '-rating', page_size: 8 }),
      fetchGames({ genres: '51', ordering: '-rating', page_size: 8 })
    ]);

    startHeroSlider(heroGames.map((game, index) => ({ ...game, tag: HERO_SLIDES[index].tag })));

    renderSection(launches, '🔥 Lançamentos', 'Novidades recentes da biblioteca', launchGames);
    renderSection(trending, '⭐ Em Alta', 'Jogos mais populares da semana', trendingGames);
    renderSection(developerFavorites, '❤️ Favoritos do Desenvolvedor', 'Uma seleção pensada para impressionar', developerGames);
    renderSection(rpg, '🧙 RPG / JRPG', 'Histórias épicas e mundos ricos', rpgGames);
    renderSection(action, '⚔️ Ação', 'Combate, ritmo e impacto', actionGames);
    renderSection(indie, '🎮 Indies', 'Experiências criativas e originais', indieGames);
  } catch (error) {
    hero.innerHTML = '<div class="empty-state">Não foi possível carregar o destaque.</div>';
    launches.innerHTML = '<div class="empty-state">Erro ao carregar os lançamentos.</div>';
    trending.innerHTML = '<div class="empty-state">Erro ao carregar os destaques.</div>';
    developerFavorites.innerHTML = '<div class="empty-state">Erro ao carregar os favoritos do desenvolvedor.</div>';
    rpg.innerHTML = '<div class="empty-state">Erro ao carregar os RPGs.</div>';
    action.innerHTML = '<div class="empty-state">Erro ao carregar as seções de ação.</div>';
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
      <button class="suggestion-item" data-slug="${game.slug}" type="button">
        <span>${game.name}</span>
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
    window.location.href = `game.html?slug=${encodeURIComponent(target.dataset.slug)}`;
  });
}

renderHome();
initSearch();
