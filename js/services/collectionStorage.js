// "Minha coleção": status de cada jogo (estilo Backloggd), salvo só no navegador.
// Guardamos nome, imagem e gêneros junto para a página da coleção não depender da RAWG.

const COLLECTION_KEY = 'gameverse-collection:v1';

export const GAME_STATUSES = Object.freeze([
  { id: 'want', label: 'Quero jogar', icon: '🎯' },
  { id: 'playing', label: 'Jogando', icon: '🎮' },
  { id: 'completed', label: 'Zerado', icon: '🏆' },
  { id: 'dropped', label: 'Abandonado', icon: '💤' }
]);

const STATUS_IDS = GAME_STATUSES.map((status) => status.id);

export function statusInfo(statusId) {
  return GAME_STATUSES.find((status) => status.id === statusId) || null;
}

function isValidEntry(entry) {
  return Boolean(entry) && typeof entry === 'object'
    && Number.isSafeInteger(entry.id) && entry.id > 0
    && STATUS_IDS.includes(entry.status)
    && typeof entry.name === 'string';
}

// Dados ilegíveis nunca são trocados por vazio: devolvemos available=false e não gravamos por cima.
export function readCollection() {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    if (raw === null) return { value: {}, available: true };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { value: {}, available: false };
    const value = {};
    Object.values(parsed).forEach((entry) => {
      if (isValidEntry(entry)) value[entry.id] = entry;
    });
    return { value, available: true };
  } catch {
    return { value: {}, available: false };
  }
}

function writeCollection(collection) {
  try {
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection));
    return true;
  } catch {
    return false;
  }
}

export function gameSnapshot(game) {
  return {
    id: Number(game.id),
    slug: String(game.slug || ''),
    name: String(game.name || 'Jogo'),
    image: String(game.background_image || ''),
    released: String(game.released || ''),
    genres: (game.genres || []).map((genre) => genre?.name).filter(Boolean).slice(0, 4)
  };
}

export function getGameStatus(gameId) {
  const { value } = readCollection();
  return value[Number(gameId)]?.status || null;
}

// Define o status; passar o mesmo status (ou null) remove o jogo da coleção.
export function setGameStatus(game, statusId) {
  const { value: collection, available } = readCollection();
  if (!available) return { ok: false, status: null };
  const id = Number(game.id);
  const current = collection[id]?.status || null;

  if (!statusId || statusId === current) {
    delete collection[id];
    return { ok: writeCollection(collection), status: null };
  }
  if (!STATUS_IDS.includes(statusId)) return { ok: false, status: current };

  collection[id] = { ...gameSnapshot(game), status: statusId, updatedAt: new Date().toISOString() };
  return { ok: writeCollection(collection), status: statusId };
}
