import { getGamesList } from './services/rawgService.js';
import { escapeHtml, sortByRelevance } from './utils.js';

const FILTERS = [
  { label: 'Todos', key: 'genres', value: '' },
  { label: 'RPG/JRPG', key: 'genres', value: '5' },
  { label: 'Ação', key: 'genres', value: '4' },
  { label: 'Indies', key: 'genres', value: '51' },
  { label: 'Aventura', key: 'genres', value: '7' },
  { label: 'Terror', key: 'genres', value: '40' },
  { label: 'Nintendo', key: 'platforms', value: '7' },
  { label: 'PlayStation', key: 'platforms', value: '2' },
  { label: 'PC', key: 'platforms', value: '1' }
];

let currentPage = 1;
let currentGenre = '';
let currentFilterKey = 'genres';
let currentOrdering = 'relevance';

function openGame(id, slug) {
  const target = slug ? `game.html?slug=${encodeURIComponent(slug)}` : `game.html?id=${id}`;
  window.location.href = target;
}

function createCatalogCard(game) {
  const year = game.released ? game.released.slice(0, 4) : '—';
  const rating = game.rating ? `${game.rating.toFixed(1)} ★` : 'Sem nota';
  return `
    <article class="card catalog-card" data-id="${game.id}" data-slug="${game.slug}">
      <div class="card-media">
        <img src="${game.background_image || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=80'}" alt="${game.name}" loading="lazy" />
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

async function loadCatalog() {
  const resultsContainer = document.getElementById('catalogResults');
  const pagination = document.getElementById('pagination');
  resultsContainer.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';

  try {
    const ordering = currentOrdering === 'relevance' ? '-added' : currentOrdering;
    const params = { ordering, page: currentPage, page_size: 12 };
    if (currentGenre) params[currentFilterKey] = currentGenre;
    const results = await getGamesList(params);
    const orderedResults = currentOrdering === 'relevance' ? sortByRelevance(results) : results;
    resultsContainer.innerHTML = orderedResults.length ? orderedResults.map(createCatalogCard).join('') : '<div class="empty-state">Nenhum resultado encontrado.</div>';
    pagination.innerHTML = `
      <button class="pagination-btn" data-page="${Math.max(1, currentPage - 1)}">Anterior</button>
      <span>Página ${currentPage}</span>
      <button class="pagination-btn" data-page="${currentPage + 1}">Próxima</button>
    `;
  } catch (error) {
    console.error('Falha ao carregar o catálogo.', error);
    resultsContainer.innerHTML = '<div class="empty-state">Não foi possível carregar esta seção. <button class="btn btn-secondary" id="retryCatalog">Tentar novamente</button></div>';
    pagination.innerHTML = '';
    document.getElementById('retryCatalog')?.addEventListener('click', loadCatalog);
    return;
  }

  resultsContainer.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => openGame(card.dataset.id, card.dataset.slug));
  });

  pagination.querySelectorAll('.pagination-btn').forEach((button) => {
    button.addEventListener('click', () => {
      currentPage = Number(button.dataset.page);
      loadCatalog();
    });
  });
}

function renderFilters() {
  const filters = document.getElementById('filters');
  filters.innerHTML = FILTERS.map((filter) => `
    <button class="filter-chip ${filter.value === currentGenre && filter.key === currentFilterKey ? 'active' : ''}" data-key="${filter.key}" data-value="${filter.value}">${filter.label}</button>
  `).join('');

  filters.querySelectorAll('.filter-chip').forEach((button) => {
    button.addEventListener('click', () => {
      currentGenre = button.dataset.value;
      currentFilterKey = button.dataset.key;
      currentPage = 1;
      renderFilters();
      loadCatalog();
    });
  });
}

function renderOrdering() {
  const ordering = document.getElementById('ordering');
  if (!ordering) return;
  ordering.value = currentOrdering;
  ordering.addEventListener('change', () => {
    currentOrdering = ordering.value;
    currentPage = 1;
    loadCatalog();
  });
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
    window.location.href = `game.html?slug=${encodeURIComponent(target.dataset.slug)}`;
  });
}

renderFilters();
renderOrdering();
initSearch();
loadCatalog();
