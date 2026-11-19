import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfflineResolver, snapshotKey } from '../js/services/offlineSnapshot.js';

const game = (id, extra = {}) => ({
  id, slug: `jogo-${id}`, name: `Jogo ${id}`, released: '2015-06-01', rating: 4, metacritic: 80, added: 100 - id,
  genres: [{ id: 4, name: 'Action', slug: 'action' }], tags: [], parent_platforms: [{ platform: { id: 1, name: 'PC' } }],
  short_screenshots: [{ image: 'capa.jpg' }, { image: 'shot-1.jpg' }, { image: 'shot-2.jpg' }], ...extra
});

const pool = [
  game(1, { name: 'Hollow Knight', metacritic: 87, tags: ['horror'] }),
  game(2, { name: 'Celeste', released: '2018-01-25', metacritic: 92, genres: [{ id: 51, name: 'Indie', slug: 'indie' }] }),
  game(3, { name: 'Persona 5', released: '2016-09-15', metacritic: 93, parent_platforms: [{ platform: { id: 2, name: 'PlayStation' } }] }),
  game(4, { name: 'Jogo futuro', released: '2099-01-01', metacritic: null })
];
const exactList = { count: 1, results: [pool[0]] };
const resolve = createOfflineResolver({
  lists: { [snapshotKey('/games', { ordering: '-added', page_size: 12 })]: exactList },
  pool,
  games: { 3: { ...pool[2], description_raw: 'Descrição completa' } },
  slugs: { 'jogo-3': 3, 'hollow-knight': 1 },
  screenshots: { 3: [{ id: 9, image: 'p5.jpg' }] },
  stores: { 3: [{ store_id: 1, url: 'https://loja.test' }] },
  movies: {}
});

test('a chave ignora a API key e a ordem dos parâmetros', () => {
  assert.equal(snapshotKey('/games', { page_size: 12, key: 'segredo', ordering: '-added' }), snapshotKey('/games', { ordering: '-added', page_size: 12 }));
});

test('lista salva exatamente é devolvida como estava', () => {
  assert.equal(resolve('/games', { ordering: '-added', page_size: 12, key: 'x' }), exactList);
});

test('filtros combinados funcionam sobre o pool', () => {
  assert.deepEqual(resolve('/games', { genres: 'indie' }).results.map((g) => g.id), [2]);
  assert.deepEqual(resolve('/games', { genres: '51' }).results.map((g) => g.id), [2]);
  assert.deepEqual(resolve('/games', { tags: 'horror' }).results.map((g) => g.id), [1]);
  assert.deepEqual(resolve('/games', { parent_platforms: '2' }).results.map((g) => g.id), [3]);
  assert.deepEqual(resolve('/games', { metacritic: '90,100', ordering: '-metacritic' }).results.map((g) => g.id), [3, 2]);
  assert.deepEqual(resolve('/games', { dates: '2016-01-01,2019-12-31', ordering: 'name' }).results.map((g) => g.id), [2, 3]);
});

test('busca por nome e paginação', () => {
  assert.deepEqual(resolve('/games', { search: 'hollow' }).results.map((g) => g.id), [1]);
  const page2 = resolve('/games', { page: 2, page_size: 2, ordering: 'name' });
  assert.equal(page2.count, 4);
  assert.deepEqual(page2.results.map((g) => g.name), ['Jogo futuro', 'Persona 5']);
});

test('detalhe por id ou slug; sem detalhe completo usa o resumo do pool', () => {
  assert.equal(resolve('/games/3').description_raw, 'Descrição completa');
  assert.equal(resolve('/games/jogo-3').id, 3);
  assert.equal(resolve('/games/hollow-knight').name, 'Hollow Knight');
  assert.equal(resolve('/games/nao-existe'), null);
});

test('screenshots, lojas e trailers', () => {
  assert.deepEqual(resolve('/games/3/screenshots').results, [{ id: 9, image: 'p5.jpg' }]);
  // Sem screenshots salvas: usa as do pool (pulando a primeira, que é a capa).
  assert.deepEqual(resolve('/games/1/screenshots').results.map((s) => s.image), ['shot-1.jpg', 'shot-2.jpg']);
  assert.equal(resolve('/games/3/stores').results[0].url, 'https://loja.test');
  assert.deepEqual(resolve('/games/1/movies').results, []);
});
