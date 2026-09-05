const TABS = [
  { value: "for-you", label: "Para você" },
  { value: "trending", label: "Em alta" },
  { value: "recent", label: "Recentes" },
  { value: "saved", label: "Salvos" }
];

const TYPES = [
  { value: "all", label: "Todos" },
  { value: "guide", label: "Guias" },
  { value: "art", label: "Artes" },
  { value: "screenshot", label: "Screenshots" },
  { value: "discussion", label: "Discussões" },
  { value: "question", label: "Perguntas" }
];

function createFilterButton(item, groupName, onSelect) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = groupName === "tab" ? "community-tab" : "community-filter";
  button.dataset.value = item.value;
  button.textContent = item.label;
  button.addEventListener("click", () => onSelect(item.value));
  return button;
}

export function createPostFilters({ tabsContainer, typesContainer, onChange }) {
  const state = { tab: "for-you", type: "all" };

  const updateButtons = () => {
    tabsContainer.querySelectorAll("button").forEach((button) => {
      const isActive = button.dataset.value === state.tab;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
    typesContainer.querySelectorAll("button").forEach((button) => {
      const isActive = button.dataset.value === state.type;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  };

  const notify = () => {
    updateButtons();
    onChange({ ...state });
  };

  TABS.forEach((item) => {
    tabsContainer.appendChild(createFilterButton(item, "tab", (value) => {
      if (state.tab === value) return;
      state.tab = value;
      notify();
    }));
  });

  TYPES.forEach((item) => {
    typesContainer.appendChild(createFilterButton(item, "type", (value) => {
      if (state.type === value) return;
      state.type = value;
      notify();
    }));
  });

  updateButtons();

  return {
    getState() {
      return { ...state };
    },
    setType(type) {
      state.type = TYPES.some((item) => item.value === type) ? type : "all";
      notify();
    },
    setTab(tab) {
      state.tab = TABS.some((item) => item.value === tab) ? tab : "for-you";
      notify();
    },
    setState(nextState = {}) {
      state.tab = TABS.some((item) => item.value === nextState.tab) ? nextState.tab : state.tab;
      state.type = TYPES.some((item) => item.value === nextState.type) ? nextState.type : state.type;
      notify();
    }
  };
}
