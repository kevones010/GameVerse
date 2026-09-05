import test from 'node:test';
import assert from 'node:assert/strict';
import { CommunityService } from '../js/services/community/communityService.js';
import { CommunitySession } from '../js/services/community/communitySession.js';
import { LocalCommunityRepository, COMMUNITY_STORAGE_KEY } from '../js/services/community/localCommunityRepository.js';
import { normalizeGameId, validatePost, POST_TYPES } from '../js/services/community/communityValidation.js';
import { searchGames } from '../js/services/rawgService.js';

function fixture() {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const repository = new LocalCommunityRepository(storage);
  return { service: new CommunityService(repository, new CommunitySession(repository)), repository, storage };
}
const input = overrides => ({ type: 'guide', title: 'Guia de teste', content: 'Conteúdo suficiente para publicação.', ...overrides });

test('IDs canônicos: decimal positivo seguro; rejeita coerções ambíguas', () => {
  for (const value of [339958, '339958', ' 00339958 ']) assert.equal(normalizeGameId(value), 339958);
  for (const value of [null, undefined, '', ' ', 'abc', '12abc', 0, -1, 1.1, '1e3', '0x10', true, [], Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(normalizeGameId(value), null, String(value));
  }
});

test('snapshot independente de RAWG, sem objeto inteiro e remoção explícita', async () => {
  const { service, repository } = fixture();
  const created = await service.createPost(input({ gameId: '00049', gameName: 'Persona 5', gameSlug: 'persona-5', background_image: 'https://example.test/unused.jpg' }));
  assert.deepEqual(created.game, { id: 49, name: 'Persona 5', slug: 'persona-5' });
  assert.equal((await repository.getPostById(created.id)).background_image, undefined);
  const edited = await service.updatePost(created.id, input({ gameId: 49 }));
  assert.equal(edited.game.name, 'Persona 5');
  const detached = await service.updatePost(created.id, input({ gameId: null, gameName: 'Stale title' }));
  assert.equal(detached.game, null);
  const neutral = await service.createPost(input({ gameId: 12345678 }));
  assert.equal(neutral.game.id, 12345678);
  assert.equal((await repository.getPostById(neutral.id)).gameName, null);
});

test('gameId filtra antes da ordenação/paginação, nunca retorna feed global para URL inválida', async () => {
  const { service } = fixture();
  const id = 12345678;
  for (let index = 0; index < 9; index++) await service.createPost(input({ gameId: id, title: `Publicação ${index}`, type: POST_TYPES[index % 5] }));
  const first = await service.listPostsByGame(String(id), { tab: 'trending', limit: 6 });
  const second = await service.listPostsByGame(id, { tab: 'trending', limit: 6, cursor: first.nextCursor });
  assert.equal(first.total, 9);
  assert.equal(first.items.length, 6);
  assert.equal(second.items.length, 3);
  assert.equal(new Set([...first.items, ...second.items].map(post => post.id)).size, 9);
  assert.ok([...first.items, ...second.items].every(post => post.game.id === id));
  const globalFiltered = await service.listPosts({ gameId: id, tab: 'recent' });
  const wrapperFiltered = await service.listPostsByGame(id, { tab: 'recent' });
  assert.deepEqual(globalFiltered, wrapperFiltered);
  for (const type of POST_TYPES) {
    const filtered = await service.listPostsByGame(id, { type });
    assert.ok(filtered.items.length > 0);
    assert.ok(filtered.items.every(post => post.type === type));
  }
  for (const bad of [null, '', 'abc', '-1', '1e3']) {
    await assert.rejects(service.listPostsByGame(bad), { code: 'invalid-game-id' });
    await assert.rejects(service.countPostsByGame(bad), { code: 'invalid-game-id' });
    await assert.rejects(service.getCommunityGameStats(bad), { code: 'invalid-game-id' });
  }
  assert.equal((await service.listPostsByGame(77777777)).total, 0);
});

test('stats, tags e criadores derivados exclusivamente de published/public e atualizados após exclusão', async () => {
  const { service, storage } = fixture();
  const post = await service.createPost(input({ gameId: 49, gameName: 'Persona 5', tags: 'persona5, guia' }));
  const state = JSON.parse(storage.getItem(COMMUNITY_STORAGE_KEY));
  state.posts.push({ ...state.posts.find(item => item.id === post.id), id: 'private-fixture', visibility: 'private' });
  state.posts.push({ ...state.posts.find(item => item.id === post.id), id: 'deleted-fixture', status: 'deleted' });
  storage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(state));
  const stats = await service.getCommunityGameStats('049');
  assert.equal(stats.total, 1);
  assert.equal(await service.countPostsByGame(49), 1);
  assert.deepEqual(stats.counts, { guide: 1, art: 0, screenshot: 0, discussion: 0, question: 0 });
  assert.equal(stats.tags.length, 2);
  assert.equal(stats.creators[0].postsCount, 1);
  assert.equal(stats.game.id, 49);
  await service.deletePost(post.id);
  assert.equal(await service.countPostsByGame(49), 0);
  assert.equal((await service.getCommunityGameStats(49)).game, null);
});

test('interações, comentários, permissões, spoilers e contadores preservados no resultado por jogo', async () => {
  const { service } = fixture();
  const post = await service.createPost(input({ gameId: 49, spoiler: true, spoilerLabel: 'Final' }));
  await service.toggleLike(post.id);
  await service.toggleSaved(post.id);
  const comment = await service.createComment(post.id, { content: 'Comentário com spoiler', spoiler: true });
  const mapped = (await service.listPostsByGame(49)).items[0];
  assert.equal(mapped.likesCount, 1);
  assert.equal(mapped.savesCount, 1);
  assert.equal(mapped.commentsCount, 1);
  assert.equal(mapped.likedByCurrentUser, true);
  assert.equal(mapped.savedByCurrentUser, true);
  assert.equal(mapped.spoiler, true);
  assert.equal((await service.listComments(post.id)).items[0].spoiler, true);
  await service.deleteComment(comment.comment.id);
  assert.equal((await service.getPostById(post.id)).commentsCount, 0);
  assert.equal((await service.listSavedPosts()).items.some(item => item.id === post.id), true);
  const other = (await service.listPosts({ limit: 12 })).items.find(item => item.authorId !== post.authorId);
  await assert.rejects(service.updatePost(other.id, input()), { code: 'forbidden' });
  await service.deletePost(post.id);
  assert.equal((await service.listPostsByGame(49)).total, 0);
});

test('falha de armazenamento nunca apaga estado local', async () => {
  const { service, storage } = fixture();
  storage.setItem(COMMUNITY_STORAGE_KEY, '{invalid-json');
  await assert.rejects(service.listPostsByGame(339958), { code: 'storage-invalid' });
  assert.equal(storage.getItem(COMMUNITY_STORAGE_KEY), '{invalid-json');
});

test('validação mantém URLs HTTPS, limites e IDs estritos', () => {
  for (const gameId of ['abc', '1e3', '0x10', -1, 0, 1.5]) {
    assert.throws(() => validatePost(input({ gameId })), error => Boolean(error.fieldErrors.gameId));
  }
  for (const mediaUrl of ['javascript:alert(1)', 'http://example.test/x', 'https://user:pass@example.test/x']) {
    assert.throws(() => validatePost(input({ mediaUrl })), error => Boolean(error.fieldErrors.mediaUrl));
  }
  assert.throws(() => validatePost(input({ gameId: 49, gameName: 'x'.repeat(201) })), error => Boolean(error.fieldErrors.gameId));
});

test('RAWG search: queries vazias/curtas não acessam rede nem configuração', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => { calls++; throw new Error('Unexpected request'); };
  try {
    for (const query of ['', ' ', 'a', null]) assert.deepEqual(await searchGames(query), []);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});
