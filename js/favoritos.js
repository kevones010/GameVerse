import { getGame } from './services/rawgService.js';
import { navigateWithVee } from './motion.js';
import { readFavorites } from './services/gameStorage.js';
import { escapeHtml } from './utils.js';

function openGame(id, slug) {
  const target = slug ? `game.html?slug=${encodeURIComponent(slug)}` : `game.html?id=${id}`;
  navigateWithVee(target);
}

async function renderFavorites() {
  const container = document.getElementById('favoritesList');
  const { value: favorites, available } = readFavorites();
  const favoritesCount = document.getElementById('favoritesCount');
  if (favoritesCount) favoritesCount.textContent = available ? favorites.length : '—';

  const showError = message => {
    container.innerHTML = `<div class="empty-state" role="status">${message}</div><button type="button" class="pagination-btn" id="retryFavorites">Tentar novamente</button>`;
    document.getElementById('retryFavorites').addEventListener('click', renderFavorites);
  };
  if (!available) {
    showError('Não foi possível ler seus favoritos. Os dados foram preservados.');
    return;
  }

  if (!favorites.length) {
    container.innerHTML = `
      <div class="empty-state vee-empty-state">
        <img src="assets/brand/vee-logo-head.png" alt="" />
        <strong>Nenhum favorito salvo ainda.</strong>
        <span>O Vee está esperando você escolher seus próximos universos.</span>
      </div>`;
    return;
  }

  container.innerHTML = '<div class="empty-state" role="status">Carregando favoritos…</div>';
  const results = await Promise.allSettled(
    favorites.map(async (favorite) => {
      const data = await getGame(favorite.id);
      return {
        id: favorite.id,
        slug: data.slug,
        name: data.name,
        background_image: data.background_image,
        released: data.released,
        rating: data.rating
      };
    })
  );

  const items = results.filter(result => result.status === 'fulfilled').map(result => result.value);
  const failedCount = results.length - items.length;
  if (!items.length) {
    showError('Não foi possível carregar seus favoritos agora.');
    return;
  }

  const notice = failedCount ? `<p class="empty-state" role="status">${failedCount} ${failedCount === 1 ? 'favorito não pôde ser carregado' : 'favoritos não puderam ser carregados'}.</p>` : '';
  container.innerHTML = notice + items.map((item) => `
    <article class="card" data-id="${item.id}" data-slug="${item.slug}">
      <img src="${escapeHtml(item.background_image || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80')}" alt="${escapeHtml(item.name)}" loading="lazy" />
      <div class="card-body">
        <h3>${escapeHtml(item.name)}</h3>
        <div class="meta">
          <span>${item.released ? item.released.slice(0, 4) : '—'}</span>
          <span>${item.rating ? `${item.rating.toFixed(1)} ★` : 'Sem nota'}</span>
        </div>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => openGame(card.dataset.id, card.dataset.slug));
  });
}

renderFavorites();
