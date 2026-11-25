// Modo apresentação: quando a RAWG não responde (ou não há internet), o site usa uma cópia
// salva em data/offline/rawg-snapshot.json, gerada por `node tools/modo-apresentacao.mjs`.
//
// A cópia tem:
// - lists: respostas exatas de listas (Home, primeiras páginas do catálogo);
// - pool: todos os jogos conhecidos, para filtrar/buscar localmente o que não foi salvo exatamente;
// - games/screenshots/movies/stores: detalhes dos jogos principais.

const SNAPSHOT_URL = 'data/offline/rawg-snapshot.json';
const FORCE_KEY = 'gameverse:forcar-offline';

// Mesma chave usada pelo gerador. Ignora a API key e ordena os parâmetros.
export function snapshotKey(endpoint, params = {}) {
  const entries = Object.entries(params)
    .filter(([key, value]) => key !== 'key' && value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, String(value)])
    .sort(([a], [b]) => a.localeCompare(b));
  return `${endpoint}?${new URLSearchParams(entries).toString()}`;
}

function inDateRange(released, range) {
  if (!range) return true;
  const [start, end] = String(range).split(',');
  return Boolean(released) && released >= start && released <= end;
}

function sortGames(games, ordering = '-added') {
  const desc = ordering.startsWith('-');
  const field = ordering.replace(/^-/, '');
  const value = (game) => {
    if (field === 'name') return String(game.name || '').toLowerCase();
    if (field === 'released') return game.released || '';
    return Number(game[field]) || 0;
  };
  return [...games].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === vb) return 0;
    return (va < vb ? -1 : 1) * (desc ? -1 : 1);
  });
}

// Filtra o pool de jogos como a RAWG faria (gênero, tag, plataforma, nota, datas, busca).
function filterPool(pool, params) {
  const genre = params.genres ? String(params.genres) : '';
  const tag = params.tags ? String(params.tags) : '';
  const platform = params.parent_platforms ? Number(params.parent_platforms) : 0;
  const [minScore, maxScore] = params.metacritic ? String(params.metacritic).split(',').map(Number) : [0, 100];
  const search = params.search ? String(params.search).toLowerCase().trim() : '';

  return pool.filter((game) => {
    if (genre && !(game.genres || []).some((g) => g.slug === genre || String(g.id) === genre)) return false;
    if (tag && !(game.tags || []).includes(tag)) return false;
    if (platform && !(game.parent_platforms || []).some((p) => p?.platform?.id === platform)) return false;
    if (params.metacritic && !(game.metacritic >= minScore && game.metacritic <= maxScore)) return false;
    if (!inDateRange(game.released, params.dates)) return false;
    if (search && !String(game.name || '').toLowerCase().includes(search)) return false;
    return true;
  });
}

// Lógica pura (testável): recebe a cópia e devolve uma função que responde como a RAWG.
export function createOfflineResolver(snapshot) {
  const lists = snapshot?.lists || {};
  const pool = Array.isArray(snapshot?.pool) ? snapshot.pool : [];
  const games = snapshot?.games || {};
  const slugs = snapshot?.slugs || {};
  const poolById = new Map(pool.map((game) => [String(game.id), game]));

  const resolveId = (identifier) => {
    const value = String(identifier);
    if (/^\d+$/.test(value)) return value;
    return slugs[value.toLowerCase()] ? String(slugs[value.toLowerCase()]) : null;
  };

  return function resolve(endpoint, params = {}) {
    const exact = lists[snapshotKey(endpoint, params)];
    if (exact) return exact;

    if (endpoint === '/games') {
      // Sem a página exata salva: monta a resposta filtrando o pool localmente.
      const pageSize = Number(params.page_size) || 20;
      const page = Math.max(1, Number(params.page) || 1);
      const filtered = sortGames(filterPool(pool, params), params.ordering || '-added');
      return {
        count: filtered.length,
        results: filtered.slice((page - 1) * pageSize, page * pageSize)
      };
    }

    const detail = endpoint.match(/^\/games\/([^/]+)$/);
    if (detail) {
      const id = resolveId(decodeURIComponent(detail[1]));
      if (!id) return null;
      // Sem detalhes completos, usa o resumo do pool (sem descrição).
      return games[id] || poolById.get(id) || null;
    }

    const sub = endpoint.match(/^\/games\/(\d+)\/(screenshots|movies|stores)$/);
    if (sub) {
      const [, id, kind] = sub;
      const saved = snapshot?.[kind]?.[id];
      if (saved) return { count: saved.length, results: saved };
      if (kind === 'screenshots') {
        const shots = (poolById.get(id)?.short_screenshots || []).slice(1).map((shot, index) => ({ id: index, image: shot.image }));
        return { count: shots.length, results: shots };
      }
      return { count: 0, results: [] };
    }

    return null;
  };
}

let resolverPromise = null;
let bannerShown = false;

function loadResolver() {
  if (!resolverPromise) {
    resolverPromise = fetch(SNAPSHOT_URL, { cache: 'no-cache' })
      .then((response) => (response.ok ? response.json() : null))
      .then((snapshot) => (snapshot ? { resolve: createOfflineResolver(snapshot), createdAt: snapshot.createdAt, snapshot } : null))
      .catch(() => null);
  }
  return resolverPromise;
}

function showBanner(createdAt) {
  if (bannerShown || typeof document === 'undefined') return;
  bannerShown = true;
  const date = createdAt ? new Date(createdAt).toLocaleDateString('pt-BR') : '';
  const banner = document.createElement('div');
  banner.className = 'offline-banner';
  banner.setAttribute('role', 'status');
  banner.innerHTML = `<span aria-hidden="true">📦</span> <strong>Modo apresentação:</strong> a RAWG não respondeu, então estamos mostrando os dados salvos${date ? ` em ${date}` : ''}.`;
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '✕';
  close.setAttribute('aria-label', 'Fechar aviso do modo apresentação');
  close.addEventListener('click', () => banner.remove());
  banner.append(close);
  document.body.append(banner);
}

// Para testar o modo apresentação com a internet ligada:
// localStorage.setItem('gameverse:forcar-offline', '1')  (e removeItem para voltar)
export function isOfflineForced() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(FORCE_KEY) === '1';
  } catch {
    return false;
  }
}

export async function offlineResponse(endpoint, params) {
  const loaded = await loadResolver();
  if (!loaded) return null;
  const data = loaded.resolve(endpoint, params);
  if (data) showBanner(loaded.createdAt);
  return data;
}

// Partes extras da cópia que não são da RAWG (ex.: 'prices', 'deals', 'usdBrl' da CheapShark).
export async function offlineExtra(key) {
  const loaded = await loadResolver();
  const value = loaded?.snapshot?.[key];
  // Sem aviso geral aqui: quem usa mostra a data dos dados salvos (ex.: "preços de 20/11").
  return value === undefined ? null : value;
}
