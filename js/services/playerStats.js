// Junta tudo o que a pessoa guardou neste navegador: coleção, favoritos, notas e análises.
// Usado no perfil (vitrine, conquistas e atividade).
import { readFavorites } from './gameStorage.js';
import { readCollection } from './collectionStorage.js';

function readLocalEntries(prefix, parse) {
  const entries = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(prefix)) continue;
      const id = Number(key.slice(prefix.length));
      if (!Number.isSafeInteger(id) || id <= 0) continue;
      const value = parse(localStorage.getItem(key));
      if (value !== null) entries.push({ id, value });
    }
  } catch { /* armazenamento bloqueado: segue sem esses dados */ }
  return entries;
}

export function getPlayerStats() {
  const collection = Object.values(readCollection().value);
  const favorites = readFavorites().value.filter((item) => item.name);
  const ratings = readLocalEntries('gameverse-rating-', (raw) => (/^[1-5]$/.test(raw) ? Number(raw) : null));
  const analyses = readLocalEntries('gameverse-analysis-', (raw) => {
    try {
      const value = JSON.parse(raw);
      return value && typeof value.text === 'string' && value.text.trim() ? value : null;
    } catch {
      return null;
    }
  });

  const byId = new Map();
  favorites.forEach((item) => byId.set(item.id, { ...item, favorite: true }));
  collection.forEach((item) => byId.set(item.id, { ...byId.get(item.id), ...item }));
  const games = [...byId.values()];

  const genreCount = new Map();
  games.forEach((game) => (game.genres || []).forEach((genre) => genreCount.set(genre, (genreCount.get(genre) || 0) + 1)));
  const topGenre = [...genreCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const count = (status) => collection.filter((item) => item.status === status).length;
  const byRecent = (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));

  return {
    games,
    total: games.length,
    completed: count('completed'),
    playing: count('playing'),
    want: count('want'),
    dropped: count('dropped'),
    nowPlaying: collection.filter((item) => item.status === 'playing').sort(byRecent).slice(0, 3),
    favorites: favorites.slice(-3).reverse(),
    ratingsCount: ratings.length,
    averageRating: ratings.length ? ratings.reduce((sum, item) => sum + item.value, 0) / ratings.length : 0,
    analysesCount: analyses.length,
    genresCount: genreCount.size,
    topGenre,
    // Eventos da coleção para a linha do tempo.
    collectionEvents: collection.filter((item) => item.updatedAt).sort(byRecent).slice(0, 10)
  };
}
