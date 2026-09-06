import assert from 'node:assert/strict';
import { startBrowser } from './browser-runner.mjs';
import { createCommunitySeed } from '../data/communitySeed.js';

const games = [
  { id: 339958, name: 'Persona 5 Royal', slug: 'persona-5-royal' },
  { id: 9767, name: 'Hollow Knight', slug: 'hollow-knight' },
  { id: 326243, name: 'Elden Ring', slug: 'elden-ring' },
  { id: 49, name: 'Persona 5', slug: 'persona-5' },
  { id: 963212, name: 'Metaphor: ReFantazio', slug: 'metaphor-refantazio' },
  { id: 795632, name: 'Resident Evil 4', slug: 'resident-evil-4-2023' },
  { id: 999001, name: 'Zelda fixture', slug: 'the-legend-of-zelda-breath-of-the-wild' },
  { id: 999002, name: 'Mario fixture', slug: 'super-mario-odyssey' }
];

function installFixtures(games, seed) {
  window.__errors = [];
  window.__consoleErrors = [];
  window.__storageLeaked = false;
  window.__rawgCalls = [];
  window.__youtubeCalls = 0;
  window.__pendingSearch = {};
  addEventListener('error', event => { if (event.error) window.__errors.push(event.error.name); });
  addEventListener('unhandledrejection', event => window.__errors.push(event.reason?.name || 'rejection'));
  for (const level of ['error', 'warn', 'log', 'info']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      if (level === 'error') window.__consoleErrors.push(String(args[0]));
      if (args.some(value => String(value).includes('STORAGE_SENTINEL'))) window.__storageLeaked = true;
      original(...args);
    };
  }
  const params = new URLSearchParams(location.search);
  const scenario = params.get('storage');
  const local = window.localStorage;
  const session = window.sessionStorage;
  const read = Storage.prototype.getItem;
  window.__readStored = key => read.call(local, key);
  window.__readCache = () => read.call(session, 'gameverse-cache-v2');
  if (!local.getItem('stabilization-init')) {
    local.setItem('gameverse-community:v1', JSON.stringify(seed));
    local.setItem('gameverse-favorites', JSON.stringify(games.slice(0, 3).map(({ id }) => ({ id }))));
    local.setItem('stabilization-init', 'true');
  }
  session.clear();
  if (params.get('favorites') === 'empty') local.setItem('gameverse-favorites', '[]');
  if (scenario === 'favorites') local.setItem('gameverse-favorites', '{STORAGE_SENTINEL');
  if (scenario === 'favorites-shape') local.setItem('gameverse-favorites', '{"unexpected":"STORAGE_SENTINEL"}');
  if (scenario === 'analysis') local.setItem('gameverse-analysis-339958', '{STORAGE_SENTINEL');
  if (scenario === 'analysis-shape') local.setItem('gameverse-analysis-339958', '{"text":{"invalid":"STORAGE_SENTINEL"}}');
  if (scenario === 'rating') local.setItem('gameverse-rating-339958', 'STORAGE_SENTINEL');
  if (scenario === 'cache') session.setItem('gameverse-cache-v2', '{STORAGE_SENTINEL');
  if (scenario === 'cache-empty') session.setItem('gameverse-cache-v2', '');
  if (scenario === 'cache-shape') session.setItem('gameverse-cache-v2', 'null');
  if (scenario === 'cache-entry') session.setItem('gameverse-cache-v2', JSON.stringify({
    'game:339958': { ...games[0], genres: 'invalid' }, 'screenshots:339958': { invalid: true }, 'trailers:339958': [null]
  }));
  if (scenario === 'quota' || scenario === 'write-unavailable') {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === session || scenario === 'write-unavailable') throw new DOMException('Fixture', 'QuotaExceededError');
      return write.call(this, key, value);
    };
  }
  if (scenario === 'unavailable') {
    for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(window, key, {
      configurable: true, get() { throw new DOMException('Fixture', 'SecurityError'); }
    });
  }
  const originalFetch = window.fetch.bind(window);
  const image = `${location.origin}/assets/vee/states/vee-search.webp`;
  const fullGame = game => ({ ...game, background_image: image, description_raw: 'Descrição de teste.',
    rating: 4.5, ratings_count: 10, released: '2020-03-31', genres: [{ id: 3, name: 'Adventure', slug: 'adventure' }], platforms: [] });
  window.fetch = async (value, options) => {
    const url = new URL(value, location.href);
    if (url.hostname === 'www.googleapis.com') {
      window.__youtubeCalls++;
      if (params.get('trailer') === 'offline') throw new TypeError('Fixture offline');
      return Response.json({ items: [{ id: { videoId: 'fixture0001' }, snippet: { title: 'Persona 5 Royal Launch Trailer' } }] });
    }
    if (url.hostname !== 'api.rawg.io') return originalFetch(value, options);
    const query = url.searchParams.get('search');
    window.__rawgCalls.push({ path: url.pathname, params: Object.fromEntries([...url.searchParams].filter(([key]) => key !== 'key')) });
    const match = url.pathname.match(/\/games\/([^/]+)(?:\/(\w+))?$/);
    if (!match) {
      if (query === 'old') return new Promise(resolve => {
        window.__pendingSearch.old = () => resolve(Response.json({ results: [fullGame(games[0])] }));
      });
      const results = query ? games.filter(game => game.name.toLowerCase().includes(query.toLowerCase())) : games;
      return Response.json({ results: results.map(fullGame) });
    }
    const game = games.find(item => String(item.id) === match[1] || item.slug === match[1]);
    if (!game || params.get('favorites') === 'fail' || (params.get('favorites') === 'partial' && game.id === 9767)) {
      return Response.json({}, { status: 404 });
    }
    if (match[2] === 'screenshots') return Response.json({ results: [{ id: 1, image }] });
    if (match[2] === 'movies') return Response.json({ results: params.has('trailer') ? [] : [
      { name: 'Trailer fixture', data: { '480': 'https://example.test/trailer.mp4' } }
    ] });
    if (match[2] === 'stores') return Response.json({ results: [] });
    return Response.json(fullGame(game));
  };
}

const browser = await startBrowser({ youtubeFixture: true });
const { page } = browser;
const failures = [];
let passed = 0;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function check(name, run) {
  try { await run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, error: error.message }); console.log(`FAIL ${name}: ${error.message}`); }
}
async function fresh(path) {
  await page.send('Storage.clearDataForOrigin', { origin: browser.baseUrl, storageTypes: 'local_storage' });
  await page.navigate(path);
}
const click = selector => page.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
async function cleanConsole() {
  assert.deepEqual(await page.evaluate('window.__errors'), []);
  assert.deepEqual(await page.evaluate('window.__consoleErrors'), []);
  assert.equal(await page.evaluate('window.__storageLeaked'), false);
}
async function gameReady() {
  await page.waitFor(`document.querySelector('#game-title')?.textContent === 'Persona 5 Royal' && document.querySelector('#analysisForm, .review-card')`);
  await page.waitFor(`document.querySelector('#game-cover')?.naturalWidth > 0`);
  assert.ok(await page.evaluate(`document.querySelector('#game-cover').naturalWidth > 0 && document.querySelector('#game-description').textContent && document.querySelector('#game-screenshots img')`));
}
async function type(query) {
  await page.evaluate(`document.querySelector('#searchInput').value=${JSON.stringify(query)};document.querySelector('#searchInput').dispatchEvent(new Event('input',{bubbles:true}))`);
}
async function key(value, code) {
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code: value, windowsVirtualKeyCode: code,
    ...(value === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code: value, windowsVirtualKeyCode: code });
}

try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(${installFixtures.toString()})(${JSON.stringify(games)},${JSON.stringify(createCommunitySeed())})` });
  await page.send('Network.enable');
  await page.send('Network.setBlockedURLs', { urls: ['https://example.test/*', '*youtube.com/embed/*'] });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

  for (const scenario of ['favorites', 'favorites-shape', 'analysis', 'analysis-shape', 'rating', 'cache', 'cache-empty', 'cache-shape', 'cache-entry', 'quota', 'write-unavailable', 'unavailable']) {
    await check(`GV-02 Game preservado com storage ${scenario}`, async () => {
      await fresh(`/game.html?id=339958&storage=${scenario}`);
      await gameReady();
      assert.ok(await page.evaluate(`document.querySelector('#game-trailer video')`));
      if (scenario.startsWith('favorites')) assert.ok((await page.evaluate(`window.__readStored('gameverse-favorites')`)).includes('STORAGE_SENTINEL'));
      if (scenario.startsWith('analysis')) assert.ok((await page.evaluate(`window.__readStored('gameverse-analysis-339958')`)).includes('STORAGE_SENTINEL'));
      if (scenario === 'rating') assert.equal(await page.evaluate(`window.__readStored('gameverse-rating-339958')`), 'STORAGE_SENTINEL');
      if (scenario === 'cache') assert.equal(await page.evaluate('window.__readCache()'), '{STORAGE_SENTINEL');
      if (scenario === 'cache-empty') assert.equal(await page.evaluate('window.__readCache()'), '');
      if (scenario === 'cache-shape') assert.equal(await page.evaluate('window.__readCache()'), 'null');
      await cleanConsole();
    });
  }
  await check('GV-02 falhas de escrita em favoritos, nota e análise são locais', async () => {
    await fresh('/game.html?id=339958&storage=write-unavailable'); await gameReady();
    await click('#favoriteButton'); await click('#stars button:nth-child(4)');
    await page.evaluate(`document.querySelector('#analysisText').value='Análise não persistida';document.querySelector('#analysisForm').requestSubmit()`);
    assert.ok(await page.evaluate(`document.querySelector('#favoriteButton').textContent.includes('Não foi possível') && document.querySelector('#game-rating [data-storage-notice]') && document.querySelector('#game-review [data-storage-notice]')`));
    assert.equal(await page.evaluate(`window.__readStored('gameverse-analysis-339958')`), null);
    await gameReady(); await cleanConsole();
  });

  for (const [mode, count] of [['all', 3], ['partial', 2], ['fail', 0], ['empty', 0]]) await check(`GV-03 favoritos ${mode}`, async () => {
    await fresh(`/favoritos.html?favorites=${mode}`);
    await page.waitFor(`!document.querySelector('#favoritesList').textContent.includes('Carregando')`);
    assert.equal(await page.evaluate(`document.querySelectorAll('#favoritesList .card').length`), count);
    if (mode === 'partial') {
      assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('#favoritesList .card')].map(card=>Number(card.dataset.id))`), [339958, 326243]);
      assert.ok(await page.evaluate(`document.querySelector('#favoritesList').textContent.includes('1 favorito não pôde')`));
    }
    if (mode === 'fail') assert.ok(await page.evaluate(`document.querySelector('#retryFavorites')`));
    if (mode === 'empty') assert.ok(await page.evaluate(`document.querySelector('#favoritesList').textContent.includes('Nenhum favorito')`));
    await cleanConsole();
  });
  await check('GV-03 tentar novamente recupera favoritos após falha total', async () => {
    await fresh('/favoritos.html?favorites=fail'); await page.waitFor(`document.querySelector('#retryFavorites')`);
    await page.evaluate(`const prior=window.fetch;window.fetch=(url,options)=>{if(String(url).includes('api.rawg.io')){const id=Number(new URL(url).pathname.split('/').pop());return Promise.resolve(Response.json({id,name:'Jogo recuperado',slug:'fixture',rating:4}));}return prior(url,options);};`);
    await click('#retryFavorites'); await page.waitFor(`document.querySelectorAll('#favoritesList .card').length===3`);
    await cleanConsole();
  });

  await check('GV-04 pesquisas consecutivas preservam input, foco e resultados', async () => {
    await fresh('/game.html?id=339958'); await gameReady();
    await page.evaluate(`window.__searchInput=document.querySelector('#searchInput');window.__searchInput.focus()`);
    for (const [query, expected] of [['Persona', [339958, 49]], ['Elden Ring', [326243]], ['Hollow Knight', [9767]]]) {
      await type(query);
      await page.waitFor(`document.querySelector('#searchSuggestions button')?.dataset.id === '${expected[0]}'`);
      assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('#searchSuggestions button')].map(b=>Number(b.dataset.id))`), expected);
      assert.ok(await page.evaluate(`document.querySelector('#searchInput')===window.__searchInput && document.activeElement===window.__searchInput`));
    }
    await cleanConsole();
  });
  await check('GV-04 resposta antiga e limpeza não reapresentam sugestões', async () => {
    await fresh('/game.html?id=339958'); await gameReady();
    await type('old'); await page.waitFor('window.__pendingSearch.old');
    await type('Hollow Knight'); await page.waitFor(`document.querySelector('#searchSuggestions button')?.dataset.id==='9767'`);
    await page.evaluate('window.__pendingSearch.old()'); await pause(50);
    assert.equal(await page.evaluate(`document.querySelector('#searchSuggestions button').dataset.id`), '9767');
    await page.evaluate('delete window.__pendingSearch.old');
    await type('old'); await page.waitFor('window.__pendingSearch.old');
    await type(''); await page.evaluate('window.__pendingSearch.old()'); await pause(50);
    assert.equal(await page.evaluate(`document.querySelector('#searchSuggestions').children.length`), 0);
    await cleanConsole();
  });
  await check('GV-04 Enter sem resultado inequívoco não inventa slug', async () => {
    await fresh('/game.html?id=339958'); await gameReady();
    await page.evaluate(`document.querySelector('#searchInput').focus()`);
    await type('Persona'); await page.waitFor(`document.querySelectorAll('#searchSuggestions button').length===2`);
    await key('Enter', 13); await pause(200);
    assert.equal(await page.evaluate('location.search'), '?id=339958');
    await type('nome inexistente'); await pause(350); await key('Enter', 13); await pause(200);
    assert.equal(await page.evaluate('location.search'), '?id=339958');
  });
  await check('GV-04 Enter abre resultado inequívoco usando RAWG ID', async () => {
    await fresh('/game.html?id=339958'); await gameReady();
    await page.evaluate(`document.querySelector('#searchInput').focus()`);
    await type('Hollow Knight'); await page.waitFor(`document.querySelector('#searchSuggestions button')?.dataset.id==='9767'`);
    await key('Enter', 13); await page.waitFor(`location.search==='?id=9767'`);
    await page.waitFor(`document.querySelector('#game-title')?.textContent==='Hollow Knight'`);
    await cleanConsole();
  });
  await check('GV-04 sugestão escolhida pelo teclado abre identidade real', async () => {
    await fresh('/game.html?id=339958'); await gameReady();
    await page.evaluate(`document.querySelector('#searchInput').focus()`);
    await type('Persona'); await page.waitFor(`document.querySelectorAll('#searchSuggestions button').length===2`);
    await key('ArrowDown', 40); await key('ArrowDown', 40);
    assert.equal(await page.evaluate('document.activeElement.dataset.id'), '49');
    await key('Enter', 13);
    await page.waitFor(`location.search==='?id=49'`);
    await page.waitFor(`document.querySelector('#game-title')?.textContent==='Persona 5'`);
  });

  for (const [label, parameter, value] of [['Aventura', 'genres', 'adventure'], ['Terror', 'tags', 'horror'], ['PC', 'parent_platforms', '1'], ['PlayStation', 'parent_platforms', '2'], ['Nintendo', 'parent_platforms', '7']]) {
    await check(`GV-05 filtro ${label} usa taxonomia correta`, async () => {
      await fresh('/categorias.html'); await page.waitFor(`document.querySelector('#catalogResults .card')`);
      await page.evaluate(`window.__rawgCalls=[];[...document.querySelectorAll('.filter-chip')].find(b=>b.textContent===${JSON.stringify(label)}).click()`);
      await page.waitFor('window.__rawgCalls.length===1');
      const call = await page.evaluate('window.__rawgCalls[0].params');
      assert.equal(call[parameter], value);
      for (const key of ['genres', 'tags', 'platforms', 'parent_platforms'].filter(key => key !== parameter)) assert.equal(call[key], undefined);
      await cleanConsole();
    });
  }
  await check('GV-06 RAWG tem prioridade e YouTube não é consultado', async () => {
    await fresh('/game.html?id=339958'); await gameReady();
    assert.ok(await page.evaluate(`document.querySelector('#game-trailer video')`));
    assert.equal(await page.evaluate('window.__youtubeCalls'), 0);
  });
  await check('GV-06 fallback YouTube recebe identidade e monta iframe', async () => {
    await fresh('/game.html?id=339958&trailer=youtube'); await gameReady();
    assert.equal(await page.evaluate('window.__youtubeCalls'), 1);
    assert.ok(await page.evaluate(`document.querySelector('#game-trailer iframe')?.src.endsWith('/fixture0001')`));
    assert.equal(await page.evaluate(`JSON.parse(sessionStorage.getItem('gameverse-youtube-trailer:v2:339958')).gameId`), 339958);
    await cleanConsole();
  });
  await check('GV-06 YouTube offline preserva Game', async () => {
    await fresh('/game.html?id=339958&trailer=offline'); await gameReady();
    assert.ok(await page.evaluate(`document.querySelector('#game-trailer').textContent.includes('Trailer ainda não disponível')`));
    await cleanConsole();
  });
  await check('regressão favoritos, rating e análise: editar, refresh e excluir', async () => {
    await fresh('/game.html?id=339958'); await gameReady();
    await click('#favoriteButton'); await click('#favoriteButton'); await click('#stars button:nth-child(4)');
    await page.evaluate(`document.querySelector('#analysisText').value='Análise inicial';document.querySelector('#analysisForm').requestSubmit()`);
    await click('#editAnalysis');
    assert.equal(await page.evaluate(`document.querySelector('#analysisText').value`), 'Análise inicial');
    await page.evaluate(`document.querySelector('#analysisText').value='Análise revisada';document.querySelector('#analysisForm').requestSubmit()`);
    await page.navigate('/game.html?id=339958');
    await page.waitFor(`document.querySelector('.review-card p')?.textContent==='Análise revisada'`);
    assert.ok(await page.evaluate(`document.querySelector('#favoriteButton').textContent.includes('Favoritado') && document.querySelectorAll('#stars .active').length===4`));
    await click('#deleteAnalysis'); assert.equal(await page.evaluate(`localStorage.getItem('gameverse-analysis-339958')`), null);
    await cleanConsole();
  });
  for (const [path, ready] of [
    ['/index.html', `document.querySelector('#hero .hero-slide')`],
    ['/categorias.html', `document.querySelector('#catalogResults .card')`],
    ['/favoritos.html', `document.querySelector('#favoritesList .card')`],
    ['/game.html?id=339958', `document.querySelector('#analysisForm')`],
    ['/comunidade.html', `document.querySelector('.post-card')`],
    ['/comunidade-jogo.html?gameId=339958', `document.querySelector('.post-card')`],
    ['/perfil.html', `document.querySelector('#profileAvatar')?.naturalWidth>0`]
  ]) await check(`smoke sem novos erros: ${path}`, async () => {
    await fresh(path); await page.waitFor(ready); await cleanConsole();
  });
} finally { await browser.close(); }
console.log(JSON.stringify({ passed, failed: failures.length, failures }));
if (failures.length) process.exitCode = 1;
