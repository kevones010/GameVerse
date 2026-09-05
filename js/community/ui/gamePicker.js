import { debounce } from "../../utils.js";
import { searchGames } from "../../services/rawgService.js";
import { normalizeGameId, validateMediaUrl } from "../../services/community/communityValidation.js";

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function normalizeGame(game) {
  const id = normalizeGameId(game?.id);
  const name = typeof game?.name === "string" ? game.name.trim() : "";
  if (id === null) return null;
  return {
    id,
    name,
    slug: typeof game.slug === "string" ? game.slug.trim() : "",
    background_image: validateMediaUrl(game.background_image),
    released: typeof game.released === "string" ? game.released : ""
  };
}

function appendGameDetails(container, game) {
  if (game.background_image) {
    const cover = createElement("img", "composer-game-cover");
    cover.src = game.background_image;
    cover.alt = "";
    cover.loading = "lazy";
    cover.addEventListener("error", () => cover.remove(), { once: true });
    container.appendChild(cover);
  }
  const details = createElement("span", "composer-game-details");
  details.appendChild(createElement("span", "composer-game-name", game.name || "Jogo selecionado"));
  if (/^\d{4}-\d{2}-\d{2}$/.test(game.released)) {
    details.appendChild(createElement("span", "composer-game-year", game.released.slice(0, 4)));
  }
  container.appendChild(details);
}

export function createGamePicker() {
  const group = createElement("div", "composer-field composer-game-picker");
  const label = createElement("label", "composer-label", "Jogo relacionado — opcional");
  label.id = "composer-game-label";
  label.htmlFor = "composer-gameId";
  const field = createElement("input");
  field.id = "composer-gameId";
  field.name = "gameId";
  field.type = "text";
  field.placeholder = "Pesquisar jogo...";
  field.autocomplete = "off";
  field.maxLength = 120;
  field.setAttribute("role", "combobox");
  field.setAttribute("aria-autocomplete", "list");
  field.setAttribute("aria-expanded", "false");
  field.setAttribute("aria-controls", "composer-game-results");
  field.setAttribute("aria-describedby", "composer-gameId-hint composer-gameId-error");

  const selectedChip = createElement("div", "composer-game-chip");
  selectedChip.setAttribute("role", "group");
  selectedChip.setAttribute("aria-labelledby", label.id);
  selectedChip.hidden = true;
  const dropdown = createElement("div", "composer-game-dropdown");
  dropdown.hidden = true;
  const status = createElement("p", "composer-game-status");
  status.setAttribute("role", "status");
  const resultsList = createElement("ul", "composer-game-results");
  resultsList.id = "composer-game-results";
  resultsList.setAttribute("role", "listbox");
  resultsList.setAttribute("aria-label", "Jogos encontrados");
  const retryButton = createElement("button", "btn btn-secondary composer-game-retry", "Tentar novamente");
  retryButton.type = "button";
  retryButton.hidden = true;
  dropdown.append(status, resultsList, retryButton);
  const hint = createElement("span", "composer-hint", "Digite pelo menos 2 caracteres. Escolha um resultado ou publique sem jogo.");
  hint.id = "composer-gameId-hint";
  const error = createElement("p", "form-error");
  error.id = "composer-gameId-error";
  error.dataset.fieldError = "gameId";
  error.setAttribute("aria-live", "polite");
  group.append(label, selectedChip, field, dropdown, hint, error);

  let selectedGame = null;
  let results = [];
  let activeIndex = -1;
  let requestToken = 0;
  let active = false;
  let disabled = false;

  function dismiss() {
    requestToken += 1;
    dropdown.hidden = true;
    field.setAttribute("aria-expanded", "false");
    field.removeAttribute("aria-activedescendant");
    resultsList.removeAttribute("aria-busy");
    resultsList.replaceChildren();
    results = [];
    activeIndex = -1;
    retryButton.hidden = true;
  }

  function selectGame(game, focus = true) {
    dismiss();
    selectedGame = normalizeGame(game);
    field.value = "";
    field.hidden = Boolean(selectedGame);
    selectedChip.hidden = !selectedGame;
    selectedChip.replaceChildren();
    if (!selectedGame) {
      if (focus) field.focus();
      return;
    }
    appendGameDetails(selectedChip, selectedGame);
    const remove = createElement("button", "composer-game-remove", "×");
    remove.type = "button";
    remove.disabled = disabled;
    remove.setAttribute("aria-label", `Remover ${selectedGame.name || "jogo selecionado"}`);
    remove.addEventListener("click", () => {
      if (!disabled) selectGame(null);
    });
    selectedChip.appendChild(remove);
    if (focus) remove.focus();
  }

  function setActive(index) {
    if (!results.length) return;
    activeIndex = (index + results.length) % results.length;
    [...resultsList.children].forEach((option, optionIndex) => {
      option.setAttribute("aria-selected", String(optionIndex === activeIndex));
    });
    const option = resultsList.children[activeIndex];
    field.setAttribute("aria-activedescendant", option.id);
    option.scrollIntoView({ block: "nearest" });
  }

  async function performSearch(query, token) {
    if (!active || disabled || token !== requestToken) return;
    try {
      const games = await searchGames(query);
      if (!active || disabled || token !== requestToken) return;
      const seen = new Set();
      results = games.map(normalizeGame).filter((game) => {
        if (!game?.name || seen.has(game.id)) return false;
        seen.add(game.id);
        return true;
      });
      resultsList.removeAttribute("aria-busy");
      status.textContent = results.length ? `${results.length} jogos encontrados.` : "Nenhum jogo encontrado.";
      results.forEach((game, index) => {
        const option = createElement("li", "composer-game-option");
        option.id = `composer-game-option-${token}-${index}`;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        appendGameDetails(option, game);
        option.addEventListener("pointerdown", (event) => event.preventDefault());
        option.addEventListener("click", () => {
          if (active && !disabled && token === requestToken) selectGame(game);
        });
        resultsList.appendChild(option);
      });
    } catch {
      if (!active || disabled || token !== requestToken) return;
      resultsList.removeAttribute("aria-busy");
      status.textContent = "Não foi possível buscar jogos agora.";
      retryButton.hidden = false;
    }
  }

  const scheduleSearch = debounce(performSearch, 350);

  function startSearch(immediate = false) {
    // Invalidate at input time, including the debounce interval and empty queries.
    dismiss();
    const query = field.value.trim();
    if (!active || disabled || selectedGame || query.length < 2) return;
    dropdown.hidden = false;
    field.setAttribute("aria-expanded", "true");
    resultsList.setAttribute("aria-busy", "true");
    status.textContent = "Buscando...";
    if (immediate) void performSearch(query, requestToken);
    else scheduleSearch(query, requestToken);
  }

  field.addEventListener("input", () => startSearch());
  field.addEventListener("focus", () => {
    if (dropdown.hidden && field.value.trim().length >= 2) startSearch();
  });
  field.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (event.key === "Enter") {
      // This field chooses games; Enter must never accidentally publish a post.
      event.preventDefault();
      event.stopPropagation();
      if (!disabled && !dropdown.hidden && activeIndex >= 0) selectGame(results[activeIndex]);
    } else if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      if (dropdown.hidden) startSearch();
      else setActive(activeIndex < 0 ? (event.key === "ArrowDown" ? 0 : results.length - 1) : activeIndex + (event.key === "ArrowDown" ? 1 : -1));
    }
  });
  group.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dropdown.hidden) {
      event.preventDefault();
      event.stopPropagation();
      field.focus();
      dismiss();
    }
  });
  group.addEventListener("focusout", (event) => {
    if (!group.contains(event.relatedTarget)) dismiss();
  });
  retryButton.addEventListener("click", () => {
    field.focus();
    startSearch(true);
  });

  return {
    group,
    field,
    open(game = null) {
      active = true;
      disabled = false;
      field.disabled = false;
      selectGame(game, false);
    },
    close() {
      active = false;
      dismiss();
    },
    setDisabled(value) {
      disabled = Boolean(value);
      field.disabled = disabled;
      group.querySelectorAll("button").forEach((button) => { button.disabled = disabled; });
      if (disabled) dismiss();
    },
    getValue() {
      return {
        gameId: selectedGame?.id ?? null,
        gameName: selectedGame?.name || null,
        gameSlug: selectedGame?.slug || null
      };
    }
  };
}
