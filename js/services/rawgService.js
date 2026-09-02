import { CONFIG } from "../config.js";

const LIST_CACHE_TTL = 20 * 60 * 1000;
const LIST_CACHE_PREFIX = "gameverse-list:";

const FALLBACK_GAMES = [
  {
    id: 1,
    slug: "persona-5-royal",
    name: "Persona 5 Royal",
    background_image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
    background_image_additional: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
    released: "2022-10-21",
    rating: 4.8,
    tagline: "Uma jornada estilo anime com personalidade e impacto.",
    description_raw: "Persona 5 Royal é um RPG social cheio de estilo, com uma história emocionante, personagens memoráveis e uma trilha sonora marcante.",
    developers: [{ name: "Atlus" }],
    publishers: [{ name: "Sega" }],
    genres: [{ name: "JRPG" }, { name: "RPG" }],
    platforms: [{ platform: { name: "PlayStation 5" } }, { platform: { name: "PC" } }],
    parent_platforms: [{ platform: { name: "PlayStation" } }],
    website: "https://persona5royal.atlus.com/",
    esrb_rating: { name: "M" },
    ratings_count: 12500,
    metacritic: 95
  },
  {
    id: 2,
    slug: "elden-ring",
    name: "Elden Ring",
    background_image: "https://images.unsplash.com/photo-1511882150382-421056c89033?auto=format&fit=crop&w=1200&q=80",
    background_image_additional: "https://images.unsplash.com/photo-1511882150382-421056c89033?auto=format&fit=crop&w=1200&q=80",
    released: "2022-02-25",
    rating: 4.7,
    tagline: "Uma aventura épica em um mundo aberto repleto de mistério.",
    description_raw: "Elden Ring une exploração, combate e um mundo vasto em uma experiência marcante para quem gosta de aventura e desafio.",
    developers: [{ name: "FromSoftware" }],
    publishers: [{ name: "Bandai Namco" }],
    genres: [{ name: "Ação" }, { name: "RPG" }],
    platforms: [{ platform: { name: "PC" } }, { platform: { name: "PlayStation 5" } }],
    parent_platforms: [{ platform: { name: "PC" } }],
    website: "https://en.bandainamcoent.eu/elden-ring",
    esrb_rating: { name: "M" },
    ratings_count: 9800,
    metacritic: 96
  },
  {
    id: 3,
    slug: "hades",
    name: "Hades",
    background_image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
    background_image_additional: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
    released: "2020-09-17",
    rating: 4.6,
    tagline: "Combate, evolua e retorne ao submundo em uma experiência ágil.",
    description_raw: "Hades mistura ação rápida, narrativa envolvente e uma progressão gratificante em cada tentativa de fuga.",
    developers: [{ name: "Supergiant Games" }],
    publishers: [{ name: "Supergiant Games" }],
    genres: [{ name: "Indie" }, { name: "Ação" }],
    platforms: [{ platform: { name: "PC" } }, { platform: { name: "Nintendo Switch" } }],
    parent_platforms: [{ platform: { name: "PC" } }],
    website: "https://www.supergiantgames.com/games/hades/",
    esrb_rating: { name: "T" },
    ratings_count: 7600,
    metacritic: 93
  }
];

function buildFallbackData(endpoint, params = {}) {
  const normalizedEndpoint = endpoint.toLowerCase();

  if (normalizedEndpoint.includes("/screenshots")) {
    return {
      results: [
        { image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=80" },
        { image: "https://images.unsplash.com/photo-1511882150382-421056c89033?auto=format&fit=crop&w=900&q=80" }
      ]
    };
  }

  if (normalizedEndpoint.includes("/movies")) {
    return {
      results: [{ id: "fallback-trailer", data: [{ youtube_id: "dQw4w9WgXcQ" }] }]
    };
  }

  if (normalizedEndpoint.includes("/stores")) {
    return {
      results: [{ store: { name: "Steam" } }]
    };
  }

  if (normalizedEndpoint.startsWith("/games")) {
    const query = String(params.search || "").trim().toLowerCase();
    const identifier = normalizedEndpoint.split("/")[2];
    if (identifier && !["screenshots", "movies", "stores"].includes(identifier)) {
      return { ...FALLBACK_GAMES.find((game) => game.slug === identifier || String(game.id) === identifier) || FALLBACK_GAMES[0] };
    }
    const results = FALLBACK_GAMES.filter((game) => {
      if (!query) {
        return true;
      }
      return game.name.toLowerCase().includes(query) || game.slug.includes(query);
    });

    return { results: results.slice(0, Number(params.page_size || 6)) };
  }

  return { results: FALLBACK_GAMES };
}

async function requestRawg(endpoint, params = {}) {
  const url = new URL(`${CONFIG.BASE_URL}${endpoint}`);

  if (CONFIG.RAWG_API_KEY) {
    url.searchParams.set("key", CONFIG.RAWG_API_KEY);
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`RAWG request failed: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.warn("RAWG indisponível, usando dados locais.", error);
    return buildFallbackData(endpoint, params);
  }
}

export async function getGame(identifier) {
  if (!identifier) {
    throw new Error("Jogo não encontrado.");
  }

  const slug = typeof identifier === "string" ? identifier : String(identifier);
  const data = await requestRawg(`/games/${slug}`);
  return data.id ? data : data.results?.[0] || FALLBACK_GAMES[0];
}

export async function getGamesList(params = {}) {
  const cacheKey = `${LIST_CACHE_PREFIX}${JSON.stringify(params)}`;
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
    if (cached && cached.expiresAt > Date.now()) return cached.results;
  } catch (error) {
    console.warn("Cache de listas indisponível.", error);
  }

  const data = await requestRawg("/games", params);
  const results = (data.results || []).filter((game) => game && game.name);
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ expiresAt: Date.now() + LIST_CACHE_TTL, results }));
  } catch (error) {
    console.warn("Não foi possível salvar o cache da lista.", error);
  }
  return results;
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

export async function getTrailer(gameId) {
  try {
    const data = await requestRawg(`/games/${gameId}/movies`);
    return data.results?.[0] || null;
  } catch (error) {
    console.warn("Trailer indisponível.", error);
    return null;
  }
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
    return data.results || [];
  } catch (error) {
    console.warn("Sugestões indisponíveis.", error);
    return [];
  }
}

export async function getSearch(query) {
  try {
    const data = await requestRawg("/games", { search: query, page_size: 6 });
    return data.results || [];
  } catch (error) {
    console.warn("Busca indisponível.", error);
    return [];
  }
}
