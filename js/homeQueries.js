// O que cada seção da Home pede à RAWG e como os resultados são "curados".
// Fica separado para a Home e o gerador do modo apresentação usarem exatamente as mesmas consultas.

import { sortByRelevance } from './utils.js';

function isoDate(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// exclude_additions tira DLCs e expansões ("Blood and Wine", "Hearts of Stone"…).
// metacritic 75+ garante jogos reconhecidos, em vez de jogos com nota alta mas só 5 votos.
export function homeQueries(today = new Date()) {
  const from = new Date(today);
  from.setMonth(from.getMonth() - 18);
  const base = { exclude_additions: true, page_size: 40 };
  return {
    launches: { ...base, dates: `${isoDate(from)},${isoDate(today)}`, ordering: '-added' },
    trending: { ...base, ordering: '-added' },
    topRated: { ...base, metacritic: '90,100', ordering: '-metacritic' },
    rpg: { ...base, genres: '5', metacritic: '75,100', ordering: '-added' },
    action: { ...base, genres: '4', metacritic: '75,100', ordering: '-added' },
    adventure: { ...base, genres: '3', metacritic: '75,100', ordering: '-added' },
    indie: { ...base, genres: '51', metacritic: '75,100', ordering: '-added' }
  };
}

export function upcomingQuery(today = new Date()) {
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextYear = new Date(today);
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  return { exclude_additions: true, dates: `${isoDate(tomorrow)},${isoDate(nextYear)}`, ordering: '-added', page_size: 40 };
}

// "The Witcher 3: Wild Hunt" e "The Witcher 3 Wild Hunt - Complete Edition" viram o mesmo jogo.
const EDITION = /\s*[-–—:]?\s*\(?(complete|definitive|game of the year|goty|deluxe|ultimate|enhanced|special|anniversary|director'?s cut|gold|premium|standard|digital deluxe)( edition)?\)?\s*$/i;

export function baseGameName(name = '') {
  let base = String(name).toLowerCase().trim();
  let previous;
  do {
    previous = base;
    base = base.replace(EDITION, '').replace(/\s+edition$/i, '');
  } while (base !== previous);
  return base.replace(/[^\p{L}\p{N}]+/gu, '');
}

// Remove duplicados (edições do mesmo jogo), exige um mínimo de avaliações e limita a quantidade.
export function curateGames(games = [], { minRatings = 30, limit = 12, sort = 'relevance' } = {}) {
  const seen = new Set();
  const unique = [];
  games.forEach((game) => {
    if (!game?.id || (Number(game.ratings_count) || 0) < minRatings) return;
    const key = baseGameName(game.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(game);
  });
  const ordered = sort === 'relevance' ? sortByRelevance(unique) : unique;
  return ordered.slice(0, limit);
}
