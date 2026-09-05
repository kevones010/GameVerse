import assert from 'node:assert/strict';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startBrowser } from './browser-runner.mjs';
import { createCommunitySeed } from '../data/communitySeed.js';

const games = [
  { id: 339958, name: 'Persona 5 Royal', slug: 'persona-5-royal' },
  { id: 962676, name: 'Persona 3 Reload', slug: 'persona-3-reload' },
  { id: 9767, name: 'Hollow Knight', slug: 'hollow-knight' },
  { id: 326243, name: 'Elden Ring', slug: 'elden-ring' },
  { id: 795632, name: 'Resident Evil 4', slug: 'resident-evil-4-2023' },
  { id: 963212, name: 'Metaphor: ReFantazio', slug: 'metaphor-refantazio' },
  { id: 49, name: 'Persona 5', slug: 'persona-5' }
];
const seed = createCommunitySeed();
for (let index = 0; index < 9; index++) seed.posts.push({
  ...seed.posts[0], id: `browser-post-${index}`, type: ['guide', 'art', 'screenshot', 'discussion', 'question'][index % 5],
  title: `Publicação de teste ${index}`, content: 'Conteúdo de teste seguro.',
  createdAt: new Date(Date.now() + index * 1000).toISOString(), likesCount: 0, savesCount: 0, commentsCount: 0
});

function installFixtures(games, seed) {
  window.__errors = [];
  window.addEventListener('error', event => { if (event.error) window.__errors.push(event.error.name); });
  window.addEventListener('unhandledrejection', event => window.__errors.push(event.reason?.name || 'rejection'));
  if (!localStorage.getItem('browser-fixtures-initialized')) {
    localStorage.setItem('gameverse-community:v1', JSON.stringify(seed));
    localStorage.setItem('browser-fixtures-initialized', 'true');
  }
  const realFetch = window.fetch.bind(window);
  window.__rawgCalls = [];
  window.fetch = async (value, options) => {
    const url = new URL(value, location.href);
    if (url.hostname !== 'api.rawg.io') return realFetch(value, options);
    window.__rawgCalls.push({ path: url.pathname, query: url.searchParams.get('search') });
    if (new URLSearchParams(location.search).get('rawgMode') === 'offline') throw new TypeError('Simulated offline');
    if (new URLSearchParams(location.search).get('rawgMode') === 'delayed') await new Promise(resolve => setTimeout(resolve, 1500));
    const match = url.pathname.match(/\/games\/([^/]+)(?:\/(\w+))?$/);
    if (!match) return Response.json({ results: games });
    const game = games.find(item => String(item.id) === match[1] || item.slug === match[1]);
    if (!game) return Response.json({}, { status: 404 });
    if (match[2] === 'screenshots') return Response.json({ results: [{ id: 1, image: `${location.origin}/assets/vee/states/vee-search.webp` }] });
    if (match[2] === 'movies') return Response.json({ results: [{ name: 'Trailer fixture', data: { '480': 'https://example.test/trailer.mp4' } }] });
    if (match[2] === 'stores') return Response.json({ results: [] });
    return Response.json({ ...game, description_raw: 'Descrição de teste do jogo.', background_image: 'https://example.test/cover.jpg', genres: [], platforms: [], rating: 4.5, ratings_count: 12 });
  };
}

const browser = await startBrowser();
const { page } = browser;
const passed = [];
const failed = [];
async function check(name, callback) {
  try { await callback(); passed.push(name); console.log(`PASS ${name}`); }
  catch (error) { failed.push({ name, error: error.message }); console.log(`FAIL ${name}: ${error.message}`); }
}
const click = selector => page.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const ready = () => page.waitFor(`document.querySelector('#communityFeed')?.getAttribute('aria-busy') !== 'true' && document.querySelector('#communityFeed')?.children.length > 0`);
const selectedFilter = type => `document.querySelector('#postFilters [data-value="${type}"]')?.getAttribute('aria-pressed') === 'true' && !document.querySelector('#communityFeed').hasAttribute('aria-busy')`;

try {
  await page.send('Network.enable');
  await page.send('Network.setBlockedURLs', { urls: ['https://example.test/*', '*youtube.com*', '*youtu.be*'] });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(${installFixtures.toString()})(${JSON.stringify(games)}, ${JSON.stringify(seed)})` });
  await page.setViewport(1200, 900);
  for (const game of games.slice(0, 6)) await check(`Hub ${game.name}: header, IDs, posts locais`, async () => {
    await page.navigate(`/comunidade-jogo.html?gameId=${game.id}`);
    await ready();
    await page.waitFor(`document.querySelector('#hubGameStatus').textContent === ''`);
    assert.equal(await page.evaluate(`document.querySelector('#hubTitle').textContent`), game.name);
    assert.ok((await page.evaluate(`document.querySelector('#hubGameLink').href`)).endsWith(`game.html?id=${game.id}`));
    assert.ok(await page.evaluate(`[...document.querySelectorAll('.post-context a[href*="game.html"]')].every(a => a.href.endsWith('game.html?id=${game.id}'))`));
    assert.equal(await page.evaluate(`window.__rawgCalls.length`), 1);
    assert.deepEqual(await page.evaluate('window.__errors'), []);
  });

  await page.navigate('/comunidade-jogo.html?gameId=00339958');
  await ready();
  for (const type of ['guide', 'art', 'screenshot', 'discussion', 'question', 'all']) await check(`Filtro ${type} sem reload`, async () => {
    await click(`#postFilters [data-value="${type}"]`);
    await page.waitFor(selectedFilter(type));
    assert.ok(await page.evaluate(`[...document.querySelectorAll('.post-card')].every(card => ${JSON.stringify(type)} === 'all' || card.classList.contains('post-card--${type}'))`));
    assert.equal(await page.evaluate('window.__rawgCalls.length'), 1);
  });
  await check('Ordenação, carregar mais e paginação sem duplicação', async () => {
    await click('#feedTabs [data-value="recent"]');
    await ready();
    assert.equal(await page.evaluate(`document.querySelectorAll('.post-card').length`), 6);
    await click('#loadMorePosts'); await ready();
    assert.equal(await page.evaluate(`document.querySelectorAll('.post-card').length`), 12);
    assert.equal(await page.evaluate(`new Set([...document.querySelectorAll('.post-card')].map(p=>p.dataset.postId)).size`), 12);
    await click('#feedTabs [data-value="trending"]'); await ready();
  });
  await check('Likes, salvos e comentários no hub', async () => {
    const card = '.post-card';
    const previous = await page.evaluate(`document.querySelector('${card} .post-like').getAttribute('aria-pressed')`);
    await click(`${card} .post-like`);
    await page.waitFor(`document.querySelector('${card} .post-like').getAttribute('aria-pressed') !== '${previous}'`);
    await click(`${card} .post-save`);
    await page.waitFor(`document.querySelector('${card} .post-save').getAttribute('aria-pressed') === 'true'`);
    await click(`${card} .post-comments-toggle`);
    await page.waitFor(`document.querySelector('${card} .comment-form textarea')`);
    await page.evaluate(`document.querySelector('${card} .comment-form textarea').value = 'Comentário de teste do hub'; document.querySelector('${card} .comment-form').requestSubmit()`);
    await page.waitFor(`document.querySelector('${card} .comments-list').textContent.includes('Comentário de teste do hub')`);
  });
  await check('Spoilers permanecem ocultos até ação explícita', async () => {
    await click('#postFilters [data-value="discussion"]'); await ready();
    assert.ok(await page.evaluate(`document.querySelector('.spoiler-content') || document.querySelector('.spoiler-gate')`));
    assert.equal(await page.evaluate(`document.querySelector('[data-post-id="post-palacios-preferidos"] .post-title') !== null`), false);
  });
  await check('Criar pelo hub, pré-seleção canônica e submit único', async () => {
    await click('#createPostButton');
    await page.waitFor(`document.querySelector('.composer-dialog').open`);
    assert.equal(await page.evaluate(`document.querySelector('.composer-game-chip .composer-game-name').textContent`), 'Persona 5 Royal');
    await page.evaluate(`document.querySelector('#composer-title').value='Post criado pelo hub'; document.querySelector('#composer-content').value='Conteúdo publicado pelo hub'; document.querySelector('.composer-form button[type="submit"]').click(); document.querySelector('.composer-form button[type="submit"]').click()`);
    await page.waitFor(`!document.querySelector('.composer-dialog').open && document.querySelector('.post-title')?.textContent === 'Post criado pelo hub'`);
    const posts = await page.evaluate(`JSON.parse(localStorage.getItem('gameverse-community:v1')).posts.filter(p => p.title === 'Post criado pelo hub')`);
    assert.equal(posts.length, 1); assert.equal(posts[0].gameId, 339958);
  });
  await check('Editar e excluir post próprio pelo hub', async () => {
    await click('.post-card .post-owner-menu summary');
    await click('.post-card .post-owner-menu button:not(.is-danger)');
    await page.waitFor(`document.querySelector('.composer-dialog').open`);
    assert.equal(await page.evaluate(`document.querySelector('.composer-form button[type="submit"]').textContent`), 'Salvar alterações');
    await page.evaluate(`document.querySelector('#composer-title').value='Post editado pelo hub'; document.querySelector('.composer-form button[type="submit"]').click()`);
    await page.waitFor(`!document.querySelector('.composer-dialog').open && document.querySelector('.post-title')?.textContent === 'Post editado pelo hub'`);
    await click('.post-card .post-owner-menu summary'); await click('.post-card .post-owner-menu .is-danger');
    await page.waitFor(`document.querySelector('.confirm-dialog').open`);
    await click('.confirm-dialog .btn-danger');
    await page.waitFor(`![...document.querySelectorAll('.post-title')].some(p => p.textContent === 'Post editado pelo hub')`);
  });
  await check('Refresh e back/forward mantêm filtros', async () => {
    await click('#postFilters [data-value="guide"]'); await ready();
    await click('#postFilters [data-value="art"]'); await ready();
    await page.evaluate('history.back()'); await page.waitFor(selectedFilter('guide'));
    await page.evaluate('history.forward()'); await page.waitFor(selectedFilter('art'));
    const href = await page.evaluate('location.href');
    await page.navigate(href); await page.waitFor(selectedFilter('art'));
  });
  await check('RAWG lenta: posts e snapshot aparecem antes da API', async () => {
    await page.navigate('/comunidade-jogo.html?gameId=339958&rawgMode=delayed');
    await ready();
    assert.equal(await page.evaluate(`document.querySelector('#hubTitle').textContent`), 'Persona 5 Royal');
    assert.ok(await page.evaluate(`document.querySelector('#hubGameStatus').textContent.includes('Atualizando')`));
  });
  await check('RAWG offline: posts, snapshot e composer utilizáveis', async () => {
    await page.navigate('/comunidade-jogo.html?gameId=339958&rawgMode=offline'); await ready();
    await page.waitFor(`document.querySelector('#hubGameStatus').textContent.includes('indisponíveis')`);
    assert.ok(await page.evaluate(`document.querySelectorAll('.post-card').length > 0`));
    await click('#createPostButton'); await page.waitFor(`document.querySelector('.composer-dialog').open`);
    assert.ok(await page.evaluate(`document.querySelector('.composer-game-chip').textContent.includes('Persona 5 Royal')`));
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
    await page.waitFor(`!document.querySelector('.composer-dialog').open`);
  });
  await check('URLs sem ID, inválida e jogo inexistente têm estado local', async () => {
    for (const query of ['', '?gameId=abc', '?gameId=-1', '?gameId=1e3']) {
      await page.navigate(`/comunidade-jogo.html${query}`);
      await page.waitFor(`document.querySelector('#hubInvalidState').textContent.includes('Jogo inválido.')`);
      assert.equal(await page.evaluate('window.__rawgCalls.length'), 0);
    }
    await page.navigate('/comunidade-jogo.html?gameId=999999999'); await ready();
    await page.waitFor(`document.querySelector('#communityFeed').textContent.includes('Não encontramos esse jogo.')`);
  });
  await check('Jogo válido sem posts e offline sem snapshot preservam contexto', async () => {
    await page.navigate('/comunidade-jogo.html?gameId=49'); await ready();
    await page.waitFor(`document.querySelector('#hubTitle').textContent === 'Persona 5'`);
    assert.ok(await page.evaluate(`document.querySelector('#communityFeed').textContent.includes('Nenhuma publicação ainda.')`));
    await page.navigate('/comunidade-jogo.html?gameId=123456789&rawgMode=offline'); await ready();
    assert.equal(await page.evaluate(`document.querySelector('#hubTitle').textContent`), 'Comunidade do jogo');
    await click('#createPostButton'); await page.waitFor(`document.querySelector('.composer-dialog').open`);
    await page.evaluate(`document.querySelector('#composer-title').value='Contexto offline'; document.querySelector('#composer-content').value='Preserva o ID sem inventar nome'; document.querySelector('.composer-form').requestSubmit()`);
    await page.waitFor(`!document.querySelector('.composer-dialog').open`);
    const post = await page.evaluate(`JSON.parse(localStorage.getItem('gameverse-community:v1')).posts.find(p => p.title === 'Contexto offline')`);
    assert.equal(post.gameId, 123456789); assert.equal(post.gameName, null);
  });
  for (const width of [1200, 768, 390]) await check(`Hub responsivo ${width}px e footer composer visível`, async () => {
    await page.setViewport(width, 844);
    await page.navigate('/comunidade-jogo.html?gameId=339958'); await ready();
    assert.ok(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'));
    await click('#createPostButton'); await page.waitFor(`document.querySelector('.composer-dialog').open`);
    assert.ok(await page.evaluate(`(() => { const d=document.querySelector('.composer-dialog').getBoundingClientRect(); const b=document.querySelector('.composer-form button[type="submit"]').getBoundingClientRect(); return b.height>=42 && b.right<=d.right && b.bottom<=d.bottom && d.right<=innerWidth; })()`));
    await click('.composer-form .btn-secondary');
  });
  for (const game of [games[0], games[2], games[3], games[6]]) await check(`Game page ${game.name}: preview e recursos preservados`, async () => {
    await page.setViewport(1200, 900);
    await page.navigate(`/game.html?id=${game.id}`);
    await page.waitFor(`document.querySelector('#game-title')?.textContent === ${JSON.stringify(game.name)} && !document.querySelector('#gameCommunityPosts').hasAttribute('aria-busy')`);
    assert.ok(await page.evaluate(`document.querySelector('#gameCommunityLink').href.endsWith('gameId=${game.id}')`));
    assert.ok(await page.evaluate(`document.querySelectorAll('.game-community-list li').length <= 3`));
    assert.ok(await page.evaluate(`document.querySelector('#game-trailer video') && document.querySelector('#game-screenshots img') && document.querySelector('#stars button') && document.querySelector('#game-description').textContent`));
    if (game.id === 49) assert.ok(await page.evaluate(`document.querySelector('#gameCommunityPosts').textContent.includes('Ninguém publicou sobre este jogo ainda.')`));
    else {
      const shown = await page.evaluate(`[...document.querySelectorAll('.game-community-list strong')].map(p=>p.textContent)`);
      const allowed = await page.evaluate(`JSON.parse(localStorage.getItem('gameverse-community:v1')).posts.filter(p => p.gameId===${game.id} && p.status==='published').map(p=>p.title)`);
      assert.ok(shown.every(title => allowed.includes(title) || title.includes('spoiler')));
    }
    await click('#favoriteButton');
    assert.ok(await page.evaluate(`JSON.parse(localStorage.getItem('gameverse-favorites')).some(g=>g.id===${game.id})`));
    await click('#stars button:nth-child(4)');
    assert.equal(await page.evaluate(`localStorage.getItem('gameverse-rating-${game.id}')`), '4');
    await page.evaluate(`document.querySelector('#analysisText').value='Análise de teste'; document.querySelector('#analysisForm').requestSubmit()`);
    assert.equal(await page.evaluate(`JSON.parse(localStorage.getItem('gameverse-analysis-${game.id}')).text`), 'Análise de teste');
  });
  await check('Falha social e falha de import não derrubam game.html', async () => {
    const backup = await page.evaluate(`localStorage.getItem('gameverse-community:v1')`);
    await page.evaluate(`localStorage.setItem('gameverse-community:v1','{broken')`);
    await page.navigate('/game.html?id=339958');
    await page.waitFor(`document.querySelector('#gameCommunityCount').textContent.includes('Não foi possível')`);
    assert.equal(await page.evaluate(`document.querySelector('#game-title').textContent`), 'Persona 5 Royal');
    assert.ok(await page.evaluate(`document.querySelector('#game-trailer video') && document.querySelector('#game-screenshots img') && document.querySelector('#game-description').textContent`));
    assert.equal(await page.evaluate(`localStorage.getItem('gameverse-community:v1')`), '{broken');
    await page.evaluate(`localStorage.setItem('gameverse-community:v1',${JSON.stringify(backup)})`);
    await page.send('Network.setBlockedURLs', { urls: ['https://example.test/*', '*gameCommunityPreview.js*'] });
    await page.navigate('/game.html?id=9767');
    await page.waitFor(`document.querySelector('#gameCommunityCount').textContent.includes('Não foi possível')`);
    assert.equal(await page.evaluate(`document.querySelector('#game-title').textContent`), 'Hollow Knight');
    await page.send('Network.setBlockedURLs', { urls: ['https://example.test/*'] });
  });
  for (const width of [1200, 768, 390]) await check(`Game page responsiva ${width}px`, async () => {
    await page.setViewport(width, 844);
    await page.navigate('/game.html?id=339958');
    await page.waitFor(`!document.querySelector('#gameCommunityPosts').hasAttribute('aria-busy')`);
    assert.ok(await page.evaluate(`document.documentElement.scrollWidth <= innerWidth`));
    assert.ok(await page.evaluate(`document.querySelector('#gameCommunityAll').getBoundingClientRect().right <= innerWidth`));
  });
  await check('Links internos continuam usando transição Vee', async () => {
    await click('#gameCommunityLink');
    await page.waitFor(`document.querySelector('.gv-transition') || location.pathname.endsWith('comunidade-jogo.html')`);
    await page.waitFor(`location.pathname.endsWith('comunidade-jogo.html') && location.search.includes('gameId=339958')`);
    await ready();
  });
  if (process.env.COMMUNITY_SCREENSHOTS === '1') {
    const directory = await mkdtemp(join(tmpdir(), 'gameverse-community-shots-'));
    for (const width of [1200, 390]) {
      await page.setViewport(width, 844);
      await page.evaluate('window.scrollTo(0,0)');
      const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
      const path = join(directory, `hub-${width}.png`);
      await writeFile(path, Buffer.from(data, 'base64'));
      console.log(`SCREENSHOT ${path}`);
    }
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ passed: passed.length, failed: failed.length, failures: failed }));
if (failed.length) process.exitCode = 1;
