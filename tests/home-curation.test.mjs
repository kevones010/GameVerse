import test from 'node:test';
import assert from 'node:assert/strict';
import { baseGameName, curateGames, homeQueries } from '../js/homeQueries.js';
import { trimForTranslation, splitIntoChunks } from '../js/services/translationService.js';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { isFamilyFriendly } = await import('../js/services/rawgService.js');

test('edições do mesmo jogo viram um só', () => {
  assert.equal(baseGameName('The Witcher 3: Wild Hunt'), baseGameName('The Witcher 3 Wild Hunt - Complete Edition'));
  assert.equal(baseGameName('Skyrim Special Edition'), baseGameName('Skyrim'));
  assert.notEqual(baseGameName('Grand Theft Auto IV'), baseGameName('Grand Theft Auto V'));
});

test('curadoria remove duplicados e jogos com poucas avaliações', () => {
  const games = [
    { id: 1, name: 'Obscuro', rating: 5, ratings_count: 6 },
    { id: 2, name: 'The Witcher 3: Wild Hunt', rating: 4.6, ratings_count: 7000 },
    { id: 3, name: 'The Witcher 3 Wild Hunt - Complete Edition', rating: 4.8, ratings_count: 800 },
    { id: 4, name: 'Hollow Knight', rating: 4.4, ratings_count: 2800 }
  ];
  assert.deepEqual(curateGames(games, { sort: 'none' }).map((g) => g.id), [2, 4]);
  assert.equal(curateGames(games, { minRatings: 0, limit: 1, sort: 'none' })[0].id, 1);
});

test('consultas da Home pedem jogos reconhecidos e sem DLCs', () => {
  const queries = homeQueries(new Date('2026-11-19T12:00:00'));
  assert.equal(queries.indie.metacritic, '75,100');
  assert.equal(queries.indie.exclude_additions, true);
  assert.equal(queries.launches.dates, '2025-05-19,2026-11-19');
});

test('jogos adultos são filtrados', () => {
  assert.equal(isFamilyFriendly({ name: 'Hentai Clicker', tags: [{ slug: 'hentai' }] }), false);
  assert.equal(isFamilyFriendly({ name: 'Algo', tags: [{ slug: 'nsfw' }] }), false);
  assert.equal(isFamilyFriendly({ name: 'Algo', esrb_rating: { slug: 'adults-only' } }), false);
  // Classificação "mature" (como The Witcher 3 ou Persona 5) continua liberada.
  assert.equal(isFamilyFriendly({ name: 'Persona 5 Royal', tags: [{ slug: 'sexual-content' }], esrb_rating: { slug: 'mature' } }), true);
});

test('textos longos são cortados no fim de uma frase e divididos em pedaços', () => {
  const text = 'Uma frase curta. '.repeat(300);
  const trimmed = trimForTranslation(text, 200);
  assert.ok(trimmed.length <= 201);
  assert.ok(trimmed.endsWith('.…') || trimmed.endsWith('…'));
  const chunks = splitIntoChunks(text, 100);
  assert.ok(chunks.every((chunk) => chunk.length <= 100));
  assert.equal(chunks.join(''), text);
});
