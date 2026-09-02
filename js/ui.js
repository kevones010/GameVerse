import { escapeHtml, formatDate, buildYouTubeEmbed, observeLazyImages } from "./utils.js";
import { DESCRIPTION_BY_SLUG } from "../data/descriptions-pt.js";

function displayValue(value) {
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

function displayNumber(value, suffix = "") {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? `${number}${suffix}` : "—";
}

export function renderSkeletons() {
  const sections = [
    document.getElementById("hero"),
    document.getElementById("synopsis"),
    document.getElementById("trailer"),
    document.getElementById("screenshots"),
    document.getElementById("info"),
    document.getElementById("prices"),
    document.getElementById("rating"),
    document.getElementById("analysis"),
    document.getElementById("similar")
  ];

  sections.forEach((section) => {
    if (section) {
      section.classList.add("is-loading");
    }
  });
}

export function renderError(message) {
  const title = document.getElementById("game-title");
  const description = document.getElementById("game-description");
  title.textContent = message;
  description.textContent = "Não foi possível carregar este jogo.";
  description.insertAdjacentHTML("afterend", '<div class="error-actions"><button class="btn btn-secondary" type="button" onclick="location.reload()">Tentar novamente</button> <a class="btn btn-primary" href="index.html">Voltar para Home</a></div>');
}

export function renderHeader(game, suggestions = []) {
  const header = document.getElementById("header");
  header.innerHTML = `
    <nav class="navbar">
      <a href="index.html" class="brand">
        <span class="brand-mark">G</span>
        <span>GameVerse</span>
      </a>
      <div class="nav-actions">
        <label class="search-box">
          <span>🔎</span>
          <input id="searchInput" type="text" placeholder="Buscar jogos" autocomplete="off" />
        </label>
        <a href="index.html" class="nav-btn">Home</a>
        <a href="categorias.html" class="nav-btn">Categorias</a>
        <a href="favoritos.html" class="nav-btn">Favoritos</a>
        <div class="profile-pill">
          <span class="profile-avatar">G</span>
          <span>Guest</span>
        </div>
      </div>
    </nav>
    <div class="search-suggestions" id="searchSuggestions"></div>
  `;

  const searchInput = document.getElementById("searchInput");
  const suggestionsBox = document.getElementById("searchSuggestions");

  const updateSuggestions = () => {
    const term = searchInput.value.trim();
    if (!term) {
      suggestionsBox.innerHTML = "";
      suggestionsBox.classList.remove("visible");
      return;
    }

    const html = suggestions
      .slice(0, 4)
      .map((item) => `<button class="suggestion-item" data-id="${item.id}" data-slug="${escapeHtml(item.slug || "")}">${escapeHtml(item.name)}</button>`)
      .join("");

    suggestionsBox.innerHTML = html;
    suggestionsBox.classList.toggle("visible", Boolean(html));
  };

  searchInput.addEventListener("input", updateSuggestions);
  searchInput.addEventListener("focus", updateSuggestions);
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const query = searchInput.value.trim();
      if (query) {
        window.location.href = `game.html?slug=${encodeURIComponent(query.toLowerCase().replace(/\s+/g, "-"))}`;
      }
    }
  });
  suggestionsBox.addEventListener("click", (event) => {
    const target = event.target.closest(".suggestion-item");
    if (!target) return;
    const id = target.getAttribute("data-id");
    const slug = target.getAttribute("data-slug");
    if (slug) {
      window.location.href = `game.html?slug=${encodeURIComponent(slug)}`;
    } else if (id) {
      window.location.href = `game.html?id=${id}`;
    }
  });

  if (game) {
    document.title = `${game.name} | GameVerse`;
  }
}

export function renderHero(game) {
  const hero = document.getElementById("hero");
  const background = game.background_image_additional || game.background_image || "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1600&q=80";
  const poster = game.background_image || game.background_image_additional || "https://images.unsplash.com/photo-1511882150382-421056c89033?auto=format&fit=crop&w=800&q=80";
  const favorites = JSON.parse(localStorage.getItem("gameverse-favorites") || "[]");
  const isFavorite = favorites.some((item) => item.id === game.id);

  const cover = document.getElementById("game-cover");
  const title = document.getElementById("game-title");
  const meta = document.getElementById("game-meta");
  const genres = document.getElementById("game-genres");
  const platforms = document.getElementById("game-platforms");
  cover.src = poster;
  cover.alt = `Poster de ${game.name || "jogo"}`;
  title.textContent = game.name || "Jogo";
  meta.innerHTML = [game.developers?.[0]?.name, game.publishers?.[0]?.name, game.released ? formatDate(game.released) : "Em breve"].map((item) => escapeHtml(displayValue(item))).join(" <span class=\"meta-separator\">•</span> ");
  document.getElementById("overview-score").innerHTML = `<strong>${Number.isFinite(Number(game.rating)) && Number(game.rating) > 0 ? `${Number(game.rating).toFixed(1)} / 5` : "—"}</strong><span>RAWG</span><strong>${displayNumber(game.metacritic)}</strong><span>Metacritic</span>`;
  genres.innerHTML = (game.genres || []).filter((genre) => genre?.name).map((genre) => `<span>${escapeHtml(genre.name)}</span>`).join("");
  platforms.innerHTML = (game.platforms || []).filter((platform) => platform?.platform?.name).map((platform) => `<span>${escapeHtml(platform.platform.name)}</span>`).join("");

  hero.style.backgroundImage = `url(${background})`;
  hero.classList.add("is-visible");
  requestAnimationFrame(() => {
    observeLazyImages();
  });

  const favoriteButton = document.getElementById("favoriteButton");
  favoriteButton.textContent = isFavorite ? "★ Favoritado" : "★ Favoritar";
  favoriteButton.onclick = () => {
    const favorites = JSON.parse(localStorage.getItem("gameverse-favorites") || "[]");
    const exists = favorites.some((item) => item.id === game.id);
    const next = exists ? favorites.filter((item) => item.id !== game.id) : [...favorites, { id: game.id, slug: game.slug }];
    localStorage.setItem("gameverse-favorites", JSON.stringify(next));
    renderHero(game);
  };
  document.getElementById("shareButton").onclick = async () => {
    await navigator.clipboard?.writeText(window.location.href);
  };
  document.getElementById("trailerButton").onclick = () => document.getElementById("trailer").scrollIntoView({ behavior: "smooth" });
}

export function renderSynopsis(game) {
  const synopsis = document.getElementById("synopsis");
  const portugueseDescription = DESCRIPTION_BY_SLUG[game.slug];
  const description = portugueseDescription || game.description_raw || "Descrição ainda não disponível.";

  document.getElementById("game-description").textContent = description.replace(/<[^>]*>/g, "");
}

export function renderTrailer(trailer, gameName) {
  const trailerSection = document.getElementById("game-trailer");
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${gameName} official trailer`)}`;

  if (!trailer) {
    trailerSection.innerHTML = `
      <div class="trailer-placeholder">
        <p>Trailer não encontrado na RAWG.</p>
        <a class="btn btn-secondary" href="${youtubeUrl}" target="_blank" rel="noreferrer">Assistir no YouTube</a>
      </div>
    `;
    return;
  }

  trailerSection.innerHTML = `<div class="video-frame">
      <iframe src="${buildYouTubeEmbed(trailer.data?.[0]?.youtube_id || trailer.video_id || trailer.id)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    </div>
  `;
}

export function renderScreenshots(screenshots) {
  const screenshotsSection = document.getElementById("game-screenshots");
  if (!screenshots.length) {
    screenshotsSection.innerHTML = `<div class="empty-state">Screenshots indisponíveis.</div>`;
    return;
  }

  screenshotsSection.innerHTML = screenshots.slice(0, 6).map((shot) => `
        <article class="screenshot-card" data-image="${shot.image}">
          <img src="${shot.image}" alt="Screenshot" loading="lazy" />
        </article>
      `).join("");

  screenshotsSection.querySelectorAll(".screenshot-card").forEach((card) => {
    card.addEventListener("click", () => {
      const modal = document.getElementById("imageModal");
      const img = modal.querySelector("img");
      img.src = card.dataset.image;
      modal.classList.add("visible");
    });
  });
}

export function renderInfo(game) {
  const info = document.getElementById("game-info");
  info.innerHTML = `
      <div class="info-item"><strong>Data</strong><span>${game.released ? formatDate(game.released) : "—"}</span></div>
      <div class="info-item"><strong>Publisher</strong><span>${escapeHtml(displayValue(game.publishers?.[0]?.name))}</span></div>
      <div class="info-item"><strong>Developer</strong><span>${escapeHtml(displayValue(game.developers?.[0]?.name))}</span></div>
      <div class="info-item"><strong>Website</strong><span>${game.website ? `<a href="${escapeHtml(game.website)}" target="_blank" rel="noreferrer">Abrir</a>` : "—"}</span></div>
      <div class="info-item"><strong>Metacritic</strong><span>${displayNumber(game.metacritic)}</span></div>
      <div class="info-item"><strong>RAWG Rating</strong><span>${Number.isFinite(Number(game.rating)) && Number(game.rating) > 0 ? `${Number(game.rating).toFixed(1)}/5` : "—"}</span></div>
      <div class="info-item"><strong>ESRB</strong><span>${escapeHtml(displayValue(game.esrb_rating?.name))}</span></div>
      <div class="info-item"><strong>Avaliações</strong><span>${displayNumber(game.ratings_count)}</span></div>
  `;
}

export function renderPrices(stores) {
  const prices = document.getElementById("game-prices");
  prices.innerHTML = `
      ${stores.length ? stores.map((store) => `
        <div class="price-card">
          <div>
            <strong>${escapeHtml(store.store?.name || store.name || "Loja")}</strong>
            <span>Disponível para compra</span>
          </div>
          <span class="price-pill">Ver loja</span>
        </div>
      `).join("") : '<div class="empty-state">Preço indisponível</div>'}
  `;
}

export function renderRating(gameId, game = {}) {
  const rating = document.getElementById("game-rating");
  const savedRating = Number(localStorage.getItem(`gameverse-rating-${gameId}`) || 0);

  rating.innerHTML = `<div class="rating-summary"><strong>${Number.isFinite(Number(game.rating)) && Number(game.rating) > 0 ? `${Number(game.rating).toFixed(1)} / 5` : "—"}</strong><span>RAWG · ${displayNumber(game.ratings_count)} avaliações</span></div><div class="stars" id="stars" aria-label="Escolha sua nota"></div><p class="rating-help">Sua nota: <strong>${savedRating ? `${savedRating}/5` : "—"}</strong></p>`;

  const starsContainer = document.getElementById("stars");
  const buttons = [];

  for (let index = 0; index < 5; index += 1) {
    const button = document.createElement("button");
    button.className = "star-btn";
    button.type = "button";
    button.innerHTML = "★";

    button.addEventListener("mouseenter", () => {
      buttons.forEach((item, itemIndex) => {
        item.classList.toggle("hovered", itemIndex <= index);
      });
    });

    button.addEventListener("mouseleave", () => {
      buttons.forEach((item, itemIndex) => {
        item.classList.toggle("hovered", itemIndex < savedRating);
      });
    });

    button.addEventListener("click", () => {
      const value = index + 1;
      localStorage.setItem(`gameverse-rating-${gameId}`, String(value));
      renderRating(gameId, game);
    });

    buttons.push(button);
    starsContainer.appendChild(button);
  }

  buttons.forEach((button, index) => {
    button.classList.toggle("active", index < savedRating);
  });
}

export function renderAnalysis(gameId) {
  const analysis = document.getElementById("game-review");
  const savedReview = JSON.parse(localStorage.getItem(`gameverse-analysis-${gameId}`) || "null") || { user: "Visitante", date: new Date().toLocaleDateString("pt-BR"), text: "" };

  if (savedReview.text) {
    analysis.innerHTML = `<article class="review-card"><div class="review-author"><span class="review-avatar">G</span><div><strong>${escapeHtml(savedReview.user || "Visitante")}</strong><span>${escapeHtml(savedReview.date || "")}</span></div></div><p>${escapeHtml(savedReview.text)}</p><div class="analysis-actions"><button type="button" class="btn btn-secondary" id="editAnalysis">Editar</button><button type="button" class="btn btn-secondary" id="deleteAnalysis">Excluir</button></div></article>`;
    document.getElementById("editAnalysis").addEventListener("click", () => {
      localStorage.setItem(`gameverse-analysis-editing-${gameId}`, "true");
      renderAnalysis(gameId);
    });
    document.getElementById("deleteAnalysis").addEventListener("click", () => {
      localStorage.removeItem(`gameverse-analysis-${gameId}`);
      renderAnalysis(gameId);
    });
    if (!localStorage.getItem(`gameverse-analysis-editing-${gameId}`)) return;
    localStorage.removeItem(`gameverse-analysis-editing-${gameId}`);
  }

  analysis.innerHTML = `<form class="analysis-form" id="analysisForm">
      <div class="analysis-meta">
        <input class="analysis-input" id="analysisUser" value="${escapeHtml(savedReview.user || "Visitante")}" placeholder="Seu nome" />
        <span>${escapeHtml(savedReview.date || new Date().toLocaleDateString("pt-BR"))}</span>
      </div>
      <textarea class="analysis-textarea" id="analysisText" placeholder="Escreva sua análise...">${escapeHtml(savedReview.text || "")}</textarea>
      <div class="analysis-actions">
        <button type="submit" class="btn btn-primary">Salvar análise</button>
        <button type="button" class="btn btn-secondary" id="deleteAnalysis">Excluir</button>
      </div>
    </form>`;

  const form = document.getElementById("analysisForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = document.getElementById("analysisText").value;
    const user = document.getElementById("analysisUser").value || "Visitante";
    const payload = { user, date: new Date().toLocaleDateString("pt-BR"), text: value };
    localStorage.setItem(`gameverse-analysis-${gameId}`, JSON.stringify(payload));
    renderAnalysis(gameId);
  });

  document.getElementById("deleteAnalysis").addEventListener("click", () => {
    localStorage.removeItem(`gameverse-analysis-${gameId}`);
    renderAnalysis(gameId);
  });
}

export function renderSimilar(games) {
  const similar = document.getElementById("game-related");
  const uniqueGames = [...new Map(games.filter((game) => game?.id).map((game) => [game.id, game])).values()];
  if (!uniqueGames.length) {
    similar.innerHTML = '<div class="empty-state">Nenhum jogo semelhante encontrado.</div>';
    return;
  }
  similar.innerHTML = `
      ${uniqueGames.slice(0, 8).map((game) => `
        <article class="similar-card" data-id="${game.id}" data-slug="${escapeHtml(game.slug || "")}">
          <img src="${game.background_image || "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80"}" alt="${escapeHtml(game.name)}" loading="lazy" />
          <div class="similar-card-body">
            <h4>${escapeHtml(game.name)}</h4>
            <span>${game.released ? formatDate(game.released) : "Em breve"}</span>
            <span>${game.rating ? `${game.rating.toFixed(1)} ★` : "Sem nota"}</span>
          </div>
        </article>
      `).join("")}
  `;

  similar.querySelectorAll(".similar-card").forEach((card) => {
    card.addEventListener("click", () => {
      const identifier = card.dataset.slug ? `slug=${encodeURIComponent(card.dataset.slug)}` : `id=${card.dataset.id}`;
      window.location.href = `game.html?${identifier}`;
    });
  });

  requestAnimationFrame(() => {
    observeLazyImages();
  });
}

export function renderFooter() {
  const footer = document.getElementById("footer");
  footer.innerHTML = '<p>GameVerse © 2026 · API RAWG integrada</p>';
}

export function renderModal() {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div class="modal" id="imageModal">
        <div class="modal-content">
          <button class="modal-close" id="modalClose">×</button>
          <img src="" alt="Imagem ampliada" />
        </div>
      </div>
    `
  );

  document.getElementById("modalClose").addEventListener("click", () => {
    document.getElementById("imageModal").classList.remove("visible");
  });

  document.getElementById("imageModal").addEventListener("click", (event) => {
    if (event.target.id === "imageModal") {
      document.getElementById("imageModal").classList.remove("visible");
    }
  });
}
