import { getLocalConfig } from "./localConfig.js";

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const CACHE_PREFIX = "gameverse-youtube-trailer:v2:";
const CACHE_TTL = 24 * 60 * 60 * 1000;

const POSITIVE_TERMS = [
  ["official trailer", 40],
  ["launch trailer", 30],
  ["announcement trailer", 25],
  ["gameplay trailer", 15],
  ["trailer", 10]
];

const NEGATIVE_TERMS = [
  ["review", 70],
  ["reaction", 70],
  ["walkthrough", 80],
  ["full game", 90],
  ["soundtrack", 80],
  ["ost", 80],
  ["fan trailer", 100],
  ["mod", 70],
  ["speedrun", 80],
  ["analysis", 70],
  ["comparison", 70]
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function includesTerm(text, term) {
  return ` ${text} `.includes(` ${term} `);
}

const TITLE_STOP_WORDS = new Set(["the", "a", "an", "and", "of", "for", "to", "in", "official", "trailer", "launch", "release"]);

function gameContext(value) {
  const gameId = Number(value?.gameId);
  if (!value || typeof value !== "object" || !/^\d+$/.test(String(value.gameId))
    || !Number.isSafeInteger(gameId) || gameId <= 0 || typeof value.gameName !== "string" || !value.gameName.trim()) {
    throw new TypeError("Informe o contexto do jogo com gameId RAWG e gameName.");
  }
  return { gameId, gameName: value.gameName.trim(), gameSlug: typeof value.gameSlug === "string" ? value.gameSlug : "" };
}

function scoreResult(item, context) {
  const title = normalizeText(item?.snippet?.title);
  const normalizedGameName = normalizeText(context.gameName);
  const tokens = normalizedGameName.split(" ").filter(token => !TITLE_STOP_WORDS.has(token) && !/^(19|20)\d{2}$/.test(token));
  // Marketing words cannot compensate for a missing game name or sequel number.
  if (!tokens.length || !tokens.every(token => includesTerm(title, token))) return -Infinity;

  const slugYear = context.gameSlug.match(/-((?:19|20)\d{2})$/)?.[1];
  const editionYear = slugYear || normalizedGameName.match(/\b(?:19|20)\d{2}\b/)?.[0];
  if (editionYear) {
    const titleYears = title.match(/\b(?:19|20)\d{2}\b/g) || [];
    if (titleYears.some(year => year !== editionYear)) return -Infinity;
    const snippet = normalizeText(`${item?.snippet?.title || ""} ${item?.snippet?.description || ""}`);
    if (!includesTerm(snippet, editionYear) && !(slugYear && includesTerm(title, "remake"))) return -Infinity;
  }
  let score = 50;

  POSITIVE_TERMS.forEach(([term, points]) => {
    if (title.includes(term)) score += points;
  });

  NEGATIVE_TERMS.forEach(([term, points]) => {
    if (includesTerm(title, term)) score -= points;
  });

  return score;
}

function getCacheKey(context) {
  return `${CACHE_PREFIX}${context.gameId}`;
}

function toTrailer(payload) {
  if (!payload?.videoId) return null;

  return {
    source: "youtube",
    videoId: payload.videoId,
    title: payload.title || "Trailer oficial",
    thumbnail: payload.thumbnail || "",
    embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(payload.videoId)}`
  };
}

function getCachedTrailer(context) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(getCacheKey(context)) || "null");
    if (cached?.gameId !== context.gameId || !cached?.timestamp || Date.now() - cached.timestamp > CACHE_TTL) return null;
    return toTrailer(cached);
  } catch (error) {
    return null;
  }
}

function cacheTrailer(context, trailer) {
  try {
    sessionStorage.setItem(getCacheKey(context), JSON.stringify({
      gameId: context.gameId,
      videoId: trailer.videoId,
      title: trailer.title,
      thumbnail: trailer.thumbnail,
      timestamp: Date.now()
    }));
  } catch (error) {
    // O trailer continua disponível mesmo quando o cache do navegador falha.
  }
}

/** @param {{gameId: number|string, gameName: string, gameSlug?: string}} game */
export async function getYouTubeTrailer(game) {
  const context = gameContext(game);

  const { YOUTUBE_API_KEY } = await getLocalConfig();
  if (!YOUTUBE_API_KEY) return null;

  const cachedTrailer = getCachedTrailer(context);
  if (cachedTrailer) return cachedTrailer;

  const url = new URL(YOUTUBE_SEARCH_URL);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "5");
  url.searchParams.set("videoEmbeddable", "true");
  const editionYear = context.gameSlug.match(/-((?:19|20)\d{2})$/)?.[1];
  url.searchParams.set("q", `${context.gameName}${editionYear ? ` ${editionYear}` : ""} official trailer`);
  url.searchParams.set("key", YOUTUBE_API_KEY);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      console.info("[YouTube Trailer] sem resultado");
      return null;
    }

    const data = await response.json();
    const candidates = (Array.isArray(data?.items) ? data.items : [])
      .filter((item) => item?.id?.videoId && item?.snippet?.title)
      .map((item) => ({ item, score: scoreResult(item, context) }))
      .sort((first, second) => second.score - first.score);

    const best = candidates[0];
    if (!best || best.score <= 0) {
      console.info("[YouTube Trailer] sem resultado");
      return null;
    }

    const snippet = best.item.snippet;
    const trailer = toTrailer({
      videoId: best.item.id.videoId,
      title: snippet.title,
      thumbnail: snippet.thumbnails?.maxres?.url
        || snippet.thumbnails?.high?.url
        || snippet.thumbnails?.medium?.url
        || snippet.thumbnails?.default?.url
        || ""
    });

    cacheTrailer(context, trailer);
    return trailer;
  } catch (error) {
    console.info("[YouTube Trailer] sem resultado");
    return null;
  }
}
