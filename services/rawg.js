import { CONFIG } from "../js/config.js";

async function fetchRawg(endpoint, params = {}) {
  const url = new URL(`${CONFIG.RAWG_BASE_URL}${endpoint}`);
  url.searchParams.set("key", CONFIG.RAWG_API_KEY);
  url.searchParams.set("lang", CONFIG.DEFAULT_LANGUAGE);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`RAWG request failed: ${response.status}`);
  }

  return response.json();
}

export async function buscarJogo(query) {
  const identifier = query?.id || query?.slug;
  if (!identifier) {
    throw new Error("Nenhum identificador foi informado.");
  }

  const params = identifier.toString().includes(" ") ? { search: identifier } : {};
  const endpoint = typeof identifier === "number" || /^\d+$/.test(String(identifier))
    ? `/games/${identifier}`
    : `/games/${identifier}`;

  try {
    return await fetchRawg(endpoint, params);
  } catch (error) {
    console.error("Erro ao buscar jogo:", error);
    throw error;
  }
}

export async function buscarScreenshots(gameId) {
  try {
    const data = await fetchRawg(`/games/${gameId}/screenshots`, { page_size: 10 });
    return data.results || [];
  } catch (error) {
    console.error("Erro ao buscar screenshots:", error);
    return [];
  }
}

export async function buscarTrailer(gameId) {
  try {
    const data = await fetchRawg(`/games/${gameId}/movies`);
    return data.results?.[0] || null;
  } catch (error) {
    console.error("Erro ao buscar trailer:", error);
    return null;
  }
}

export async function buscarSeries(gameId) {
  try {
    const data = await fetchRawg(`/games/${gameId}/game-series`);
    return data.results || [];
  } catch (error) {
    console.error("Erro ao buscar série:", error);
    return [];
  }
}

export async function buscarJogosRelacionados(gameId) {
  try {
    const data = await fetchRawg(`/games/${gameId}/suggested`);
    return data.results || [];
  } catch (error) {
    console.error("Erro ao buscar jogos relacionados:", error);
    return [];
  }
}

export async function buscarMetacritic(gameId) {
  try {
    const data = await fetchRawg(`/games/${gameId}`);
    return data.metacritic || null;
  } catch (error) {
    console.error("Erro ao buscar metacritic:", error);
    return null;
  }
}

export async function buscarLojas(gameId) {
  try {
    const data = await fetchRawg(`/games/${gameId}/stores`);
    return data.results || [];
  } catch (error) {
    console.error("Erro ao buscar lojas:", error);
    return [];
  }
}

export async function buscarJogosPorBusca(query) {
  try {
    const data = await fetchRawg("/games", { search: query, page_size: 6 });
    return data.results || [];
  } catch (error) {
    console.error("Erro ao buscar jogos por pesquisa:", error);
    return [];
  }
}
