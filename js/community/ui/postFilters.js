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

export function createPostFilters({
  tabsContainer,
  typesContainer,
  onChange,
  tabs = TABS,
  types = TYPES,
  initialState = {}
}) {
  const state = {
    tab: tabs.some((item) => item.value === initialState.tab) ? initialState.tab : tabs[0].value,
    type: types.some((item) => item.value === initialState.type) ? initialState.type : types[0].value
  };

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

  tabs.forEach((item) => {
    tabsContainer.appendChild(createFilterButton(item, "tab", (value) => {
      if (state.tab === value) return;
      state.tab = value;
      notify();
    }));
  });

  types.forEach((item) => {
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
      state.type = types.some((item) => item.value === type) ? type : types[0].value;
      notify();
    },
    setTab(tab) {
      state.tab = tabs.some((item) => item.value === tab) ? tab : tabs[0].value;
      notify();
    },
    setState(nextState = {}) {
      state.tab = tabs.some((item) => item.value === nextState.tab) ? nextState.tab : state.tab;
      state.type = types.some((item) => item.value === nextState.type) ? nextState.type : state.type;
      notify();
    }
  };
}
