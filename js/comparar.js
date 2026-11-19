import { getGame, getGamesList } from './services/rawgService.js';
import { escapeHtml } from './utils.js';

// Comparação lado a lado de dois jogos. Os jogos ficam no endereço: comparar.html?a=<slug>&b=<slug>.
const SIDES = ['a', 'b'];
const games = { a: null, b: null };

function formatDate(released) {
  if (!released) return 'A definir';
  return new Date(`${released}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function names(list, pick) {
  return (list || []).map(pick).filter(Boolean);
}

function writeUrl() {
  const params = new URLSearchParams();
  SIDES.forEach((side) => {
    if (games[side]) params.set(side, games[side].slug || String(games[side].id));
  });
  const query = params.toString();
  window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}

function renderPicked(side) {
  const slot = document.querySelector(`[data-side="${side}"] .compare-picked`);
  const game = games[side];
  if (!game) {
    slot.innerHTML = `
      <div class="compare-placeholder">
        <img src="assets/vee/states/vee-search.webp" alt="" />
        <span>Escolha o ${side === 'a' ? 'primeiro' : 'segundo'} jogo na busca acima.</span>
      </div>`;
    return;
  }
  slot.innerHTML = `
    <article class="compare-game">
      <img src="${escapeHtml(game.background_image)}" alt="Capa de ${escapeHtml(game.name)}" />
      <div>
        <h2>${escapeHtml(game.name)}</h2>
        <p>${escapeHtml(formatDate(game.released))}</p>
        <div class="compare-game-actions">
          <a class="pagination-btn" href="game.html?slug=${encodeURIComponent(game.slug)}">Abrir página</a>
          <button type="button" class="pagination-btn" data-clear="${side}">Trocar jogo</button>
        </div>
      </div>
    </article>`;
  slot.querySelector('[data-clear]').addEventListener('click', () => {
    games[side] = null;
    writeUrl();
    renderPicked(side);
    renderTable();
    document.getElementById(`compareInput-${side}`).focus();
  });
}

// Linha numérica: marca quem tem o maior valor.
function numberRow(label, a, b, format = (v) => v, { higherIsBetter = true } = {}) {
  const valid = (v) => Number.isFinite(v) && v > 0;
  let winner = '';
  if (higherIsBetter && valid(a) && valid(b) && a !== b) winner = a > b ? 'a' : 'b';
  const cell = (value, side) => `
    <td class="${winner === side ? 'is-winner' : ''}">
      ${valid(value) ? escapeHtml(String(format(value))) : '—'}
      ${winner === side ? '<span class="winner-badge">🏆 <span class="sr-only">maior valor</span></span>' : ''}
    </td>`;
  return `<tr><th scope="row">${label}</th>${cell(a, 'a')}${cell(b, 'b')}</tr>`;
}

// Linha de listas: destaca o que os dois têm em comum.
function listRow(label, listA, listB) {
  const shared = new Set(listA.filter((item) => listB.includes(item)));
  const cell = (list) => `<td>${list.length ? list.map((item) => `<span class="compare-tag ${shared.has(item) ? 'is-shared' : ''}">${escapeHtml(item)}</span>`).join('') : '—'}</td>`;
  return `<tr><th scope="row">${label}${shared.size ? `<small>${shared.size} em comum</small>` : ''}</th>${cell(listA)}${cell(listB)}</tr>`;
}

// Compara a nota com a mesma precisão exibida (4,43 e 4,41 aparecem como 4,4 — empate).
function roundTenth(value) {
  return Math.round(Number(value) * 10) / 10;
}

function textRow(label, a, b) {
  return `<tr><th scope="row">${label}</th><td>${escapeHtml(a || '—')}</td><td>${escapeHtml(b || '—')}</td></tr>`;
}

function renderTable() {
  const container = document.getElementById('compareTable');
  const { a, b } = games;
  if (!a || !b) {
    container.innerHTML = '<p class="empty-state">Escolha dois jogos para ver a comparação.</p>';
    return;
  }

  container.innerHTML = `
    <table class="compare-table">
      <caption class="sr-only">Comparação entre ${escapeHtml(a.name)} e ${escapeHtml(b.name)}</caption>
      <thead>
        <tr><th scope="col">Item</th><th scope="col">${escapeHtml(a.name)}</th><th scope="col">${escapeHtml(b.name)}</th></tr>
      </thead>
      <tbody>
        ${numberRow('Nota RAWG', roundTenth(a.rating), roundTenth(b.rating), (v) => `${v.toFixed(1)} / 5`)}
        ${numberRow('Metacritic', Number(a.metacritic), Number(b.metacritic))}
        ${numberRow('Avaliações na RAWG', Number(a.ratings_count), Number(b.ratings_count), (v) => v.toLocaleString('pt-BR'))}
        ${numberRow('Tempo médio de jogo', Number(a.playtime), Number(b.playtime), (v) => `${v} h`, { higherIsBetter: false })}
        ${textRow('Lançamento', formatDate(a.released), formatDate(b.released))}
        ${listRow('Gêneros', names(a.genres, (g) => g?.name), names(b.genres, (g) => g?.name))}
        ${listRow('Plataformas', names(a.parent_platforms, (p) => p?.platform?.name), names(b.parent_platforms, (p) => p?.platform?.name))}
        ${textRow('Desenvolvedora', names(a.developers, (d) => d?.name).join(', '), names(b.developers, (d) => d?.name).join(', '))}
        ${textRow('Classificação ESRB', a.esrb_rating?.name, b.esrb_rating?.name)}
      </tbody>
    </table>
    <p class="compare-note">🏆 marca o maior valor. Tempo de jogo não tem vencedor: jogo longo não é jogo melhor. As etiquetas destacadas aparecem nos dois jogos.</p>`;
}

async function pickGame(side, identifier) {
  const slot = document.querySelector(`[data-side="${side}"] .compare-picked`);
  slot.innerHTML = '<div class="skeleton-card compare-skeleton"></div>';
  try {
    games[side] = await getGame(identifier);
  } catch (error) {
    games[side] = null;
    renderPicked(side);
    slot.insertAdjacentHTML('afterbegin', '<p class="empty-state" role="status">Não foi possível carregar esse jogo. Tente outro.</p>');
    return;
  }
  writeUrl();
  renderPicked(side);
  renderTable();
}

function setupPicker(side) {
  const input = document.getElementById(`compareInput-${side}`);
  const box = document.getElementById(`compareSuggestions-${side}`);
  let timeoutId = 0;
  let requestId = 0;

  const close = () => {
    box.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  };

  input.addEventListener('input', () => {
    clearTimeout(timeoutId);
    const value = input.value.trim();
    if (!value) {
      close();
      return;
    }
    timeoutId = setTimeout(async () => {
      const current = ++requestId;
      const results = await getGamesList({ search: value, page_size: 6 });
      if (current !== requestId) return;
      box.innerHTML = results.length
        ? results.map((game) => `
          <button type="button" class="suggestion-item" data-slug="${escapeHtml(game.slug)}">
            <span>${escapeHtml(game.name)}</span><small>${game.released ? game.released.slice(0, 4) : ''}</small>
          </button>`).join('')
        : '<p class="empty-state">Nenhum jogo encontrado.</p>';
      box.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }, 300);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      box.querySelector('.suggestion-item')?.focus();
    } else if (event.key === 'Escape') {
      close();
    }
  });

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
    input.value = '';
    pickGame(side, item.dataset.slug);
  });

  document.addEventListener('click', (event) => {
    if (!input.contains(event.target) && !box.contains(event.target)) close();
  });
}

function init() {
  const params = new URLSearchParams(window.location.search);
  SIDES.forEach((side) => {
    setupPicker(side);
    const identifier = (params.get(side) || '').trim();
    if (/^[a-z0-9-]{1,120}$/i.test(identifier)) {
      pickGame(side, identifier);
    } else {
      renderPicked(side);
    }
  });
  renderTable();
}

init();
