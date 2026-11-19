// "Você também pode gostar": jogos parecidos de verdade, não só com nome parecido.
//
// Como funciona:
// 1. Pega as tags que definem o estilo do jogo (ex.: Resident Evil 4 -> survival-horror, zombies, horror).
// 2. Busca jogos bem avaliados com essas tags e da mesma série.
// 3. Dá pontos para cada tag/gênero em comum e prefere jogos populares.
//    Jogos da mesma série entram no máximo 2, para sobrar espaço para descobertas (ex.: Silent Hill).

import { getGamesList, getGameSeries } from './rawgService.js';
import { baseGameName } from '../homeQueries.js';

// Tags que dizem "que tipo de jogo é", da mais específica para a mais ampla.
export const STYLE_TAGS = [
  'survival-horror', 'psychological-horror', 'souls-like', 'metroidvania', 'roguelike', 'roguelite',
  'jrpg', 'visual-novel', 'point-and-click', 'immersive-sim', 'stealth', 'hack-and-slash', 'bullet-hell',
  'shoot-em-up', 'rhythm', 'deckbuilding', 'card-game', 'city-builder', 'farming-sim', 'life-sim',
  'turn-based', 'turn-based-combat', 'tactical', 'real-time-strategy', 'grand-strategy', 'tower-defense',
  'racing', 'fighting', 'sports', 'football', 'puzzle', 'platformer', 'precision-platformer',
  'detective', 'mystery', 'cyberpunk', 'post-apocalyptic', 'zombies', 'space', 'sci-fi', 'dark-fantasy',
  'open-world', 'sandbox', 'survival', 'crafting', 'horror', 'anime', 'pixel-graphics', 'fantasy', 'medieval'
];
const STYLE_RANK = new Map(STYLE_TAGS.map((tag, index) => [tag, index]));
// Tags amplas demais: contam pouco (senão "survival" junta Resident Evil com Don't Starve).
const BROAD_TAGS = new Set(['survival', 'crafting', 'horror', 'open-world', 'sandbox', 'fantasy', 'pixel-graphics', 'anime', 'medieval', 'sci-fi', 'space']);
// Câmera/perspectiva: jogos em terceira pessoa combinam mais com outros em terceira pessoa.
const PERSPECTIVE_TAGS = ['third-person', 'first-person', 'top-down', 'isometric', '2d', 'side-scroller'];

// Aqui "Resident Evil 4" e "Resident Evil 4 (2005)" contam como o mesmo jogo.
const sameGameKey = (name) => baseGameName(String(name || '').replace(/\(\d{4}\)/g, ''));
// "Resident Evil Revelations" e "Resident Evil 2" são da mesma franquia de "Resident Evil 4".
const franchiseKey = (name) => String(name || '').toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').trim().split(/\s+/).slice(0, 2).join(' ');
const tagSlugs = (game) => (game?.tags || []).map((tag) => (typeof tag === 'string' ? tag : tag?.slug)).filter(Boolean);
const genreSlugs = (game) => (game?.genres || []).map((genre) => genre?.slug).filter(Boolean);

export function styleTagsOf(game, max = 3) {
  return tagSlugs(game)
    .filter((slug) => STYLE_RANK.has(slug))
    .sort((a, b) => STYLE_RANK.get(a) - STYLE_RANK.get(b))
    .slice(0, max);
}

// Pontuação pura (testável): quanto mais estilo e gênero em comum, mais parecido.
export function rankSimilarGames(game, candidates, { seriesIds = new Set(), limit = 8, maxFromSeries = 2 } = {}) {
  const styleList = styleTagsOf(game, 6);
  const styles = new Set(styleList);
  const primaryStyle = styleList[0];
  const perspectives = PERSPECTIVE_TAGS.filter((slug) => tagSlugs(game).includes(slug));
  const genres = new Set(genreSlugs(game));
  const ownBase = sameGameKey(game.name);
  const seen = new Set();

  const scored = candidates
    .filter((candidate) => candidate?.id && candidate.id !== game.id)
    .filter((candidate) => {
      const base = sameGameKey(candidate.name);
      if (!base || base === ownBase || seen.has(base)) return false;
      seen.add(base);
      return true;
    })
    .map((candidate) => {
      const candidateTags = new Set(tagSlugs(candidate));
      let styleScore = 0;
      let sharedStyles = 0;
      styles.forEach((slug) => {
        if (!candidateTags.has(slug)) return;
        sharedStyles += 1;
        styleScore += slug === primaryStyle ? 5 : BROAD_TAGS.has(slug) ? 0.5 : 2;
      });
      const samePerspective = perspectives.some((slug) => candidateTags.has(slug)) ? 2 : 0;
      const sharedGenres = genreSlugs(candidate).filter((slug) => genres.has(slug)).length;
      const popularity = Math.log10((Number(candidate.ratings_count) || 0) + 1);
      const quality = (Number(candidate.metacritic) || 70) / 100;
      return { candidate, sharedStyles, score: styleScore + samePerspective + sharedGenres * 1.5 + popularity + quality * 2 };
    })
    // Precisa ter pelo menos um estilo em comum (ou ser da série). Sem estilos, vale o gênero.
    .filter(({ candidate, sharedStyles, score }) => seriesIds.has(candidate.id) || (styles.size ? sharedStyles > 0 : score > 3))
    .sort((a, b) => b.score - a.score);

  const result = [];
  let fromSeries = 0;
  const ownFranchise = franchiseKey(game.name);
  const isSameFranchise = (candidate) => seriesIds.has(candidate.id) || (ownFranchise.includes(' ') && franchiseKey(candidate.name) === ownFranchise);
  for (const { candidate } of scored) {
    if (isSameFranchise(candidate)) {
      if (fromSeries >= maxFromSeries) continue;
      fromSeries += 1;
    }
    result.push(candidate);
    if (result.length >= limit) break;
  }
  return result;
}

export async function getSimilarGames(game, { limit = 8 } = {}) {
  const styles = styleTagsOf(game, 2);
  const genres = genreSlugs(game).slice(0, 2);
  const base = { exclude_additions: true, metacritic: '70,100', ordering: '-added', page_size: 40 };

  const queries = styles.length
    ? styles.map((tag) => ({ ...base, tags: tag }))
    : [{ ...base, genres: genres.join(',') }];

  const [lists, series] = await Promise.all([
    Promise.all(queries.map((params) => getGamesList(params))),
    getGameSeries(game.id)
  ]);

  const seriesIds = new Set(series.map((item) => item.id));
  return rankSimilarGames(game, [...lists.flat(), ...series], { seriesIds, limit });
}
