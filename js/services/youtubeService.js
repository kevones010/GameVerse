import { getLocalConfig } from "./localConfig.js";

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const CACHE_PREFIX = "gameverse-youtube-trailer:";
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

function scoreResult(item, gameName) {
  const title = normalizeText(item?.snippet?.title);
  const normalizedGameName = normalizeText(gameName);
  let score = title.includes(normalizedGameName) ? 50 : 0;

  POSITIVE_TERMS.forEach(([term, points]) => {
    if (title.includes(term)) score += points;
  });

  NEGATIVE_TERMS.forEach(([term, points]) => {
    if (includesTerm(title, term)) score -= points;
  });

  return score;
}

function getCacheKey(gameName) {
  return `${CACHE_PREFIX}${normalizeText(gameName)}`;
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

function getCachedTrailer(gameName) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(getCacheKey(gameName)) || "null");
    if (!cached?.timestamp || Date.now() - cached.timestamp > CACHE_TTL) return null;
    return toTrailer(cached);
  } catch (error) {
    return null;
  }
}

function cacheTrailer(gameName, trailer) {
  try {
    sessionStorage.setItem(getCacheKey(gameName), JSON.stringify({
      videoId: trailer.videoId,
      title: trailer.title,
      thumbnail: trailer.thumbnail,
      timestamp: Date.now()
    }));
  } catch (error) {
    // O trailer continua disponível mesmo quando o cache do navegador falha.
  }
}

export async function getYouTubeTrailer(gameName) {
  const normalizedGameName = String(gameName || "").trim();
  if (!normalizedGameName) return null;

  const { YOUTUBE_API_KEY } = await getLocalConfig();
  if (!YOUTUBE_API_KEY) return null;

  const cachedTrailer = getCachedTrailer(normalizedGameName);
  if (cachedTrailer) return cachedTrailer;

  const url = new URL(YOUTUBE_SEARCH_URL);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "5");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("q", `${normalizedGameName} official trailer`);
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
      .map((item) => ({ item, score: scoreResult(item, normalizedGameName) }))
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

    cacheTrailer(normalizedGameName, trailer);
    return trailer;
  } catch (error) {
    console.info("[YouTube Trailer] sem resultado");
    return null;
  }
}
