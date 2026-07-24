import { escapeHtml, formatDate, buildYouTubeEmbed } from "./utils.js";

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
      section.innerHTML = `<div class="skeleton-block"></div>`;
      section.classList.add("is-loading");
    }
  });
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
        <a href="#" class="nav-btn">Favoritos</a>
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
      .map((item) => `<button class="suggestion-item" data-id="${item.id}">${escapeHtml(item.name)}</button>`)
      .join("");

    suggestionsBox.innerHTML = html;
    suggestionsBox.classList.toggle("visible", Boolean(html));
  };

  searchInput.addEventListener("input", updateSuggestions);
  searchInput.addEventListener("focus", updateSuggestions);
  suggestionsBox.addEventListener("click", (event) => {
    const target = event.target.closest(".suggestion-item");
    if (!target) return;
    const id = target.getAttribute("data-id");
    if (id) {
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

  hero.innerHTML = `
    <div class="hero-content">
      <span class="hero-badge">${escapeHtml(game.parent_platforms?.[0]?.platform?.name || "Novo destaque")}</span>
      <h1 class="hero-title">${escapeHtml(game.name || "Jogo em destaque")}</h1>
      <p class="hero-subtitle">${escapeHtml(game.tagline || game.description_raw?.slice(0, 180) || "Explore uma experiência imersiva carregada pela RAWG API.")}</p>
    </div>
    <article class="hero-floating-card">
      <img class="hero-poster" src="${poster}" alt="Poster de ${escapeHtml(game.name)}" loading="lazy" />
      <div class="hero-card-body">
        <h2 class="hero-card-title">${escapeHtml(game.name)}</h2>
        <div class="hero-meta">
          <span>${game.released ? formatDate(game.released) : "Em breve"}</span>
          <span>${game.developers?.[0]?.name || "Em breve"}</span>
          <span>${game.publishers?.[0]?.name || "Em breve"}</span>
          <span>${game.rating ? `${game.rating.toFixed(1)} / 5` : "Sem nota"}</span>
        </div>
        <div class="hero-tags">
          ${(game.genres || []).map((genre) => `<span>${escapeHtml(genre.name)}</span>`).join("")}
        </div>
        <div class="hero-tags">
          ${(game.platforms || []).map((platform) => `<span>${escapeHtml(platform.platform.name)}</span>`).join("")}
        </div>
        <div class="hero-actions">
          <button class="btn btn-primary">★ Favoritar</button>
          <button class="btn btn-secondary">↗ Compartilhar</button>
          <button class="btn btn-secondary">▶ Trailer</button>
        </div>
      </div>
    </article>
  `;

  hero.style.backgroundImage = `url(${background})`;
  hero.classList.add("is-visible");
}

export function renderSynopsis(game) {
  const synopsis = document.getElementById("synopsis");
  synopsis.innerHTML = `
    <div class="section-heading">
      <h2>Sobre o jogo</h2>
    </div>
    <p class="synopsis-copy">${escapeHtml(game.description_raw || "Descrição ainda não disponível.")}</p>
  `;
}

export function renderTrailer(trailer, gameName) {
  const trailerSection = document.getElementById("trailer");
  if (!trailer) {
    trailerSection.innerHTML = `
      <div class="section-heading">
        <h2>Trailer</h2>
        <p>Não há trailer oficial disponível</p>
      </div>
      <div class="trailer-placeholder">
        <p>Buscaremos uma prévia no YouTube para ${escapeHtml(gameName)}.</p>
        <a class="btn btn-secondary" href="https://www.youtube.com/results?search_query=${encodeURIComponent(`${gameName} official trailer`) }" target="_blank" rel="noreferrer">Assistir no YouTube</a>
      </div>
    `;
    return;
  }

  trailerSection.innerHTML = `
    <div class="section-heading">
      <h2>Trailer</h2>
      <p>Prévia oficial</p>
    </div>
    <div class="video-frame">
      <iframe src="${buildYouTubeEmbed(trailer.data?.[0]?.youtube_id || trailer.video_id || trailer.id)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    </div>
  `;
}

export function renderScreenshots(screenshots) {
  const screenshotsSection = document.getElementById("screenshots");
  screenshotsSection.innerHTML = `
    <div class="section-heading">
      <h2>Screenshots</h2>
      <p>Capturas da experiência</p>
    </div>
    <div class="screenshot-list">
      ${screenshots.map((shot) => `
        <article class="screenshot-card" data-image="${shot.image}">
          <img src="${shot.image}" alt="Screenshot" loading="lazy" />
        </article>
      `).join("")}
    </div>
  `;

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
  const info = document.getElementById("info");
  info.innerHTML = `
    <div class="section-heading">
      <h3>Informações</h3>
    </div>
    <div class="info-grid">
      <div class="info-item"><strong>Data</strong><span>${game.released ? formatDate(game.released) : "Em breve"}</span></div>
      <div class="info-item"><strong>Publisher</strong><span>${game.publishers?.[0]?.name || "Em breve"}</span></div>
      <div class="info-item"><strong>Developer</strong><span>${game.developers?.[0]?.name || "Em breve"}</span></div>
      <div class="info-item"><strong>Website</strong><span>${game.website ? `<a href="${game.website}" target="_blank">Abrir</a>` : "Em breve"}</span></div>
      <div class="info-item"><strong>Metacritic</strong><span>${game.metacritic || "—"}</span></div>
      <div class="info-item"><strong>RAWG Rating</strong><span>${game.rating ? `${game.rating.toFixed(1)}/5` : "—"}</span></div>
      <div class="info-item"><strong>ESRB</strong><span>${game.esrb_rating?.name || "—"}</span></div>
      <div class="info-item"><strong>Avaliações</strong><span>${game.ratings_count || 0}</span></div>
    </div>
  `;
}

export function renderPrices(stores) {
  const prices = document.getElementById("prices");
  prices.innerHTML = `
    <div class="section-heading">
      <h3>Preço</h3>
      <p>Disponível em lojas</p>
    </div>
    <div class="prices-grid">
      ${stores.length ? stores.map((store) => `
        <div class="price-card">
          <div>
            <strong>${escapeHtml(store.store.name)}</strong>
            <span>Disponível para compra</span>
          </div>
          <span class="price-pill">Ver loja</span>
        </div>
      `).join("") : '<div class="empty-state">Lojas ainda não disponíveis.</div>'}
    </div>
  `;
}

export function renderRating(gameId) {
  const rating = document.getElementById("rating");
  const savedRating = Number(localStorage.getItem(`gameverse-rating-${gameId}`) || 0);

  rating.innerHTML = `
    <div class="section-heading">
      <h3>Avaliação do usuário</h3>
    </div>
    <div class="stars" id="stars"></div>
    <p class="rating-help">Sua nota: <strong>${savedRating ? "★".repeat(savedRating) : "—"}</strong></p>
  `;

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
      renderRating(gameId);
    });

    buttons.push(button);
    starsContainer.appendChild(button);
  }

  buttons.forEach((button, index) => {
    button.classList.toggle("active", index < savedRating);
  });
}

export function renderAnalysis(gameId) {
  const analysis = document.getElementById("analysis");
  const savedReview = localStorage.getItem(`gameverse-analysis-${gameId}`) || "";

  analysis.innerHTML = `
    <div class="section-heading">
      <h2>Análise</h2>
      <p>Salve sua opinião para este jogo</p>
    </div>
    <form class="analysis-form" id="analysisForm">
      <textarea class="analysis-textarea" id="analysisText" placeholder="Escreva sua análise...">${escapeHtml(savedReview)}</textarea>
      <button type="submit" class="btn btn-primary">Publicar análise</button>
    </form>
  `;

  const form = document.getElementById("analysisForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = document.getElementById("analysisText").value;
    localStorage.setItem(`gameverse-analysis-${gameId}`, value);
    form.querySelector("button").textContent = "Análise salva";
  });
}

export function renderSimilar(games) {
  const similar = document.getElementById("similar");
  similar.innerHTML = `
    <div class="section-heading">
      <h2>Jogos similares</h2>
      <p>Explore mais experiências</p>
    </div>
    <div class="similar-list">
      ${games.slice(0, 8).map((game) => `
        <article class="similar-card" data-id="${game.id}">
          <img src="${game.background_image || "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80"}" alt="${escapeHtml(game.name)}" loading="lazy" />
          <div class="similar-card-body">
            <h4>${escapeHtml(game.name)}</h4>
            <span>${game.released ? formatDate(game.released) : "Em breve"}</span>
            <span>${game.rating ? `${game.rating.toFixed(1)} ★` : "Sem nota"}</span>
          </div>
        </article>
      `).join("")}
    </div>
  `;

  similar.querySelectorAll(".similar-card").forEach((card) => {
    card.addEventListener("click", () => {
      window.location.href = `game.html?id=${card.dataset.id}`;
    });
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
