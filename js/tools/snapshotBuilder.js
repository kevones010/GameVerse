// Monta a cópia de segurança do "modo apresentação" a partir da RAWG.
// Usado pela página modo-apresentacao.html (no navegador) e por tools/modo-apresentacao.mjs (Node).
// Não sabe gravar arquivos sozinho: recebe uma função writeFile(caminhoRelativo, conteúdo).
import { snapshotKey } from '../services/offlineSnapshot.js';
import { homeQueries, upcomingQuery, HERO_SLIDES } from '../homeQueries.js';
import { CHEAPSHARK_URL, homeDealsPath, curateDeals, storesMap, steamAppIdFromStores, buildPriceSummary } from '../services/priceService.js';

const BASE_URL = 'https://api.rawg.io/api';
const CONCURRENCY = 4;
let currentLog = console.log;

// ---------- O que a Home pede (manter igual a js/home.js) ----------
const HERO_SLUGS = HERO_SLIDES.map((slide) => slide.slug);
const FAVORITE_NAMES = [
  'Persona 5 Royal', 'Metaphor: ReFantazio', 'The Legend of Zelda: Breath of the Wild',
  'Persona 4 Golden', 'Final Fantasy VII Remake', 'Resident Evil 4 Remake',
  'Super Mario Odyssey', 'Hollow Knight: Silksong', 'Persona 3 Reload',
  'Pokémon HeartGold', 'Pokémon Legends Z-A', 'Pokémon Legends Arceus',
  'Super Mario World', 'Yakuza: Like a Dragon', 'Super Mario 64', 'Super Mario Galaxy',
  'Pokémon Black 2', 'Zelda Ocarina of Time', 'Hollow Knight', 'Resident Evil 2 Remake'
];
// Mesmas consultas da Home (js/homeQueries.js).
const HOME_LISTS = Object.values(homeQueries());

// ---------- Primeira página de cada filtro do catálogo (manter igual a js/categorias.js) ----------
const CATALOG_FILTERS = [
  {},
  ...['role-playing-games-rpg', 'action', 'adventure', 'indie', 'strategy', 'shooter', 'racing', 'sports', 'puzzle'].map((genres) => ({ genres })),
  { tags: 'horror' },
  ...['1', '2', '3', '7'].map((parent_platforms) => ({ parent_platforms })),
  ...['1990-01-01,1999-12-31', '2000-01-01,2009-12-31', '2010-01-01,2019-12-31', '2020-01-01,2029-12-31'].map((dates) => ({ dates })),
  ...['70,100', '80,100', '90,100'].map((metacritic) => ({ metacritic }))
];

async function rawg(apiKey, endpoint, params = {}, attempt = 1) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('key', apiKey);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url);
  if (response.status === 429 && attempt < 4) {
    await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    return rawg(apiKey, endpoint, params, attempt + 1);
  }
  if (!response.ok) throw new Error(`RAWG ${response.status} em ${endpoint}`);
  return response.json();
}

async function runPool(items, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        currentLog(`  ! ${error.message}`);
        results[index] = null;
      }
    }
  }));
  return results;
}

// ---------- Deixa só os campos que o site usa ----------
const pick = (object, keys) => Object.fromEntries(keys.filter((key) => object?.[key] !== undefined).map((key) => [key, object[key]]));

function trimListGame(game) {
  return {
    ...pick(game, ['id', 'slug', 'name', 'released', 'tba', 'background_image', 'rating', 'ratings_count', 'metacritic', 'playtime', 'added']),
    genres: (game.genres || []).map((g) => pick(g, ['id', 'name', 'slug'])),
    tags: (game.tags || []).map((t) => t.slug).filter(Boolean).slice(0, 25),
    parent_platforms: (game.parent_platforms || []).map((p) => ({ platform: pick(p.platform, ['id', 'name', 'slug']) })),
    platforms: (game.platforms || []).map((p) => ({ platform: pick(p.platform, ['id', 'name', 'slug']) })),
    stores: (game.stores || []).map((s) => ({ store: pick(s.store, ['id', 'name', 'slug', 'domain']) })),
    short_screenshots: (game.short_screenshots || []).slice(0, 7).map((s) => pick(s, ['id', 'image'])),
    esrb_rating: game.esrb_rating ? pick(game.esrb_rating, ['id', 'name', 'slug']) : null
  };
}

function trimDetail(game) {
  return {
    ...trimListGame(game),
    ...pick(game, ['description_raw', 'website', 'background_image_additional', 'metacritic_url']),
    developers: (game.developers || []).map((d) => pick(d, ['id', 'name', 'slug'])),
    publishers: (game.publishers || []).map((p) => pick(p, ['id', 'name', 'slug']))
  };
}

function trimList(data) {
  return { count: data.count, results: (data.results || []).map(trimListGame) };
}

// A RAWG oferece versões redimensionadas: bem mais leves para guardar.
async function fetchImage(url, width) {
  const resized = url
    .replace('/media/games/', `/media/resize/${width}/-/games/`)
    .replace('/media/screenshots/', `/media/resize/${width}/-/screenshots/`);
  const response = await fetch(resized);
  if (!response.ok) throw new Error(`imagem ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  // Imagem vazia não serve: o jogo continua usando a imagem da internet.
  if (!bytes.length) throw new Error('imagem vazia');
  return bytes;
}

async function cheapshark(path) {
  const response = await fetch(`${CHEAPSHARK_URL}${path}`);
  if (!response.ok) throw new Error(`CheapShark ${response.status}`);
  return response.json();
}

// Preços dos jogos principais (só os que estão na Steam) + seção "Em promoção" + cotação do dólar.
async function savePrices(snapshot, { writeFile, withImages }) {
  const storesById = storesMap(await cheapshark('/stores'));
  snapshot.deals = curateDeals(await cheapshark(homeDealsPath()));

  const appIds = Object.entries(snapshot.stores)
    .map(([rawgId, stores]) => [rawgId, steamAppIdFromStores(stores)])
    .filter(([, appId]) => appId);
  const found = (await runPool(appIds, async ([rawgId, appId]) => {
    const [match] = await cheapshark(`/games?steamAppID=${appId}`);
    return match?.gameID ? [rawgId, match.gameID] : null;
  })).filter(Boolean);

  snapshot.prices = {};
  for (let index = 0; index < found.length; index += 25) {
    const chunk = found.slice(index, index + 25);
    const data = await cheapshark(`/games?ids=${chunk.map(([, id]) => id).join(',')}`);
    chunk.forEach(([rawgId, id]) => {
      const summary = buildPriceSummary(data?.[id], storesById);
      if (summary) snapshot.prices[rawgId] = summary;
    });
  }

  try {
    const rate = Number((await (await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL')).json())?.USDBRL?.bid);
    if (rate > 0) snapshot.usdBrl = rate;
  } catch {
    // Sem cotação: o modo apresentação mostra só o preço em dólar.
  }

  if (withImages) {
    await runPool(snapshot.deals, async (deal) => {
      const response = await fetch(deal.image);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!response.ok || !bytes.length) throw new Error(`capa da promoção ${response.status}`);
      await writeFile(`assets/offline/deal-${deal.steamAppID}.jpg`, bytes);
      deal.image = `assets/offline/deal-${deal.steamAppID}.jpg`;
    });
  }
  currentLog(`  ${Object.keys(snapshot.prices).length} jogos com preço, ${snapshot.deals.length} promoções.`);
}

export async function buildSnapshot({ apiKey, writeFile, log = console.log, withImages = true }) {
  if (!apiKey) throw new Error('RAWG_API_KEY vazia em js/config.local.js.');
  currentLog = log;
  const snapshot = { createdAt: new Date().toISOString(), lists: {}, pool: [], games: {}, slugs: {}, screenshots: {}, movies: {}, stores: {} };
  const poolById = new Map();
  const featuredIds = new Set();

  const addToPool = (results, featured = false) => (results || []).forEach((game) => {
    if (!game?.id) return;
    if (!poolById.has(game.id)) poolById.set(game.id, game);
    if (featured) featuredIds.add(game.id);
  });

  const saveList = async (params, { featured = false } = {}) => {
    const data = trimList(await rawg(apiKey, '/games', params));
    snapshot.lists[snapshotKey('/games', params)] = data;
    addToPool(data.results, featured);
    return data;
  };

  log('1/5 Seções da Home…');
  await runPool(HOME_LISTS, (params) => saveList(params, { featured: true }));
  await runPool(FAVORITE_NAMES, (name) => saveList({ search: name, page_size: 1 }, { featured: true }));

  log('2/5 Próximos lançamentos e "Me surpreenda"…');
  await runPool([
    async () => addToPool(trimList(await rawg(apiKey, '/games', upcomingQuery())).results, true),
    async () => addToPool(trimList(await rawg(apiKey, '/games', { metacritic: '80,100', ordering: '-added', page_size: 40 })).results)
  ], (task) => task());

  log('3/5 Primeira página de cada filtro do catálogo…');
  await runPool(CATALOG_FILTERS, (filter) => saveList({ ...filter, ordering: '-added', page: 1, page_size: 20 }));

  log('4/5 Detalhes dos jogos principais…');
  const heroDetails = await runPool(HERO_SLUGS, (slug) => rawg(apiKey, `/games/${slug}`));
  heroDetails.filter(Boolean).forEach((game) => { featuredIds.add(game.id); poolById.set(game.id, trimListGame(game)); });

  const ids = [...featuredIds];
  await runPool(ids, async (id, index) => {
    // Só o detalhe é obrigatório; capturas, trailers e lojas são extras.
    const detail = await rawg(apiKey, `/games/${id}`);
    const optional = (endpoint, params) => rawg(apiKey, endpoint, params).catch(() => ({ results: [] }));
    const [shots, movies, stores] = await Promise.all([
      optional(`/games/${id}/screenshots`, { page_size: 8 }),
      optional(`/games/${id}/movies`),
      optional(`/games/${id}/stores`)
    ]);
    snapshot.games[id] = trimDetail(detail);
    snapshot.screenshots[id] = (shots.results || []).map((s) => pick(s, ['id', 'image', 'width', 'height']));
    snapshot.movies[id] = (movies.results || []).map((m) => pick(m, ['id', 'name', 'preview', 'data']));
    snapshot.stores[id] = (stores.results || []).map((s) => pick(s, ['id', 'store_id', 'url']));
    if ((index + 1) % 20 === 0) log(`  ${index + 1}/${ids.length}`);
  });

  snapshot.pool = [...poolById.values()];
  snapshot.pool.forEach((game) => { if (game.slug) snapshot.slugs[game.slug.toLowerCase()] = game.id; });
  Object.values(snapshot.games).forEach((game) => { if (game.slug) snapshot.slugs[game.slug.toLowerCase()] = game.id; });

  if (withImages) {
    log('5/5 Baixando imagens dos jogos principais…');
    const localById = new Map();
    const heroIds = new Set(heroDetails.filter(Boolean).map((game) => game.id));
    await runPool(Object.values(snapshot.games), async (game) => {
      if (!game.background_image) return;
      // Destaques da Home em alta resolução; o resto menor, para a pasta não ficar pesada.
      const bytes = await fetchImage(game.background_image, heroIds.has(game.id) ? 1280 : 640);
      await writeFile(`assets/offline/${game.id}.jpg`, bytes);
      localById.set(game.id, `assets/offline/${game.id}.jpg`);
    });

    // Troca a imagem principal pela cópia local em todos os lugares da cópia.
    const swap = (game) => {
      const local = localById.get(game?.id);
      if (!local) return;
      game.background_image = local;
      if (game.background_image_additional) game.background_image_additional = local;
    };
    Object.values(snapshot.games).forEach(swap);
    snapshot.pool.forEach(swap);
    Object.values(snapshot.lists).forEach((list) => list.results.forEach(swap));
    log(`  ${localById.size} imagens salvas em assets/offline/`);
  } else {
    log('5/5 Imagens puladas (as capas continuarão vindo da internet).');
  }

  log('Extra: preços e promoções (CheapShark)…');
  try {
    await savePrices(snapshot, { writeFile, withImages });
  } catch (error) {
    log(`  ! Preços não salvos (${error.message}). O resto da cópia continua valendo.`);
  }

  const json = JSON.stringify(snapshot);
  await writeFile('data/offline/rawg-snapshot.json', json);
  log(`\nPronto! ${snapshot.pool.length} jogos no catálogo offline, ${Object.keys(snapshot.games).length} com página completa.`);
  log(`Arquivo: data/offline/rawg-snapshot.json (${(json.length / 1024 / 1024).toFixed(1)} MB)`);
  return { games: Object.keys(snapshot.games).length, pool: snapshot.pool.length };
}

