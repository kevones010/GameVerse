// Optional live check of the taxonomy used by the catalog. Never prints keys/URLs.
import assert from 'node:assert/strict';
import { getGamesList } from '../js/services/rawgService.js';

const cache = new Map();
globalThis.sessionStorage = { getItem: key => cache.get(key) ?? null, setItem: (key, value) => cache.set(key, value) };
const filters = [
  { label: 'Aventura', params: { genres: 'adventure' }, matches: game => game.genres?.some(genre => genre.slug === 'adventure') },
  { label: 'Terror', params: { tags: 'horror' }, matches: game => game.tags?.some(tag => tag.slug === 'horror') },
  { label: 'PC', params: { parent_platforms: '1' }, matches: game => game.parent_platforms?.some(item => item.platform.id === 1) },
  { label: 'PlayStation', params: { parent_platforms: '2' }, matches: game => game.parent_platforms?.some(item => item.platform.id === 2) },
  { label: 'Nintendo', params: { parent_platforms: '7' }, matches: game => game.parent_platforms?.some(item => item.platform.id === 7) }
];
let passed = 0;
for (const filter of filters) {
  try {
    const results = await getGamesList({ ...filter.params, ordering: '-added', page_size: 5 });
    assert.ok(results.length > 0);
    assert.ok(results.every(filter.matches));
    passed++;
    console.log(JSON.stringify({ filter: filter.label, passed: true, checked: results.length,
      examples: results.slice(0, 3).map(({ id, name }) => ({ id, name })) }));
  } catch {
    console.log(JSON.stringify({ filter: filter.label, passed: false, reason: 'API indisponível ou resultados incompatíveis com a taxonomia esperada.' }));
  }
}
console.log(JSON.stringify({ passed, failed: filters.length - passed }));
if (passed !== filters.length) process.exitCode = 1;
