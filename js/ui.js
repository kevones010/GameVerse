import { escapeHtml, formatDate, observeLazyImages } from "./utils.js";
import { DESCRIPTION_BY_SLUG } from "../data/descriptions-pt.js";
import { navigateWithVee } from "./motion.js";
import { readFavorites, readRating, readAnalysis, writePersonalData, removePersonalData } from "./services/gameStorage.js";
import { translateToPortuguese } from "./services/translationService.js";
import { GAME_STATUSES, getGameStatus, setGameStatus, gameSnapshot, readCollection } from "./services/collectionStorage.js";

function storageNotice(container, message) {
  let notice = container.querySelector("[data-storage-notice]");
  if (!notice) {
    notice = document.createElement("p");
    notice.dataset.storageNotice = "";
    notice.setAttribute("role", "status");
    container.appendChild(notice);
  }
  notice.textContent = message;
}

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

export function renderHeader(game) {
  const header = document.getElementById("header");
  header.innerHTML = `
    <nav class="navbar">
      <a href="index.html" class="brand">
        <span class="brand-mark"><img src="assets/brand/vee-logo-head.png" alt="Vee, mascote do GameVerse" /></span>
        <span>GameVerse</span>
      </a>
      <div class="nav-actions">
        <label class="search-box">
          <span>🔎</span>
          <input id="searchInput" type="text" placeholder="Buscar jogos" autocomplete="off" />
        </label>
        <a href="index.html" class="nav-btn">Home</a>
        <a href="categorias.html" class="nav-btn">Categorias</a>
        <a href="comunidade.html" class="nav-btn">Comunidade</a>
        <a href="favoritos.html" class="nav-btn">Coleção</a>
        <div class="profile-pill">
          <span class="profile-avatar"><img src="assets/brand/vee-avatar-happy.webp" alt="Avatar Vee" /></span>
          <span>Guest</span>
        </div>
      </div>
    </nav>
    <div class="search-suggestions" id="searchSuggestions"></div>
  `;

  if (game) {
    document.title = `${game.name} | GameVerse`;
  }
}

export function renderSearchSuggestions(suggestions = []) {
  const box = document.getElementById("searchSuggestions");
  box.innerHTML = suggestions.map(item => `<button type="button" class="suggestion-item" data-id="${item.id}">${escapeHtml(item.name)}</button>`).join("");
  box.classList.toggle("visible", Boolean(suggestions.length));
}

export function renderHero(game) {
  const hero = document.getElementById("hero");
  const background = game.background_image_additional || game.background_image || "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1600&q=80";
  const poster = game.background_image || game.background_image_additional || "https://images.unsplash.com/photo-1511882150382-421056c89033?auto=format&fit=crop&w=800&q=80";
  const { value: favorites, available } = readFavorites();
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
  favoriteButton.setAttribute("aria-pressed", String(isFavorite));
  favoriteButton.disabled = !available;
  if (!available) favoriteButton.textContent = "Favoritos indisponíveis";
  favoriteButton.onclick = () => {
    const { value: favorites, available } = readFavorites();
    if (!available) { renderHero(game); return; }
    const exists = favorites.some((item) => item.id === game.id);
    // O favorito guarda nome e imagem para a página "Minha coleção" abrir sem esperar a RAWG.
    const next = exists ? favorites.filter((item) => item.id !== game.id) : [...favorites, gameSnapshot(game)];
    if (!writePersonalData("gameverse-favorites", JSON.stringify(next))) {
      favoriteButton.textContent = "Não foi possível salvar favorito";
      return;
    }
    renderHero(game);
  };
  const shareButton = document.getElementById("shareButton");
  shareButton.onclick = async () => {
    let copied = false;
    try {
      await navigator.clipboard.writeText(window.location.href);
      copied = true;
    } catch { /* área de transferência indisponível (ex.: página sem foco) */ }
    shareButton.textContent = copied ? "✓ Link copiado" : "Copie o endereço da página";
    setTimeout(() => { shareButton.textContent = "↗ Compartilhar"; }, 2200);
  };
  const compareLink = document.getElementById("compareLink");
  if (compareLink) compareLink.href = `comparar.html?a=${encodeURIComponent(game.slug || game.id)}`;
  renderStatusPicker(game);
  document.getElementById("trailerButton").onclick = () => document.getElementById("trailer").scrollIntoView({ behavior: "smooth" });
}

export function renderStatusPicker(game) {
  const container = document.getElementById("gameStatus");
  if (!container) return;
  const { available } = readCollection();
  const current = getGameStatus(game.id);

  container.innerHTML = `
    <span class="status-label" id="gameStatusLabel">Na sua coleção:</span>
    ${GAME_STATUSES.map((status) => `
      <button type="button" class="status-btn status-btn--${status.id} ${current === status.id ? "is-active" : ""}"
        data-status="${status.id}" aria-pressed="${current === status.id}" ${available ? "" : "disabled"}>
        <span aria-hidden="true">${status.icon}</span> ${status.label}
      </button>`).join("")}
    <span class="status-feedback" role="status" aria-live="polite"></span>
  `;

  container.querySelectorAll(".status-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const result = setGameStatus(game, button.dataset.status);
      renderStatusPicker(game);
      const feedback = container.querySelector(".status-feedback");
      if (!result.ok) {
        feedback.textContent = "Não foi possível salvar agora.";
        return;
      }
      const info = GAME_STATUSES.find((status) => status.id === result.status);
      feedback.textContent = info ? `Marcado como “${info.label}”.` : "Removido da coleção.";
      container.querySelector(`[data-status="${button.dataset.status}"]`)?.focus();
    });
  });
}

export function renderSynopsis(game) {
  const descriptionEl = document.getElementById("game-description");
  const handwritten = DESCRIPTION_BY_SLUG[game.slug];
  const original = String(game.description_raw || "").replace(/<[^>]*>/g, "").trim();

  let status = document.getElementById("synopsisStatus");
  if (!status) {
    status = document.createElement("div");
    status.id = "synopsisStatus";
    status.className = "synopsis-status";
    status.setAttribute("role", "status");
    descriptionEl.insertAdjacentElement("afterend", status);
  }

  if (!original) {
    descriptionEl.textContent = handwritten || "Descrição ainda não disponível.";
    status.innerHTML = "";
    return;
  }

  // Enquanto traduz, mostra o resumo em português (se existir) ou o original.
  descriptionEl.textContent = handwritten || original;
  descriptionEl.lang = handwritten ? "pt-BR" : "en";
  status.innerHTML = '<span class="synopsis-spinner" aria-hidden="true"></span> Traduzindo a sinopse para português…';

  const showTranslation = (text, provider) => {
    let showingOriginal = false;
    const render = () => {
      descriptionEl.textContent = showingOriginal ? original : text;
      descriptionEl.lang = showingOriginal ? "en" : "pt-BR";
      const label = provider === "chrome" ? "tradutor do navegador" : provider === "mymemory" ? "MyMemory" : "salva neste navegador";
      status.innerHTML = `🌐 Tradução automática (${label}). <button type="button" class="synopsis-toggle">${showingOriginal ? "Ver em português" : "Ver original em inglês"}</button>`;
      status.querySelector(".synopsis-toggle").addEventListener("click", () => {
        showingOriginal = !showingOriginal;
        render();
      });
    };
    render();
  };

  const run = async (allowDownload = false) => {
    try {
      const result = await translateToPortuguese(original, {
        cacheKey: `jogo-${game.id}`,
        allowDownload,
        onProgress: (loaded) => {
          status.innerHTML = `<span class="synopsis-spinner" aria-hidden="true"></span> Baixando o tradutor do navegador… ${Math.round((loaded || 0) * 100)}%`;
        }
      });
      if (result.needsDownload) {
        status.innerHTML = `${handwritten ? "" : "Sinopse em inglês. "}<button type="button" class="synopsis-toggle">🌐 Traduzir para português</button> <small>(o navegador baixa o tradutor uma vez só)</small>`;
        status.querySelector(".synopsis-toggle").addEventListener("click", () => {
          status.innerHTML = '<span class="synopsis-spinner" aria-hidden="true"></span> Preparando o tradutor…';
          run(true);
        });
        return;
      }
      showTranslation(result.text, result.provider);
    } catch {
      if (handwritten) {
        // Mantém o resumo em português e oferece o texto completo em inglês.
        status.innerHTML = 'Resumo em português. <button type="button" class="synopsis-toggle">Ler descrição completa (inglês)</button>';
        status.querySelector(".synopsis-toggle").addEventListener("click", () => {
          descriptionEl.textContent = original;
          descriptionEl.lang = "en";
          status.innerHTML = "";
        });
        return;
      }
      status.innerHTML = 'Sinopse original em inglês: não foi possível traduzir agora. <button type="button" class="synopsis-toggle">Tentar de novo</button>';
      status.querySelector(".synopsis-toggle").addEventListener("click", () => {
        status.innerHTML = '<span class="synopsis-spinner" aria-hidden="true"></span> Traduzindo…';
        run(true);
      });
    }
  };
  run(false);
}

export function renderTrailer(trailers, game, youtubeTrailer = null) {
  const trailerSection = document.getElementById("game-trailer");
  const trailer = (Array.isArray(trailers) ? trailers : []).find((item) => item?.data?.max || item?.data?.["480"]);

  if (trailer) {
    const videoUrl = trailer.data.max || trailer.data["480"];
    const poster = trailer.preview || game?.background_image || game?.background_image_additional || "";
    const posterAttribute = poster ? ` poster="${escapeHtml(poster)}"` : "";
    const trailerName = trailer.name || `Trailer de ${game?.name || "jogo"}`;

    trailerSection.innerHTML = `<div class="video-frame">
        <video controls preload="metadata" playsinline${posterAttribute} aria-label="${escapeHtml(trailerName)}">
          <source src="${escapeHtml(videoUrl)}" type="video/mp4" />
          Seu navegador não oferece suporte à reprodução deste vídeo.
        </video>
      </div>
    `;
    return;
  }

  if (youtubeTrailer?.videoId && youtubeTrailer?.embedUrl) {
    trailerSection.innerHTML = `<div class="video-frame">
        <iframe
          src="${escapeHtml(youtubeTrailer.embedUrl)}"
          title="${escapeHtml(youtubeTrailer.title || `Trailer de ${game?.name || "jogo"}`)}"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
    `;
    return;
  }

  trailerSection.innerHTML = `
    <div class="trailer-placeholder">
      <p>Trailer ainda não disponível para este jogo.</p>
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

export function renderPrices(stores, game = {}) {
  const prices = document.getElementById("game-prices");
  // O endpoint /stores traz só store_id + url; o nome da loja vem em game.stores.
  const urlByStoreId = new Map(stores.map((item) => [item.store_id, item.url]));
  const items = (game.stores || [])
    .filter((item) => item?.store?.name)
    .map((item) => ({ name: item.store.name, url: safeExternalUrl(urlByStoreId.get(item.store.id)) }));

  prices.innerHTML = items.length ? items.map((item) => {
    const content = `
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span>Disponível para compra</span>
          </div>
          <span class="price-pill">${item.url ? "Ver loja" : "Sem link"}</span>`;
    return item.url
      ? `<a class="price-card" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${content}</a>`
      : `<div class="price-card">${content}</div>`;
  }).join("") : '<div class="empty-state">Nenhuma loja informada para este jogo.</div>';
}

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

export function renderRating(gameId, game = {}) {
  const rating = document.getElementById("game-rating");
  const { value: savedRating, available } = readRating(gameId);

  rating.innerHTML = `<div class="rating-summary"><strong>${Number.isFinite(Number(game.rating)) && Number(game.rating) > 0 ? `${Number(game.rating).toFixed(1)} / 5` : "—"}</strong><span>RAWG · ${displayNumber(game.ratings_count)} avaliações</span></div><div class="stars" id="stars" aria-label="Escolha sua nota"></div><p class="rating-help">Sua nota: <strong>${savedRating ? `${savedRating}/5` : "—"}</strong></p>`;

  const starsContainer = document.getElementById("stars");
  const buttons = [];

  for (let index = 0; index < 5; index += 1) {
    const button = document.createElement("button");
    button.className = "star-btn";
    button.type = "button";
    button.disabled = !available;
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
      if (!writePersonalData(`gameverse-rating-${gameId}`, String(value))) {
        storageNotice(rating, "Não foi possível salvar sua nota agora.");
        return;
      }
      renderRating(gameId, game);
    });

    buttons.push(button);
    starsContainer.appendChild(button);
  }

  buttons.forEach((button, index) => {
    button.classList.toggle("active", index < savedRating);
  });
  if (!available) storageNotice(rating, "Sua nota local não pôde ser carregada.");
}

export function renderAnalysis(gameId, editing = false) {
  const analysis = document.getElementById("game-review");
  const stored = readAnalysis(gameId);
  const savedReview = stored.value || { user: "Visitante", date: new Date().toLocaleDateString("pt-BR"), text: "" };
  const deleteReview = () => {
    if (!removePersonalData(`gameverse-analysis-${gameId}`)) {
      storageNotice(analysis, "Não foi possível excluir sua análise agora.");
      return;
    }
    renderAnalysis(gameId);
  };

  if (savedReview.text && !editing) {
    analysis.innerHTML = `<article class="review-card"><div class="review-author"><span class="review-avatar">G</span><div><strong>${escapeHtml(savedReview.user || "Visitante")}</strong><span>${escapeHtml(savedReview.date || "")}</span></div></div><p>${escapeHtml(savedReview.text)}</p><div class="analysis-actions"><a class="btn btn-primary" id="publishAnalysis" href="comunidade-jogo.html?gameId=${encodeURIComponent(gameId)}&publicarAnalise=1&nome=${encodeURIComponent(document.getElementById("game-title")?.textContent || "")}">📣 Publicar na comunidade</a><button type="button" class="btn btn-secondary" id="editAnalysis">Editar</button><button type="button" class="btn btn-secondary" id="deleteAnalysis">Excluir</button></div></article>`;
    document.getElementById("editAnalysis").addEventListener("click", () => {
      renderAnalysis(gameId, true);
    });
    document.getElementById("deleteAnalysis").addEventListener("click", deleteReview);
    return;
  }

  analysis.innerHTML = `<form class="analysis-form" id="analysisForm">
      <div class="analysis-meta">
        <input class="analysis-input" id="analysisUser" value="${escapeHtml(savedReview.user || "Visitante")}" placeholder="Seu nome" />
        <span>${escapeHtml(savedReview.date || new Date().toLocaleDateString("pt-BR"))}</span>
      </div>
      <textarea class="analysis-textarea" id="analysisText" placeholder="Escreva sua análise...">${escapeHtml(savedReview.text || "")}</textarea>
      <div class="analysis-actions">
        <button type="submit" class="btn btn-primary">Salvar análise</button>
        ${editing ? '<button type="button" class="btn btn-secondary" id="cancelAnalysis">Cancelar</button>' : ""}
      </div>
    </form>`;

  const form = document.getElementById("analysisForm");
  if (!stored.available) {
    [...form.elements].forEach(field => { field.disabled = true; });
    storageNotice(analysis, "Sua análise local não pôde ser carregada. Os dados foram preservados.");
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!readAnalysis(gameId).available) return;
    const value = document.getElementById("analysisText").value;
    const user = document.getElementById("analysisUser").value || "Visitante";
    const payload = { user, date: new Date().toLocaleDateString("pt-BR"), text: value };
    if (!writePersonalData(`gameverse-analysis-${gameId}`, JSON.stringify(payload))) {
      storageNotice(analysis, "Não foi possível salvar sua análise agora.");
      return;
    }
    renderAnalysis(gameId);
  });

  document.getElementById("cancelAnalysis")?.addEventListener("click", () => renderAnalysis(gameId));
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
      navigateWithVee(`game.html?${identifier}`);
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
