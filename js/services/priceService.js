// Preços e promoções das lojas de PC, vindos da CheapShark (grátis, sem chave).
// Os preços são em dólar; a estimativa em reais usa a cotação do dia (AwesomeAPI).
// Se a internet cair, usa os preços salvos no modo apresentação (se houver).
//
// Termos da CheapShark: os links de compra precisam passar por cheapshark.com/redirect.

import { isOfflineForced, offlineExtra } from './offlineSnapshot.js';

export const CHEAPSHARK_URL = 'https://www.cheapshark.com/api/1.0';
const RATE_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';
const CACHE_PREFIX = 'gameverse-precos:v1:';
const PRICE_TTL = 30 * 60 * 1000; // 30 min: promoção muda, mas não a cada clique.
const RATE_TTL = 6 * 60 * 60 * 1000; // 6 h para a cotação.
const ADULT_TITLE = /\b(hentai|porn|nsfw|erotic|waifu|sexy|nude)\b/i;
const EXTRA_TITLE = /\b(soundtrack|ost|artbook|season pass|dlc|upgrade|costume|bundle)\b/i;

// ---------- Funções puras (testadas em tests/price-service.test.mjs) ----------

// "Sid Meier's Civilization® VI – Director’s Cut" → "sid meiers civilization vi directors cut"
export function normalizeTitle(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// A RAWG manda o link da Steam em /games/{id}/stores: https://store.steampowered.com/app/2050650/...
export function steamAppIdFromStores(stores = []) {
  for (const item of stores || []) {
    const match = String(item?.url || '').match(/store\.steampowered\.com\/app\/(\d+)/i);
    if (match) return match[1];
  }
  return null;
}

// Na busca por nome, só aceita o jogo com o MESMO nome. Nada de mostrar o preço de outro jogo.
export function pickExactTitle(results = [], name) {
  const wanted = normalizeTitle(name);
  if (!wanted) return null;
  return (results || []).find((item) => normalizeTitle(item?.external) === wanted) || null;
}

export function dealUrl(dealID) {
  return `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(decodeURIComponent(String(dealID || '')))}`;
}

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

// Junta a resposta de /games?id=… com os nomes das lojas.
export function buildPriceSummary(gameData, storesById = {}) {
  if (!gameData?.deals?.length) return null;
  const deals = gameData.deals
    .map((deal) => {
      const store = storesById[deal.storeID];
      if (!store) return null; // loja desativada
      const price = toNumber(deal.price);
      const retail = toNumber(deal.retailPrice);
      return {
        storeId: String(deal.storeID),
        store: store.name,
        icon: store.icon,
        price,
        retail,
        savings: retail > price ? Math.round(((retail - price) / retail) * 100) : 0,
        url: dealUrl(deal.dealID)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.price - b.price);

  if (!deals.length) return null;
  const lowest = gameData.cheapestPriceEver;
  return {
    title: gameData.info?.title || '',
    steamAppID: gameData.info?.steamAppID || null,
    deals,
    best: deals[0],
    onSale: deals.some((deal) => deal.savings > 0),
    historicLow: lowest && toNumber(lowest.price) > 0
      ? { price: toNumber(lowest.price), date: lowest.date ? new Date(lowest.date * 1000).toISOString().slice(0, 10) : null }
      : null
  };
}

export function storesMap(list = []) {
  return Object.fromEntries((list || [])
    .filter((store) => store && Number(store.isActive) === 1)
    .map((store) => [String(store.storeID), {
      name: store.storeName,
      icon: store.images?.icon ? `https://www.cheapshark.com${store.images.icon}` : ''
    }]));
}

// Seção "Em promoção" da Home: só jogos bons e conhecidos, com desconto de verdade, sem repetir.
// Conhecido = 5.000+ avaliações na Steam com 75%+ positivas. Os mais populares vêm primeiro.
export function curateDeals(deals = [], limit = 16) {
  const seenApps = new Set();
  const seenTitles = [];
  const result = [];
  const popular = (deals || [])
    .filter((deal) => toNumber(deal?.steamRatingCount) >= 5000 && toNumber(deal?.steamRatingPercent) >= 75)
    .sort((a, b) => toNumber(b.steamRatingCount) - toNumber(a.steamRatingCount));

  for (const deal of popular) {
    const appId = deal?.steamAppID;
    const title = String(deal?.title || '');
    const savings = Math.round(toNumber(deal?.savings));
    // "Mortal Kombat 11" e "Mortal Kombat 11 Ultimate" contam como o mesmo jogo.
    const compact = normalizeTitle(title).replace(/ /g, '');
    if (!appId || !compact || seenApps.has(appId)) continue;
    if (seenTitles.some((other) => other.startsWith(compact) || compact.startsWith(other))) continue;
    if (savings < 20 || ADULT_TITLE.test(title) || EXTRA_TITLE.test(title)) continue;
    seenApps.add(appId);
    seenTitles.push(compact);
    result.push({
      title,
      steamAppID: String(appId),
      salePrice: toNumber(deal.salePrice),
      normalPrice: toNumber(deal.normalPrice),
      savings,
      metacritic: toNumber(deal.metacriticScore),
      url: dealUrl(deal.dealID),
      image: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
      // Alguns jogos não têm a capa nesse endereço: aí usa a miniatura que a CheapShark manda.
      fallbackImage: safeHttps(deal.thumb)
    });
    if (result.length >= limit) break;
  }
  return result;
}

function safeHttps(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export function formatUsd(value) {
  return toNumber(value) === 0 ? 'Grátis' : `US$ ${toNumber(value).toFixed(2).replace('.', ',')}`;
}

export function formatBrl(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toNumber(value));
}

// "≈ R$ 49,62". Vazio quando não há cotação ou o jogo é grátis.
export function brlEstimate(usd, rate) {
  if (!rate || !(toNumber(usd) > 0)) return '';
  return `≈ ${formatBrl(toNumber(usd) * rate)}`;
}

// ---------- Rede (com cache e plano B offline) ----------

function readCache(key, ttl) {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_PREFIX + key) || 'null');
    if (saved && Date.now() - saved.savedAt < ttl) return saved.value;
  } catch { /* cache é só um extra */ }
  return undefined;
}

function writeCache(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ savedAt: Date.now(), value }));
  } catch { /* sem espaço: tudo bem */ }
}

async function cheapshark(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${CHEAPSHARK_URL}${path}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`CheapShark ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getStoresMap() {
  const cached = readCache('lojas', 24 * 60 * 60 * 1000);
  if (cached) return cached;
  const map = storesMap(await cheapshark('/stores'));
  writeCache('lojas', map);
  return map;
}

async function findCheapSharkId({ name, steamAppID }) {
  if (steamAppID) {
    const [byApp] = await cheapshark(`/games?steamAppID=${encodeURIComponent(steamAppID)}`);
    if (byApp?.gameID) return byApp.gameID;
  }
  if (!name) return null;
  const byTitle = await cheapshark(`/games?title=${encodeURIComponent(name)}&limit=20`);
  return pickExactTitle(byTitle, name)?.gameID || null;
}

// Preços de um jogo. Devolve null quando o jogo não é vendido em lojas de PC acompanhadas.
// gameId = id da RAWG (usado no cache e na cópia offline).
export async function getGamePrices({ gameId, name, stores = [] }) {
  const steamAppID = steamAppIdFromStores(stores);
  const cacheKey = `jogo:${gameId}`;
  const offline = async () => {
    const saved = (await offlineExtra('prices'))?.[gameId];
    return saved ? { ...saved, savedAt: await offlineExtra('createdAt') } : null;
  };

  if (isOfflineForced()) return offline();
  const cached = readCache(cacheKey, PRICE_TTL);
  if (cached !== undefined) return cached;

  try {
    const id = await findCheapSharkId({ name, steamAppID });
    let summary = null;
    if (id) {
      const [data, storesById] = await Promise.all([cheapshark(`/games?id=${encodeURIComponent(id)}`), getStoresMap()]);
      summary = buildPriceSummary(data, storesById);
    }
    writeCache(cacheKey, summary);
    return summary;
  } catch (error) {
    console.warn('Preços indisponíveis.', error);
    return offline();
  }
}

export function homeDealsPath() {
  // storeID=1: Steam (todo jogo tem steamAppID, então dá para mostrar a capa e achar o jogo).
  return '/deals?storeID=1&onSale=1&metacritic=75&sortBy=Deal%20Rating&pageSize=60';
}

export async function getHomeDeals() {
  const offline = async () => {
    const savedAt = await offlineExtra('createdAt');
    return ((await offlineExtra('deals')) || []).map((deal) => ({ ...deal, savedAt }));
  };
  if (isOfflineForced()) return offline();
  const cached = readCache('home', PRICE_TTL);
  if (cached) return cached;
  try {
    const deals = curateDeals(await cheapshark(homeDealsPath()));
    writeCache('home', deals);
    return deals;
  } catch (error) {
    console.warn('Promoções indisponíveis.', error);
    return offline();
  }
}

// Cotação do dólar. null se não der (aí o site mostra só o preço em dólar).
export async function getUsdBrlRate() {
  if (isOfflineForced()) return (await offlineExtra('usdBrl')) || null;
  const cached = readCache('cotacao', RATE_TTL);
  if (cached) return cached;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const data = await fetch(RATE_URL, { signal: controller.signal }).then((response) => response.json()).finally(() => clearTimeout(timer));
    const rate = Number(data?.USDBRL?.bid);
    if (!(rate > 0)) throw new Error('cotação inválida');
    writeCache('cotacao', rate);
    return rate;
  } catch (error) {
    console.warn('Cotação do dólar indisponível.', error);
    return (await offlineExtra('usdBrl')) || null;
  }
}
