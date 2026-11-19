import { getGame } from './services/rawgService.js';
import { navigateWithVee } from './motion.js';
import { readFavorites, readRating, writePersonalData } from './services/gameStorage.js';
import { GAME_STATUSES, readCollection, gameSnapshot, statusInfo } from './services/collectionStorage.js';
import { escapeHtml } from './utils.js';

const TABS = [
  { id: 'all', label: 'Todos', icon: '📚' },
  { id: 'favorite', label: 'Favoritos', icon: '⭐' },
  ...GAME_STATUSES.map((status) => ({ id: status.id, label: status.label, icon: status.icon }))
];

const EMPTY_MESSAGES = {
  all: ['Sua coleção está vazia.', 'Abra um jogo e marque como “Quero jogar”, “Jogando”, “Zerado” ou favorite.'],
  favorite: ['Nenhum favorito ainda.', 'Use o botão ★ Favoritar na página de um jogo.'],
  want: ['Nada na lista de desejos.', 'Marque “Quero jogar” nos jogos que chamaram sua atenção.'],
  playing: ['Você não está jogando nada agora?', 'Marque “Jogando” no jogo da vez.'],
  completed: ['Nenhum jogo zerado ainda.', 'Quando terminar um jogo, marque “Zerado” para comemorar.'],
  dropped: ['Nenhum jogo abandonado.', 'Isso é ótimo! Ou você é muito persistente.']
};

const params = new URLSearchParams(window.location.search);
let activeTab = TABS.some((tab) => tab.id === params.get('aba')) ? params.get('aba') : 'all';
let entries = [];

function openGame(id, slug) {
  const target = slug ? `game.html?slug=${encodeURIComponent(slug)}` : `game.html?id=${id}`;
  navigateWithVee(target);
}

// Favoritos antigos guardavam só o id; buscamos nome/imagem uma vez e atualizamos o registro.
async function upgradeLegacyFavorites(favorites) {
  const legacy = favorites.filter((item) => !item.name);
  if (!legacy.length) return { favorites, failed: 0 };

  const results = await Promise.allSettled(legacy.map((item) => getGame(item.id)));
  const upgraded = new Map();
  results.forEach((result) => {
    if (result.status === 'fulfilled') upgraded.set(result.value.id, gameSnapshot(result.value));
  });

  const next = favorites.map((item) => upgraded.get(item.id) || item);
  if (upgraded.size) writePersonalData('gameverse-favorites', JSON.stringify(next));
  return { favorites: next, failed: legacy.length - upgraded.size };
}

function buildEntries(favorites, collection) {
  const map = new Map();
  favorites.forEach((item) => {
    if (!item.name) return;
    map.set(item.id, { ...item, favorite: true, status: null, updatedAt: '' });
  });
  Object.values(collection).forEach((item) => {
    const existing = map.get(item.id);
    map.set(item.id, { ...existing, ...item, favorite: Boolean(existing?.favorite) });
  });
  return [...map.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

function filteredEntries() {
  if (activeTab === 'all') return entries;
  if (activeTab === 'favorite') return entries.filter((entry) => entry.favorite);
  return entries.filter((entry) => entry.status === activeTab);
}

function computeStats() {
  const ratings = entries.map((entry) => readRating(entry.id)).filter((r) => r.available && r.value > 0).map((r) => r.value);
  const average = ratings.length ? (ratings.reduce((sum, value) => sum + value, 0) / ratings.length) : 0;

  const genreCount = new Map();
  entries.forEach((entry) => (entry.genres || []).forEach((genre) => genreCount.set(genre, (genreCount.get(genre) || 0) + 1)));
  const topGenre = [...genreCount.entries()].sort((a, b) => b[1] - a[1])[0];

  const finished = entries.filter((entry) => entry.status === 'completed').length;
  const started = entries.filter((entry) => ['playing', 'completed', 'dropped'].includes(entry.status)).length;

  return [
    { label: 'Jogos na coleção', value: entries.length },
    { label: 'Zerados', value: finished, hint: started ? `${Math.round((finished / started) * 100)}% dos que você começou` : '' },
    { label: 'Jogando agora', value: entries.filter((entry) => entry.status === 'playing').length },
    { label: 'Sua nota média', value: ratings.length ? `${average.toFixed(1)} ★` : '—', hint: ratings.length ? `${ratings.length} ${ratings.length === 1 ? 'jogo avaliado' : 'jogos avaliados'}` : 'Avalie jogos com as estrelas' },
    { label: 'Gênero mais presente', value: topGenre ? topGenre[0] : '—' }
  ];
}

function renderStats() {
  document.getElementById('collectionStats').innerHTML = computeStats().map((stat) => `
    <div class="stat-card">
      <span class="stat-label">${stat.label}</span>
      <strong class="stat-value">${escapeHtml(String(stat.value))}</strong>
      ${stat.hint ? `<span class="stat-hint">${escapeHtml(stat.hint)}</span>` : ''}
    </div>`).join('');
}

function renderTabs() {
  const counts = {
    all: entries.length,
    favorite: entries.filter((entry) => entry.favorite).length
  };
  GAME_STATUSES.forEach((status) => {
    counts[status.id] = entries.filter((entry) => entry.status === status.id).length;
  });

  const tabs = document.getElementById('collectionTabs');
  tabs.innerHTML = TABS.map((tab) => `
    <button type="button" class="filter-chip ${tab.id === activeTab ? 'active' : ''}" data-tab="${tab.id}" aria-pressed="${tab.id === activeTab}">
      <span aria-hidden="true">${tab.icon}</span> ${tab.label} <span class="tab-count">${counts[tab.id]}</span>
    </button>`).join('');
}

function cardMarkup(entry) {
  const status = statusInfo(entry.status);
  return `
    <article class="card collection-card" data-id="${entry.id}" data-slug="${escapeHtml(entry.slug || '')}">
      <div class="card-media">
        <img src="${escapeHtml(entry.image || 'assets/brand/vee-hero.webp')}" alt="${escapeHtml(entry.name)}" loading="lazy" />
        <div class="collection-badges">
          ${status ? `<span class="collection-badge collection-badge--${status.id}">${status.icon} ${status.label}</span>` : ''}
          ${entry.favorite ? '<span class="collection-badge collection-badge--favorite">★ Favorito</span>' : ''}
        </div>
      </div>
      <div class="card-body">
        <h3>${escapeHtml(entry.name)}</h3>
        <div class="meta">
          <span>${entry.released ? entry.released.slice(0, 4) : '—'}</span>
          <span>${escapeHtml((entry.genres || [])[0] || '')}</span>
        </div>
      </div>
    </article>`;
}

function renderList() {
  const container = document.getElementById('favoritesList');
  const items = filteredEntries();
  document.getElementById('favoritesCount').textContent = String(entries.length);

  if (!items.length) {
    const [title, text] = EMPTY_MESSAGES[activeTab];
    container.innerHTML = `
      <div class="empty-state vee-empty-state">
        <img src="assets/brand/vee-logo-head.png" alt="" />
        <strong>${title}</strong>
        <span>${text}</span>
        <a class="pagination-btn" href="categorias.html">Explorar o catálogo</a>
      </div>`;
    return;
  }

  container.innerHTML = items.map(cardMarkup).join('');
  container.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => openGame(card.dataset.id, card.dataset.slug));
  });
}

function renderAll() {
  renderStats();
  renderTabs();
  renderList();
}

async function init() {
  const container = document.getElementById('favoritesList');
  const favoritesResult = readFavorites();
  const collectionResult = readCollection();

  if (!favoritesResult.available || !collectionResult.available) {
    container.innerHTML = '<div class="empty-state" role="status">Não foi possível ler sua coleção. Os dados foram preservados.</div>';
    return;
  }

  container.innerHTML = '<div class="empty-state" role="status">Carregando sua coleção…</div>';
  const { favorites, failed } = await upgradeLegacyFavorites(favoritesResult.value);
  entries = buildEntries(favorites, collectionResult.value);
  renderAll();

  if (failed) {
    document.getElementById('collectionNotice').textContent =
      `${failed} ${failed === 1 ? 'favorito não pôde ser carregado' : 'favoritos não puderam ser carregados'} agora.`;
  }

  document.getElementById('collectionTabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-tab]');
    if (!button) return;
    activeTab = button.dataset.tab;
    const url = activeTab === 'all' ? window.location.pathname : `${window.location.pathname}?aba=${activeTab}`;
    window.history.replaceState({}, '', url);
    renderTabs();
    renderList();
  });
}

init();
