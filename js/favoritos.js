import { getGame } from './services/rawgService.js';
import { navigateWithVee } from './motion.js';

const STORAGE_KEY = 'gameverse-favorites';

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (error) {
    return [];
  }
}

function openGame(id, slug) {
  const target = slug ? `game.html?slug=${encodeURIComponent(slug)}` : `game.html?id=${id}`;
  navigateWithVee(target);
}

async function renderFavorites() {
  const container = document.getElementById('favoritesList');
  const favorites = getFavorites();

  if (!favorites.length) {
    container.innerHTML = `
      <div class="empty-state vee-empty-state">
        <img src="assets/brand/vee-logo-head.png" alt="" />
        <strong>Nenhum favorito salvo ainda.</strong>
        <span>O Vee está esperando você escolher seus próximos universos.</span>
      </div>`;
    return;
  }

  const favoritesCount = document.getElementById('favoritesCount');
  if (favoritesCount) {
    favoritesCount.textContent = favorites.length;
  }

  const items = await Promise.all(
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

  container.innerHTML = items.map((item) => `
    <article class="card" data-id="${item.id}" data-slug="${item.slug}">
      <img src="${item.background_image || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80'}" alt="${item.name}" loading="lazy" />
      <div class="card-body">
        <h3>${item.name}</h3>
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
