import {
  buscarJogo,
  buscarScreenshots,
  buscarTrailer,
  buscarSeries,
  buscarJogosRelacionados,
  buscarLojas,
  buscarJogosPorBusca
} from "../services/rawg.js";
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
  renderModal
} from "./ui.js";
import { getQueryParam } from "./utils.js";

async function loadGamePage() {
  renderSkeletons();
  renderModal();

  const gameId = getQueryParam("id");
  const slug = getQueryParam("slug");
  const query = gameId || slug || "persona 5 royal";

  try {
    const game = await buscarJogo({ id: gameId, slug });
    const [screenshots, trailerData, series, relatedGames, stores] = await Promise.all([
      buscarScreenshots(game.id),
      buscarTrailer(game.id),
      buscarSeries(game.id),
      buscarJogosRelacionados(game.id),
      buscarLojas(game.id)
    ]);

    renderHeader(game);
    renderHero(game);
    renderSynopsis(game);
    renderTrailer(trailerData, game.name);
    renderScreenshots(screenshots);
    renderInfo(game);
    renderPrices(stores);
    renderRating(game.id);
    renderAnalysis(game.id);
    renderSimilar(relatedGames.length ? relatedGames : series);
    renderFooter();

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      let suggestions = [];
      searchInput.addEventListener("input", async (event) => {
        const value = event.target.value.trim();
        if (!value) {
          renderHeader(game);
          return;
        }
        suggestions = await buscarJogosPorBusca(value);
        renderHeader(game, suggestions);
      });
    }
  } catch (error) {
    document.getElementById("hero").innerHTML = `
      <div class="error-state">
        <h2>Não foi possível carregar este jogo</h2>
        <p>Verifique a conexão ou tente novamente mais tarde.</p>
      </div>
    `;
    console.error(error);
  }
}

loadGamePage();
