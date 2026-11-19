import { getGamesList, getGamesPage } from './services/rawgService.js';
import { escapeHtml, sortByRelevance, genreLine } from './utils.js';
import { navigateWithVee } from './motion.js';

const PAGE_SIZE = 20;

// Os filtros ficam no endereço da página (ex.: categorias.html?genero=action&plataforma=2),
// assim os atalhos da Home funcionam e o botão "voltar" do navegador mantém a busca.
const STYLES = [
  { key: 'genero', value: 'role-playing-games-rpg', label: 'RPG', api: ['genres', 'role-playing-games-rpg'] },
  { key: 'genero', value: 'action', label: 'Ação', api: ['genres', 'action'] },
  { key: 'genero', value: 'adventure', label: 'Aventura', api: ['genres', 'adventure'] },
  { key: 'genero', value: 'indie', label: 'Indie', api: ['genres', 'indie'] },
  // Terror é uma tag na RAWG, não um gênero.
  { key: 'tag', value: 'horror', label: 'Terror', api: ['tags', 'horror'] },
  { key: 'genero', value: 'strategy', label: 'Estratégia', api: ['genres', 'strategy'] },
  { key: 'genero', value: 'shooter', label: 'Tiro', api: ['genres', 'shooter'] },
  { key: 'genero', value: 'racing', label: 'Corrida', api: ['genres', 'racing'] },
  { key: 'genero', value: 'sports', label: 'Esportes', api: ['genres', 'sports'] },
  { key: 'genero', value: 'puzzle', label: 'Puzzle', api: ['genres', 'puzzle'] }
];

// Marcas de console usam parent_platforms da RAWG.
const PLATFORMS = [
  { value: '1', label: 'PC' },
  { value: '2', label: 'PlayStation' },
  { value: '3', label: 'Xbox' },
  { value: '7', label: 'Nintendo' }
];

const ERAS = [
  { value: '1990', label: 'Anos 90', dates: '1990-01-01,1999-12-31' },
  { value: '2000', label: 'Anos 2000', dates: '2000-01-01,2009-12-31' },
  { value: '2010', label: 'Anos 2010', dates: '2010-01-01,2019-12-31' },
  { value: '2020', label: 'Anos 2020', dates: '2020-01-01,2029-12-31' }
];

const SCORES = [
  { value: '70', label: '70+' },
  { value: '80', label: '80+' },
  { value: '90', label: '90+' }
];

const ORDERS = [
  { value: 'relevance', label: 'Relevância' },
  { value: '-added', label: 'Popularidade' },
  { value: '-rating', label: 'Mais bem avaliados' },
  { value: '-metacritic', label: 'Maior nota Metacritic' },
  { value: '-released', label: 'Mais recentes' },
  { value: 'name', label: 'Nome (A–Z)' }
];

let state = readStateFromUrl();
let requestCounter = 0;

function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const pick = (name, allowed) => (allowed.includes(params.get(name)) ? params.get(name) : '');
  const genero = pick('genero', STYLES.filter((s) => s.key === 'genero').map((s) => s.value));
  const tag = genero ? '' : pick('tag', STYLES.filter((s) => s.key === 'tag').map((s) => s.value));
  const page = Number.parseInt(params.get('pagina'), 10);

  return {
    genero,
    tag,
    plataforma: pick('plataforma', PLATFORMS.map((p) => p.value)),
    epoca: pick('epoca', ERAS.map((e) => e.value)),
    nota: pick('nota', SCORES.map((s) => s.value)),
    ordem: pick('ordem', ORDERS.map((o) => o.value)) || 'relevance',
    busca: (params.get('busca') || '').trim().slice(0, 80),
    pagina: Number.isSafeInteger(page) && page > 0 ? page : 1
  };
}

function writeStateToUrl({ replace = false } = {}) {
  const params = new URLSearchParams();
  ['busca', 'genero', 'tag', 'plataforma', 'epoca', 'nota'].forEach((key) => {
    if (state[key]) params.set(key, state[key]);
  });
  if (state.ordem !== 'relevance') params.set('ordem', state.ordem);
  if (state.pagina > 1) params.set('pagina', String(state.pagina));
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ''}`;
  window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
}

function activeStyle() {
  return STYLES.find((style) => (style.key === 'genero' ? state.genero === style.value : state.tag === style.value)) || null;
}

function buildApiParams() {
  const params = { page: state.pagina, page_size: PAGE_SIZE };
  params.ordering = state.ordem === 'relevance' ? '-added' : state.ordem;

  const style = activeStyle();
  if (style) params[style.api[0]] = style.api[1];
  if (state.plataforma) params.parent_platforms = state.plataforma;
  if (state.nota) params.metacritic = `${state.nota},100`;
  if (state.busca) params.search = state.busca;

  const era = ERAS.find((item) => item.value === state.epoca);
  if (era) {
    params.dates = era.dates;
  } else if (state.ordem === '-released') {
    // Sem isso, "Mais recentes" mostraria jogos que ainda nem lançaram.
    params.dates = `1970-01-01,${todayIso()}`;
  }
  return params;
}

function openGame(id, slug) {
  const target = slug ? `game.html?slug=${encodeURIComponent(slug)}` : `game.html?id=${id}`;
  navigateWithVee(target);
}

function createCatalogCard(game) {
  const year = game.released ? game.released.slice(0, 4) : '—';
  const rating = game.rating ? `${game.rating.toFixed(1)} ★` : 'Sem nota';
  const playtime = Number(game.playtime) > 0 ? `<span class="card-playtime" title="Tempo médio de jogo">⏱ ${Number(game.playtime)}h</span>` : '';
  const metacritic = Number(game.metacritic) > 0 ? `<span class="card-metacritic" title="Nota Metacritic">${Number(game.metacritic)}</span>` : '';
  return `
    <article class="card catalog-card" data-id="${game.id}" data-slug="${escapeHtml(game.slug || '')}">
      <div class="card-media">
        <img src="${escapeHtml(game.background_image)}" alt="${escapeHtml(game.name)}" loading="lazy" />
        ${metacritic}
      </div>
      <div class="card-body">
        <h3>${escapeHtml(game.name)}</h3>
        ${genreLine(game) ? `<p class="card-genres">${escapeHtml(genreLine(game))}</p>` : ''}
        <div class="meta">
          <span>${year}</span>
          ${playtime}
          <span>${rating}</span>
        </div>
      </div>
    </article>
  `;
}

function chipGroup(label, groupKey, options, isActive) {
  return `
    <div class="filter-group" role="group" aria-label="${label}">
      <span class="filter-group-label">${label}</span>
      <div class="filter-row">
        <button type="button" class="filter-chip ${options.every((o) => !isActive(o)) ? 'active' : ''}" data-group="${groupKey}" data-value="" aria-pressed="${options.every((o) => !isActive(o))}">Todos</button>
        ${options.map((option) => `
          <button type="button" class="filter-chip ${isActive(option) ? 'active' : ''}" data-group="${groupKey}" data-value="${option.value}" ${option.key ? `data-key="${option.key}"` : ''} aria-pressed="${isActive(option)}">${option.label}</button>
        `).join('')}
      </div>
    </div>`;
}

function renderFilters() {
  const filters = document.getElementById('filters');
  filters.innerHTML = [
    chipGroup('Estilo', 'style', STYLES, (o) => activeStyle() === o),
    chipGroup('Plataforma', 'plataforma', PLATFORMS, (o) => state.plataforma === o.value),
    chipGroup('Época', 'epoca', ERAS, (o) => state.epoca === o.value),
    chipGroup('Nota Metacritic', 'nota', SCORES, (o) => state.nota === o.value)
  ].join('');
}

function setFilter(group, value, key) {
  if (group === 'style') {
    state.genero = key === 'genero' ? value : '';
    state.tag = key === 'tag' ? value : '';
  } else {
    state[group] = value;
  }
  state.pagina = 1;
  update();
}

function activeFilterTags() {
  const tags = [];
  if (state.busca) tags.push({ label: `“${state.busca}”`, clear: () => { state.busca = ''; } });
  const style = activeStyle();
  if (style) tags.push({ label: style.label, clear: () => { state.genero = ''; state.tag = ''; } });
  const platform = PLATFORMS.find((p) => p.value === state.plataforma);
  if (platform) tags.push({ label: platform.label, clear: () => { state.plataforma = ''; } });
  const era = ERAS.find((e) => e.value === state.epoca);
  if (era) tags.push({ label: era.label, clear: () => { state.epoca = ''; } });
  const score = SCORES.find((s) => s.value === state.nota);
  if (score) tags.push({ label: `Metacritic ${score.label}`, clear: () => { state.nota = ''; } });
  return tags;
}

function renderSummary(count, loading = false) {
  const summary = document.getElementById('catalogSummary');
  const tags = activeFilterTags();
  const countText = loading
    ? 'Buscando jogos…'
    : `${count.toLocaleString('pt-BR')} ${count === 1 ? 'jogo encontrado' : 'jogos encontrados'}`;

  summary.innerHTML = `
    <strong class="catalog-count" aria-live="polite">${countText}</strong>
    ${tags.map((tag, index) => `
      <button type="button" class="active-filter" data-remove="${index}">
        ${escapeHtml(tag.label)} <span aria-hidden="true">✕</span><span class="sr-only">, remover filtro</span>
      </button>`).join('')}
    ${tags.length ? '<button type="button" class="clear-filters" data-clear-all>Limpar filtros</button>' : ''}
  `;

  summary.querySelectorAll('[data-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      tags[Number(button.dataset.remove)].clear();
      state.pagina = 1;
      update();
    });
  });
  summary.querySelector('[data-clear-all]')?.addEventListener('click', () => {
    state = { ...state, busca: '', genero: '', tag: '', plataforma: '', epoca: '', nota: '', pagina: 1 };
    document.getElementById('catalogQuery').value = '';
    update();
  });
}

function renderPagination(totalPages) {
  const pagination = document.getElementById('pagination');
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }
  pagination.innerHTML = `
    <button type="button" class="pagination-btn" data-page="${state.pagina - 1}" ${state.pagina <= 1 ? 'disabled' : ''}>‹ Anterior</button>
    <span>Página ${state.pagina.toLocaleString('pt-BR')} de ${totalPages.toLocaleString('pt-BR')}</span>
    <button type="button" class="pagination-btn" data-page="${state.pagina + 1}" ${state.pagina >= totalPages ? 'disabled' : ''}>Próxima ›</button>
  `;
  pagination.querySelectorAll('.pagination-btn:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => {
      state.pagina = Number(button.dataset.page);
      update({ focusResults: true });
    });
  });
}

async function loadCatalog({ focusResults = false } = {}) {
  const resultsContainer = document.getElementById('catalogResults');
  const requestId = ++requestCounter;
  resultsContainer.setAttribute('aria-busy', 'true');
  resultsContainer.innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton-card"></div>').join('');
  renderSummary(0, true);

  let page;
  try {
    page = await getGamesPage(buildApiParams());
  } catch (error) {
    if (requestId !== requestCounter) return;
    console.error('Falha ao carregar o catálogo.', error);
    resultsContainer.removeAttribute('aria-busy');
    resultsContainer.innerHTML = '<div class="empty-state">Não foi possível carregar o catálogo agora. <button type="button" class="pagination-btn" id="retryCatalog">Tentar novamente</button></div>';
    document.getElementById('pagination').innerHTML = '';
    document.getElementById('catalogSummary').innerHTML = '';
    document.getElementById('retryCatalog')?.addEventListener('click', () => loadCatalog());
    return;
  }
  if (requestId !== requestCounter) return; // uma busca mais nova já começou

  const results = state.ordem === 'relevance' ? sortByRelevance(page.results) : page.results;
  // A RAWG não entrega páginas muito distantes; limitamos para não oferecer páginas vazias.
  const totalPages = Math.min(Math.ceil(page.count / PAGE_SIZE), 500);

  resultsContainer.removeAttribute('aria-busy');
  resultsContainer.innerHTML = results.length
    ? results.map(createCatalogCard).join('')
    : `<div class="empty-state vee-empty-state">
        <img src="assets/vee/states/vee-search.webp" alt="" />
        <strong>Nenhum jogo encontrado com esses filtros.</strong>
        <span>Tente remover algum filtro ou mudar a busca.</span>
      </div>`;
  resultsContainer.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => openGame(card.dataset.id, card.dataset.slug));
  });

  renderSummary(page.count);
  renderPagination(totalPages);

  if (focusResults) {
    const heading = document.getElementById('catalogTitle');
    heading.scrollIntoView({ block: 'start', behavior: window.GameVerseA11y?.isReducedMotion() ? 'auto' : 'smooth' });
    heading.focus({ preventScroll: true });
  }
}

function update({ focusResults = false, pushHistory = true } = {}) {
  if (pushHistory) writeStateToUrl();
  renderFilters();
  document.getElementById('ordering').value = state.ordem;
  loadCatalog({ focusResults });
}

function setupControls() {
  const ordering = document.getElementById('ordering');
  ordering.innerHTML = ORDERS.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
  ordering.value = state.ordem;
  ordering.addEventListener('change', () => {
    state.ordem = ordering.value;
    state.pagina = 1;
    update();
  });

  document.getElementById('filters').addEventListener('click', (event) => {
    const chip = event.target.closest('.filter-chip');
    if (!chip) return;
    setFilter(chip.dataset.group, chip.dataset.value, chip.dataset.key || '');
  });

  const form = document.getElementById('catalogSearch');
  const queryInput = document.getElementById('catalogQuery');
  queryInput.value = state.busca;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    state.busca = queryInput.value.trim().slice(0, 80);
    state.pagina = 1;
    update();
  });

  window.addEventListener('popstate', () => {
    state = readStateFromUrl();
    queryInput.value = state.busca;
    update({ pushHistory: false });
  });
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
    timeoutId = setTimeout(() => renderSuggestions(value), 300);
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

setupControls();
initSearch();
update({ pushHistory: false });
writeStateToUrl({ replace: true });
