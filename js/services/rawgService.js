import { CONFIG } from "../config.js";
import { getLocalConfig } from "./localConfig.js";

const LIST_CACHE_TTL = 20 * 60 * 1000;
const LIST_CACHE_PREFIX = "gameverse-list-v2:";
const GAME_IMAGE_PLACEHOLDER = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1600 900%22%3E%3Crect width=%221600%22 height=%22900%22 fill=%22%23151520%22/%3E%3Ctext x=%22800%22 y=%22470%22 text-anchor=%22middle%22 fill=%22%236f6f7d%22 font-family=%22sans-serif%22 font-size=%2272%22%3EGameVerse%3C/text%3E%3C/svg%3E";

function withSafeGameImage(game) {
  if (!game || typeof game !== "object") return game;

  const image = game.background_image || game.background_image_additional || GAME_IMAGE_PLACEHOLDER;
  return {
    ...game,
    background_image: image,
    background_image_additional: game.background_image_additional || image
  };
}

async function requestRawg(endpoint, params = {}) {
  const { RAWG_API_KEY } = await getLocalConfig();
  if (!RAWG_API_KEY) {
    throw new Error("RAWG API key não configurada.");
  }

  const url = new URL(`${CONFIG.BASE_URL}${endpoint}`);
  url.searchParams.set("key", RAWG_API_KEY);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    const error = new Error(`RAWG request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function getGame(identifier) {
  if (identifier === undefined || identifier === null || String(identifier).trim() === "") {
    throw new Error("Identificador do jogo ausente.");
  }

  const normalizedIdentifier = String(identifier).trim();
  const data = await requestRawg(`/games/${encodeURIComponent(normalizedIdentifier)}`);
  const isNumericIdentifier = /^\d+$/.test(normalizedIdentifier);
  const matchesIdentifier = isNumericIdentifier
    ? String(data?.id) === normalizedIdentifier
    : data?.slug?.toLowerCase() === normalizedIdentifier.toLowerCase();

  if (!data?.id || !matchesIdentifier) {
    throw new Error(`Jogo não encontrado: ${normalizedIdentifier}`);
  }

  return withSafeGameImage(data);
}

export async function getGamesList(params = {}) {
  const cacheKey = `${LIST_CACHE_PREFIX}${JSON.stringify(params)}`;
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
    if (cached && cached.expiresAt > Date.now()) return cached.results;
  } catch (error) {
    console.warn("Cache de listas indisponível.", error);
  }

  try {
    const data = await requestRawg("/games", params);
    const results = (data.results || [])
      .filter((game) => game && game.id && game.name)
      .map(withSafeGameImage);
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ expiresAt: Date.now() + LIST_CACHE_TTL, results }));
    } catch (error) {
      console.warn("Não foi possível salvar o cache da lista.", error);
    }
    return results;
  } catch (error) {
    console.warn("Lista de jogos indisponível.", error);
    return [];
  }
}

export async function getScreenshots(gameId) {
  try {
    const data = await requestRawg(`/games/${gameId}/screenshots`, { page_size: 8 });
    return data.results || [];
  } catch (error) {
    console.warn("Screenshots indisponíveis.", error);
    return [];
  }
}

export async function getGameTrailers(gameId) {
  if (gameId === undefined || gameId === null || String(gameId).trim() === "") {
    throw new Error("ID do jogo ausente.");
  }

  const normalizedGameId = encodeURIComponent(String(gameId).trim());
  const data = await requestRawg(`/games/${normalizedGameId}/movies`);

  return Array.isArray(data?.results) ? data.results : [];
}

export async function getStores(gameId) {
  try {
    const data = await requestRawg(`/games/${gameId}/stores`);
    return data.results || [];
  } catch (error) {
    console.warn("Lojas indisponíveis.", error);
    return [];
  }
}

export async function getSuggestions(query) {
  try {
    const data = await requestRawg("/games", { search: query, page_size: 6 });
    return (data.results || []).filter((game) => game && game.id && game.name).map(withSafeGameImage);
  } catch (error) {
    console.warn("Sugestões indisponíveis.", error);
    return [];
  }
}

export async function getSearch(query) {
  try {
    const data = await requestRawg("/games", { search: query, page_size: 6 });
    return (data.results || []).filter((game) => game && game.id && game.name).map(withSafeGameImage);
  } catch (error) {
    console.warn("Busca indisponível.", error);
    return [];
  }
}

// Strict search for the composer: unlike legacy suggestions, failure is not
// an empty result. Reuses the existing request/configuration without logging it.
export async function searchGames(query) {
  const normalizedQuery = String(query ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  if (normalizedQuery.length < 2) return [];
  const cacheKey = `gameverse-community-game-search:v1:${normalizedQuery.toLowerCase()}`;
  const snapshots = (results) => (Array.isArray(results) ? results : [])
    .filter((game) => Number.isSafeInteger(game?.id) && game.id > 0 && typeof game.name === "string")
    .slice(0, 6)
    .map((game) => ({
      id: game.id,
      name: game.name,
      slug: typeof game.slug === "string" ? game.slug : "",
      background_image: typeof game.background_image === "string" && /^https:\/\//i.test(game.background_image)
        ? game.background_image : "",
      released: typeof game.released === "string" ? game.released : ""
    }));
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
    if (cached?.expiresAt > Date.now() && Array.isArray(cached.results)) return snapshots(cached.results);
  } catch { /* Search remains available when browser storage is blocked. */ }
  const data = await requestRawg("/games", { search: normalizedQuery, page_size: 6 });
  const results = snapshots(data.results);
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ expiresAt: Date.now() + 5 * 60 * 1000, results }));
  } catch { /* Cache is optional. */ }
  return results;
}
