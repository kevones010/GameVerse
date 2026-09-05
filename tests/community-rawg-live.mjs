// Optional read-only integration check. Never logs config, requests or keys.
import { getGame, searchGames } from '../js/services/rawgService.js';
const cache = new Map();
globalThis.sessionStorage = { getItem: key => cache.get(key) ?? null, setItem: (key, value) => cache.set(key, value) };
const titles = ['Persona 5 Royal', 'Persona 3 Reload', 'Hollow Knight', 'Elden Ring', 'Resident Evil 4', 'Metaphor', 'Persona 5'];
let failed = false;
for (const title of titles) {
  try {
    const results = await searchGames(title);
    console.log(JSON.stringify({ query: title, results: results.map(({ id, name, slug, released }) => ({ id, name, slug, released })) }));
  } catch (error) {
    failed = true;
    console.log(JSON.stringify({ query: title, error: 'RAWG indisponível neste ambiente', status: error.status, cause: error.cause?.code, missingConfig: /configurada/.test(error.message) }));
  }
}
for (const slug of ['persona-5-royal', 'persona-3-reload', 'hollow-knight', 'elden-ring', 'resident-evil-4-2023', 'metaphor-refantazio']) {
  try {
    const { id, name } = await getGame(slug);
    console.log(JSON.stringify({ slug, id, name }));
  } catch {
    failed = true;
    console.log(JSON.stringify({ slug, error: 'RAWG indisponível neste ambiente' }));
  }
}
process.exitCode = failed ? 1 : 0;
