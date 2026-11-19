// Painel de acessibilidade + melhorias básicas (pular para o conteúdo e cards via teclado).
// As preferências são lidas/aplicadas por js/a11y-boot.js, que roda antes no <head>.

const a11y = window.GameVerseA11y;

const CLICKABLE_CARDS = ".card[data-slug], .card[data-id], .similar-card, .screenshot-card";

const ACCESSIBILITY_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="4" r="2" fill="currentColor"/>
    <path d="M4 8.5c2.6.7 5.3 1 8 1s5.4-.3 8-1M12 9.5v5m0 0-3 6.5m3-6.5 3 6.5"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

function radioGroup(name, legend, options, current) {
  return `
    <fieldset class="a11y-group">
      <legend>${legend}</legend>
      <div class="a11y-segmented">
        ${options.map(([value, label]) => `
          <label>
            <input type="radio" name="${name}" value="${value}" ${String(current) === String(value) ? "checked" : ""} />
            <span>${label}</span>
          </label>`).join("")}
      </div>
    </fieldset>`;
}

function switchRow(name, label, hint, checked) {
  return `
    <label class="a11y-switch">
      <span class="a11y-switch-text">
        <strong>${label}</strong>
        <small>${hint}</small>
      </span>
      <input type="checkbox" role="switch" name="${name}" ${checked ? "checked" : ""} />
      <span class="a11y-switch-track" aria-hidden="true"></span>
    </label>`;
}

function renderPanelContent(settings) {
  const systemMotion = a11y.systemPrefersReducedMotion();
  return `
    <div class="a11y-panel-header">
      <h2 id="a11yTitle">Acessibilidade</h2>
      <button type="button" class="a11y-close" data-a11y-close aria-label="Fechar painel de acessibilidade">✕</button>
    </div>
    <form class="a11y-form" id="a11yForm">
      ${radioGroup("textSize", "Tamanho do texto", [[0, "A"], [1, "A+"], [2, "A++"]], settings.textSize)}
      ${radioGroup("font", "Fonte", [["default", "Padrão"], ["legible", "Legível"], ["dyslexic", "Dislexia"]], settings.font)}
      ${radioGroup("color", "Cores", [["normal", "Normal"], ["low", "Suaves"], ["gray", "Cinza"]], settings.color)}
      <div class="a11y-switches">
        ${switchRow("contrast", "Alto contraste", "Fundo preto, texto branco e destaques em amarelo.", settings.contrast)}
        ${switchRow("reduceMotion", "Reduzir animações", systemMotion ? "Seu sistema já pede menos movimento." : "Pausa carrossel, transições e efeitos.", settings.reduceMotion)}
        ${switchRow("spacing", "Espaçamento maior", "Mais espaço entre linhas, letras e palavras.", settings.spacing)}
        ${switchRow("links", "Destacar links e foco", "Sublinha links e reforça o contorno do teclado.", settings.links)}
      </div>
      <p class="a11y-status" role="status" aria-live="polite"></p>
      <button type="button" class="a11y-reset" data-a11y-reset>Restaurar padrão</button>
    </form>`;
}

function readForm(form) {
  const data = new FormData(form);
  return a11y.normalize({
    textSize: Number(data.get("textSize")),
    font: data.get("font"),
    color: data.get("color"),
    contrast: data.has("contrast"),
    reduceMotion: data.has("reduceMotion"),
    spacing: data.has("spacing"),
    links: data.has("links")
  });
}

function setupPanel() {
  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "a11y-fab";
  fab.setAttribute("aria-label", "Abrir opções de acessibilidade");
  fab.setAttribute("aria-expanded", "false");
  fab.setAttribute("aria-controls", "a11yPanel");
  fab.title = "Acessibilidade (Alt + A)";
  fab.innerHTML = ACCESSIBILITY_ICON;

  const panel = document.createElement("section");
  panel.className = "a11y-panel";
  panel.id = "a11yPanel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-labelledby", "a11yTitle");

  const render = () => {
    panel.innerHTML = renderPanelContent(a11y.read());
  };

  const announce = (message) => {
    const status = panel.querySelector(".a11y-status");
    if (status) status.textContent = message;
  };

  const open = () => {
    render();
    panel.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    panel.querySelector("input:checked, input")?.focus();
  };

  const close = ({ returnFocus = true } = {}) => {
    if (panel.hidden) return;
    panel.hidden = true;
    fab.setAttribute("aria-expanded", "false");
    if (returnFocus) fab.focus();
  };

  fab.addEventListener("click", () => (panel.hidden ? open() : close()));

  panel.addEventListener("change", (event) => {
    const form = event.target.closest("form");
    if (!form) return;
    const settings = a11y.apply(readForm(form));
    announce(a11y.save(settings) ? "Preferência salva." : "Aplicado só nesta página: o navegador não deixou salvar.");
  });

  panel.addEventListener("click", (event) => {
    if (event.target.closest("[data-a11y-close]")) {
      close();
      return;
    }
    if (event.target.closest("[data-a11y-reset]")) {
      const settings = a11y.apply(a11y.DEFAULTS);
      a11y.save(settings);
      render();
      announce("Configurações restauradas.");
      panel.querySelector("[data-a11y-reset]")?.focus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      close();
    }
    if (event.altKey && (event.key === "a" || event.key === "A")) {
      event.preventDefault();
      panel.hidden ? open() : close();
    }
  });

  document.addEventListener("click", (event) => {
    if (!panel.hidden && !panel.contains(event.target) && !fab.contains(event.target)) {
      close({ returnFocus: false });
    }
  });

  document.body.append(fab, panel);
}

function setupSkipLink() {
  const main = document.querySelector("main");
  if (!main) return;
  if (!main.id) main.id = "conteudo";
  main.setAttribute("tabindex", "-1");

  const link = document.createElement("a");
  link.className = "skip-link";
  link.href = `#${main.id}`;
  link.textContent = "Pular para o conteúdo";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    main.focus();
    main.scrollIntoView({ block: "start" });
  });
  document.body.prepend(link);
}

// Os cards de jogo são <article> com clique; aqui eles ganham foco e Enter/Espaço.
function enhanceCards(root = document) {
  root.querySelectorAll(CLICKABLE_CARDS).forEach((card) => {
    if (card.matches("a, button") || card.hasAttribute("tabindex")) return;
    card.tabIndex = 0;
    const isImage = card.classList.contains("screenshot-card");
    card.setAttribute("role", isImage ? "button" : "link");
    const name = card.querySelector("h3, strong")?.textContent.trim() || card.querySelector("img")?.alt;
    card.setAttribute("aria-label", isImage ? "Ampliar captura de tela" : name || "Abrir jogo");
  });
}

function setupKeyboardCards() {
  enhanceCards();
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhanceCards();
      labelCommonControls();
    });
  }).observe(document.body, { childList: true, subtree: true });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target;
    if (!(card instanceof Element) || !card.matches(CLICKABLE_CARDS)) return;
    event.preventDefault();
    card.click();
  });
}

// Pequenos ajustes de semântica que valem para todas as páginas.
function labelCommonControls() {
  document.querySelectorAll("#searchInput:not([aria-label])").forEach((input) => {
    input.setAttribute("aria-label", "Buscar jogos");
  });
  document.querySelectorAll("nav.navbar:not([aria-label])").forEach((nav) => {
    nav.setAttribute("aria-label", "Navegação principal");
  });
  document.querySelectorAll(".nav-btn.active:not([aria-current])").forEach((link) => {
    link.setAttribute("aria-current", "page");
  });
}

if (a11y) {
  setupSkipLink();
  setupPanel();
  labelCommonControls();
  setupKeyboardCards();
}
