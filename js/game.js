import {
  renderSkeletons,
  renderHeader,
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
import { getGame, getScreenshots, getTrailer, getStores, getSuggestions, getSearch } from "./services/rawgService.js";
import { getQueryParam, debounce } from "./utils.js";

const CACHE_KEY = "gameverse-cache";

function getCache() {
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY) || "{}");
  } catch (error) {
    return {};
  }
}

function setCache(key, value) {
  const cache = getCache();
  cache[key] = value;
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function getCachedValue(key) {
  const cache = getCache();
  return cache[key];
}

function resolveIdentifier() {
  const id = getQueryParam("id");
  const slug = getQueryParam("slug");
  if (id) return id;
  if (slug) return slug;
  return "persona-5-royal";
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
      Promise.resolve(getCachedValue(`trailer:${game.id}`) || getTrailer(game.id)),
      Promise.resolve(getCachedValue(`stores:${game.id}`) || getStores(game.id)),
      getSuggestions(game.name)
    ]);

    const screenshots = results[0].status === "fulfilled" ? results[0].value : [];
    const trailer = results[1].status === "fulfilled" ? results[1].value : null;
    const stores = results[2].status === "fulfilled" ? results[2].value : [];
    const similar = results[3].status === "fulfilled" ? results[3].value : [];

    if (results[0].status === "fulfilled" && screenshots.length) {
      setCache(`screenshots:${game.id}`, screenshots);
    }
    if (results[1].status === "fulfilled" && trailer) {
      setCache(`trailer:${game.id}`, trailer);
    }
    if (results[2].status === "fulfilled") {
      setCache(`stores:${game.id}`, stores);
    }

    renderHeader(game);
    renderHero(game);
    renderSynopsis(game);
    renderTrailer(trailer, game.name);
    renderScreenshots(screenshots);
    renderInfo(game);
    renderPrices(stores.length ? stores : []);
    renderRating(game.id);
    renderAnalysis(game.id);
    renderSimilar(similar.filter((item) => item.id !== game.id).slice(0, 8));
    renderFooter();

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      const handleSearch = debounce(async (event) => {
        const query = event.target.value.trim();
        if (!query) {
          renderHeader(game);
          return;
        }
        const suggestions = await getSearch(query);
        renderHeader(game, suggestions.slice(0, 6));
      }, 300);

      searchInput.addEventListener("input", handleSearch);
    }
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
