import {
  renderSkeletons,
  renderHeader,
  renderSearchSuggestions,
  renderHero,
  renderSynopsis,
  renderTrailer,
  renderScreenshots,
  renderInfo,
  renderPrices,
  renderRating,
  renderAnalysis,
  renderSimilar,
  renderFooter,
  renderModal,
  renderError
} from "./ui.js";
import { getGame, getScreenshots, getGameTrailers, getStores, getSuggestions, getSearch } from "./services/rawgService.js";
import { getYouTubeTrailer } from "./services/youtubeService.js";
import { getQueryParam, debounce } from "./utils.js";
import { navigateWithVee } from "./motion.js";

const CACHE_KEY = "gameverse-cache-v2";

function getCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    const cache = raw === null ? {} : JSON.parse(raw);
    return cache && typeof cache === "object" && !Array.isArray(cache) ? cache : null;
  } catch { return null; }
}

function setCache(key, value) {
  try {
    const cache = getCache();
    if (!cache) return;
    cache[key] = value;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* A full or unavailable cache must not affect the game. */ }
}

function getCachedValue(key) {
  const value = getCache()?.[key];
  if (key.startsWith("game:")) {
    const identifier = key.slice(5);
    const matches = /^\d+$/.test(identifier) ? String(value?.id) === identifier : value?.slug === identifier;
    const arrays = ["genres", "platforms", "developers", "publishers"];
    const strings = ["slug", "description_raw", "background_image", "background_image_additional", "released", "website"];
    return matches && Number.isSafeInteger(value?.id) && value.id > 0 && typeof value.name === "string"
      && arrays.every(field => value[field] == null || Array.isArray(value[field]))
      && strings.every(field => value[field] == null || typeof value[field] === "string") ? value : undefined;
  }
  return Array.isArray(value) && value.every(item => item && typeof item === "object"
    && (!key.startsWith("screenshots:") || typeof item.image === "string")) ? value : undefined;
}

function setupGameSearch() {
  const input = document.getElementById("searchInput");
  const box = document.getElementById("searchSuggestions");
  let requestVersion = 0;
  let suggestions = [];
  const show = (items = []) => {
    suggestions = items.filter(item => Number.isSafeInteger(item?.id) && item.id > 0 && typeof item.name === "string");
    renderSearchSuggestions(suggestions);
  };
  const search = debounce(async (query, version) => {
    if (!query || version !== requestVersion) return;
    const results = await getSearch(query);
    if (version === requestVersion && input.value.trim() === query) show(results.slice(0, 6));
  }, 300);
  input.addEventListener("input", () => {
    const version = ++requestVersion;
    show();
    search(input.value.trim(), version);
  });
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      const exact = suggestions.filter(item => item.name.toLocaleLowerCase() === input.value.trim().toLocaleLowerCase());
      const selected = suggestions.length === 1 ? suggestions[0] : exact.length === 1 ? exact[0] : null;
      if (selected) navigateWithVee(`game.html?id=${selected.id}`);
    } else if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      box.querySelector("button")?.focus();
    }
  });
  box.addEventListener("click", event => {
    const button = event.target.closest("button[data-id]");
    const selected = suggestions.find(item => item.id === Number(button?.dataset.id));
    if (selected) navigateWithVee(`game.html?id=${selected.id}`);
  });
  box.addEventListener("keydown", event => {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    const buttons = [...box.querySelectorAll("button")];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length].focus();
  });
  document.getElementById("header").addEventListener("keydown", event => {
    if (event.key !== "Escape" || (!box.contains(event.target) && event.target !== input)) return;
    ++requestVersion;
    show();
    input.focus();
  });
  document.addEventListener("click", event => {
    if (event.target !== input && !box.contains(event.target)) { ++requestVersion; show(); }
  });
}

function resolveIdentifier() {
  const id = getQueryParam("id");
  const slug = getQueryParam("slug");
  if (id) return id;
  if (slug) return slug;
  return "persona-5-royal";
}

// Social imports and storage failures are isolated from the game render path.
async function loadCommunityPreview(gameId) {
  const section = document.getElementById("gameCommunityPreview");
  if (!section) return;
  const href = `comunidade-jogo.html?gameId=${encodeURIComponent(gameId)}`;
  try {
    const link = document.getElementById("gameCommunityLink");
    link.href = href;
    link.hidden = false;
    document.getElementById("gameCommunityAll").href = href;
    section.hidden = false;
    const { renderGameCommunityPreview } = await import("./community/ui/gameCommunityPreview.js");
    await renderGameCommunityPreview(section, gameId);
  } catch {
    // Even a missing module must never reach renderError() or erase game data.
    const count = document.getElementById("gameCommunityCount");
    const posts = document.getElementById("gameCommunityPosts");
    if (count) count.textContent = "Não foi possível carregar as publicações agora.";
    if (posts) {
      posts.replaceChildren();
      posts.removeAttribute("aria-busy");
    }
  }
}

async function loadGamePage() {
  renderSkeletons();
  renderModal();

  const identifier = resolveIdentifier();

  try {
    const cachedGame = getCachedValue(`game:${identifier}`);
    const game = cachedGame || await getGame(identifier);

    if (!cachedGame) {
      setCache(`game:${identifier}`, game);
    }

    const results = await Promise.allSettled([
      Promise.resolve(getCachedValue(`screenshots:${game.id}`) || getScreenshots(game.id)),
      Promise.resolve(getCachedValue(`trailers:${game.id}`) ?? getGameTrailers(game.id)),
      Promise.resolve(getCachedValue(`stores:${game.id}`) || getStores(game.id)),
      getSuggestions(game.name)
    ]);

    const screenshots = results[0].status === "fulfilled" ? results[0].value : [];
    const trailers = results[1].status === "fulfilled" ? results[1].value : [];
    const stores = results[2].status === "fulfilled" ? results[2].value : [];
    const similar = results[3].status === "fulfilled" ? results[3].value : [];
    const rawgTrailer = trailers.find((item) => item?.data?.max || item?.data?.["480"]);
    let youtubeTrailer = null;

    if (rawgTrailer) {
      console.info("[TRAILER] RAWG");
    } else {
      console.info("[TRAILER] YouTube fallback");
      const youtubeResult = await Promise.allSettled([getYouTubeTrailer({
        gameId: game.id, gameName: game.name, gameSlug: game.slug
      })]);
      youtubeTrailer = youtubeResult[0].status === "fulfilled" ? youtubeResult[0].value : null;
    }

    if (results[0].status === "fulfilled" && screenshots.length) {
      setCache(`screenshots:${game.id}`, screenshots);
    }
    if (results[1].status === "fulfilled") {
      setCache(`trailers:${game.id}`, trailers);
    }
    if (results[2].status === "fulfilled") {
      setCache(`stores:${game.id}`, stores);
    }

    renderHeader(game);
    renderHero(game);
    renderSynopsis(game);
    renderTrailer(trailers, game, youtubeTrailer);
    renderScreenshots(screenshots);
    renderInfo(game);
    renderPrices(stores.length ? stores : []);
    renderRating(game.id, game);
    renderAnalysis(game.id);
    renderSimilar(similar.filter((item) => item.id !== game.id && item.slug !== game.slug).slice(0, 8));
    renderFooter();
    requestAnimationFrame(() => { void loadCommunityPreview(game.id); });

    setupGameSearch();
  } catch (error) {
    console.error(error);
    renderError("Jogo não encontrado.");
  } finally {
    document.querySelectorAll(".section-card").forEach((section) => {
      section.classList.remove("is-loading");
    });
  }
}

loadGamePage();
