import test from 'node:test';
import assert from 'node:assert/strict';
import { rankSimilarGames, styleTagsOf } from '../js/services/similarGames.js';

const re4 = {
  id: 1, name: 'Resident Evil 4',
  genres: [{ slug: 'action' }, { slug: 'adventure' }],
  tags: [{ slug: 'singleplayer' }, { slug: 'horror' }, { slug: 'zombies' }, { slug: 'survival-horror' }, { slug: '3d' }]
};
const game = (id, name, tags, genres = ['action'], ratings = 1000) => ({
  id, name, ratings_count: ratings, metacritic: 85,
  tags: tags.map((slug) => ({ slug })), genres: genres.map((slug) => ({ slug }))
});

test('estilo do jogo vem das tags temáticas, da mais específica para a mais ampla', () => {
  assert.deepEqual(styleTagsOf(re4), ['survival-horror', 'zombies', 'horror']);
});

test('jogos com o mesmo estilo ganham de jogos só com nome parecido', () => {
  const candidates = [
    game(2, 'Resident Evil 4 (2005)', ['survival-horror', 'horror']),
    game(3, 'Silent Hill 2', ['survival-horror', 'psychological-horror', 'horror'], ['action', 'adventure']),
    game(4, 'FIFA 23', ['sports', 'football'], ['sports'], 5000),
    game(5, 'Dead Space', ['survival-horror', 'horror', 'space'], ['action']),
    game(6, 'Resident Evil 2', ['survival-horror', 'zombies', 'horror'], ['action']),
    game(7, 'Resident Evil 3', ['survival-horror', 'zombies'], ['action']),
    game(8, 'Resident Evil Village', ['survival-horror', 'horror'], ['action'])
  ];
  const result = rankSimilarGames(re4, candidates, { seriesIds: new Set([2, 6, 7, 8]) }).map((g) => g.name);
  assert.ok(result.includes('Silent Hill 2'));
  assert.ok(result.includes('Dead Space'));
  assert.ok(!result.includes('FIFA 23'));
  // Mesmo jogo (outra versão) não aparece; da série, no máximo 2.
  assert.ok(!result.includes('Resident Evil 4 (2005)'));
  assert.equal(result.filter((name) => name.startsWith('Resident Evil')).length, 2);
});
