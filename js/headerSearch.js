// Busca do topo em todas as páginas.
// - Páginas que já têm busca própria (Home, Categorias): só acrescenta "Enter = ver todos os resultados".
// - Páginas sem busca (Coleção, Comunidade, Perfil, Comparar): cria a caixa de busca com sugestões.
import { getGamesList } from './services/rawgService.js';
import { escapeHtml } from './utils.js';
import { navigateWithVee } from './motion.js';

function catalogUrl(query) {
  return `categorias.html?busca=${encodeURIComponent(query.trim().slice(0, 80))}`;
}

function goToCatalog(query) {
  if (!query.trim()) return;
  // Já estando nas Categorias, usa a busca do próprio catálogo.
  const catalogForm = document.getElementById('catalogSearch');
  const catalogInput = document.getElementById('catalogQuery');
  if (catalogForm && catalogInput) {
    catalogInput.value = query.trim();
    catalogForm.requestSubmit();
    return;
  }
  navigateWithVee(catalogUrl(query));
}

function addEnterToCatalog(input) {
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    document.getElementById('searchSuggestions')?.classList.remove('visible');
    goToCatalog(input.value);
  });
}

function createSearchWidget() {
  const actions = document.querySelector('.topbar .nav-actions');
  const topbar = document.querySelector('.topbar');
  if (!actions || !topbar) return;

  const label = document.createElement('label');
  label.className = 'search-box gv-search';
  label.innerHTML = `
    <span aria-hidden="true">🔎</span>
    <input id="searchInput" type="search" placeholder="Buscar jogos" autocomplete="off"
      aria-label="Buscar jogos" aria-controls="searchSuggestions" aria-expanded="false" />`;
  actions.prepend(label);

  const box = document.createElement('div');
  box.className = 'search-suggestions gv-search-suggestions';
  box.id = 'searchSuggestions';
  topbar.append(box);

  const input = label.querySelector('input');
  let timeoutId = 0;
  let requestId = 0;

  const close = () => {
    box.classList.remove('visible');
    input.setAttribute('aria-expanded', 'false');
  };

  const render = async (value) => {
    const current = ++requestId;
    const results = await getGamesList({ search: value, page_size: 6 });
    if (current !== requestId) return;
    box.innerHTML = `
      ${results.map((game) => `
        <button class="suggestion-item" type="button" data-slug="${escapeHtml(game.slug)}">
          <span>${escapeHtml(game.name)}</span>
          <small>${game.released ? game.released.slice(0, 4) : ''}</small>
        </button>`).join('')}
      <button class="suggestion-item suggestion-all" type="button" data-all>Ver todos os resultados para “${escapeHtml(value)}” →</button>`;
    box.classList.add('visible');
    input.setAttribute('aria-expanded', 'true');
  };

  input.addEventListener('input', () => {
    clearTimeout(timeoutId);
    const value = input.value.trim();
    if (!value) {
      box.innerHTML = '';
      close();
      return;
    }
    timeoutId = setTimeout(() => render(value), 300);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      box.querySelector('.suggestion-item')?.focus();
    } else if (event.key === 'Escape') {
      close();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      close();
      goToCatalog(input.value);
    }
  });

  // Setas para cima/baixo navegam pelas sugestões; Esc volta para o campo.
  box.addEventListener('keydown', (event) => {
    const items = [...box.querySelectorAll('.suggestion-item')];
    const index = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[Math.min(index + 1, items.length - 1)]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      (index <= 0 ? input : items[index - 1]).focus();
    } else if (event.key === 'Escape') {
      close();
      input.focus();
    }
  });

  box.addEventListener('click', (event) => {
    const item = event.target.closest('.suggestion-item');
    if (!item) return;
    close();
    if (item.hasAttribute('data-all')) {
      goToCatalog(input.value);
      return;
    }
    navigateWithVee(`game.html?slug=${encodeURIComponent(item.dataset.slug)}`);
  });

  document.addEventListener('click', (event) => {
    if (!label.contains(event.target) && !box.contains(event.target)) close();
  });
}

const existing = document.getElementById('searchInput');
if (existing) {
  addEnterToCatalog(existing);
} else {
  createSearchWidget();
}
