import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Never load the developer's API keys or call the real YouTube API in this suite.
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('/services/localConfig.js')) return {
      format: 'module', shortCircuit: true,
      source: 'export async function getLocalConfig() { return {YOUTUBE_API_KEY:"unit-fixture"}; }'
    };
    return nextLoad(url, context);
  }
});
const { getYouTubeTrailer } = await import('../js/services/youtubeService.js');
const royal = { gameId: 339958, gameName: 'Persona 5 Royal', gameSlug: 'persona-5-royal' };
const hollow = { gameId: 9767, gameName: 'Hollow Knight', gameSlug: 'hollow-knight' };
const resident = { gameId: 795632, gameName: 'Resident Evil 4', gameSlug: 'resident-evil-4-2023' };

function fixture(t, titles) {
  const original = { fetch: globalThis.fetch, storage: globalThis.sessionStorage };
  const values = new Map();
  const calls = [];
  globalThis.sessionStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  globalThis.fetch = async url => {
    const parsed = new URL(url);
    calls.push(parsed.searchParams.get('q'));
    assert.equal(parsed.searchParams.get('videoEmbeddable'), 'true');
    return Response.json({ items: titles.map((title, index) => ({
      id: { videoId: `fixture000${index}` }, snippet: { title, description: '' }
    })) });
  };
  t.after(() => { globalThis.fetch = original.fetch; globalThis.sessionStorage = original.storage; });
  return { values, calls };
}

for (const title of ['Mario Official Trailer', 'Call of Duty Launch Trailer', 'Fortnite Official Trailer']) {
  test(`Persona 5 Royal rejeita ${title}`, async t => {
    const { values } = fixture(t, [title]);
    assert.equal(await getYouTubeTrailer(royal), null);
    assert.equal(values.size, 0);
  });
}
for (const [game, title] of [
  [royal, 'Persona 5 Royal Launch Trailer'],
  [hollow, 'Hollow Knight Release Trailer'],
  [resident, 'Resident Evil 4 Remake - Official Trailer'],
  [resident, 'Resident Evil 4 (2023) - Launch Trailer']
]) {
  test(`aceita trailer correspondente: ${title}`, async t => {
    fixture(t, [title]);
    assert.equal((await getYouTubeTrailer(game))?.title, title);
  });
}
test('Elden Ring rejeita Fortnite', async t => {
  fixture(t, ['Fortnite Official Trailer']);
  assert.equal(await getYouTubeTrailer({ gameId: 326243, gameName: 'Elden Ring' }), null);
});
test('nome exige tokens da edição e número correto, sem aceitar review', async t => {
  fixture(t, ['Persona 5 Launch Trailer', 'Persona 15 Royal Official Trailer', 'Persona 5 Royal Review']);
  assert.equal(await getYouTubeTrailer(royal), null);
});
test('Resident Evil 4 de 2023 rejeita vídeo explicitamente de 2005', async t => {
  fixture(t, ['Resident Evil 4 (2005) Official Trailer']);
  assert.equal(await getYouTubeTrailer(resident), null);
});
test('cache separa jogos homônimos por RAWG ID e ignora cache antigo', async t => {
  const { values, calls } = fixture(t, ['Resident Evil 4 (2023) Official Trailer']);
  values.set('gameverse-youtube-trailer:resident evil 4', JSON.stringify({ videoId: 'old', timestamp: Date.now() }));
  await getYouTubeTrailer(resident);
  await getYouTubeTrailer({ ...resident, gameId: 56184, gameSlug: 'resident-evil-4' });
  assert.equal(calls.length, 2);
  assert.ok(values.has('gameverse-youtube-trailer:v2:795632'));
  assert.ok(values.has('gameverse-youtube-trailer:v2:56184'));
  await getYouTubeTrailer({ ...resident, gameId: '0795632' });
  assert.equal(calls.length, 2);
  assert.ok(values.has('gameverse-youtube-trailer:resident evil 4'));
});
test('cache com outro gameId no payload não é reutilizado', async t => {
  const { values, calls } = fixture(t, ['Persona 5 Royal Launch Trailer']);
  values.set('gameverse-youtube-trailer:v2:339958', JSON.stringify({ gameId: 49, videoId: 'wrong', timestamp: Date.now() }));
  assert.equal((await getYouTubeTrailer(royal)).title, 'Persona 5 Royal Launch Trailer');
  assert.equal(calls.length, 1);
});
test('cache indisponível não impede trailer e falha de rede retorna null', async t => {
  fixture(t, ['Hollow Knight Release Trailer']);
  globalThis.sessionStorage = { getItem() { throw new Error('Read fixture'); }, setItem() { throw new Error('Quota fixture'); } };
  assert.ok(await getYouTubeTrailer(hollow));
  globalThis.fetch = async () => { throw new TypeError('Offline fixture'); };
  assert.equal(await getYouTubeTrailer(hollow), null);
});
test('assinatura antiga ou identidade inválida são rejeitadas explicitamente', async t => {
  const { calls } = fixture(t, []);
  for (const game of ['Hollow Knight', { gameId: 'hollow-knight', gameName: 'Hollow Knight' }, { gameId: 0, gameName: 'Hollow Knight' }]) {
    await assert.rejects(getYouTubeTrailer(game), TypeError);
  }
  assert.equal(calls.length, 0);
});
