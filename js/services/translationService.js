// Tradução automática das sinopses (inglês -> português).
//
// Ordem de tentativa:
// 1. Cache no navegador (cada sinopse é traduzida uma vez só).
// 2. Tradutor embutido do Chrome (API "Translator"): roda no próprio computador, sem limite e
//    funciona até offline depois de baixado. Na primeira vez o Chrome precisa baixar o pacote de
//    idioma, e isso só pode começar com um clique da pessoa (botão "Traduzir para português").
// 3. MyMemory (api.mymemory.translated.net): serviço gratuito para outros navegadores.
//    Sem cadastro o limite é ~5.000 caracteres por dia; com MYMEMORY_EMAIL no config.local.js, ~50.000.

import { getLocalConfig } from './localConfig.js';

const CACHE_PREFIX = 'gameverse-traducao:v1:';
const MAX_CHARS = 2400;
const MYMEMORY_CHUNK = 450;

function cacheGet(key) {
  try {
    return localStorage.getItem(CACHE_PREFIX + key);
  } catch {
    return null;
  }
}

function cacheSet(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, value);
  } catch { /* sem espaço ou bloqueado: só não guarda */ }
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

// Corta textos muito longos no fim de uma frase, para a tradução não ficar pesada.
export function trimForTranslation(text, max = MAX_CHARS) {
  const clean = String(text || '').replace(/<[^>]*>/g, '').replace(/\r/g, '').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return `${cut.slice(0, lastStop > max * 0.5 ? lastStop + 1 : max).trim()}…`;
}

// Divide em pedaços de até `size` caracteres sem quebrar frases (limite do MyMemory).
export function splitIntoChunks(text, size = MYMEMORY_CHUNK) {
  const sentences = String(text).match(/[^.!?\n]+[.!?]*\s*|\n+/g) || [String(text)];
  const chunks = [];
  let current = '';
  sentences.forEach((sentence) => {
    if ((current + sentence).length > size && current) {
      chunks.push(current);
      current = '';
    }
    if (sentence.length > size) {
      for (let i = 0; i < sentence.length; i += size) chunks.push(sentence.slice(i, i + size));
    } else {
      current += sentence;
    }
  });
  if (current) chunks.push(current);
  return chunks;
}

// ---------- Tradutor embutido do Chrome ----------
let chromeTranslator = null;

async function chromeAvailability() {
  if (typeof self === 'undefined' || !('Translator' in self)) return 'unsupported';
  try {
    return await withTimeout(self.Translator.availability({ sourceLanguage: 'en', targetLanguage: 'pt' }), 3000);
  } catch {
    return 'unsupported';
  }
}

async function getChromeTranslator({ allowDownload, onProgress }) {
  if (chromeTranslator) return chromeTranslator;
  const availability = await chromeAvailability();
  if (availability === 'available' || ((availability === 'downloadable' || availability === 'downloading') && allowDownload)) {
    chromeTranslator = await self.Translator.create({
      sourceLanguage: 'en',
      targetLanguage: 'pt',
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => onProgress?.(event.loaded));
      }
    });
    return chromeTranslator;
  }
  if (availability === 'downloadable' || availability === 'downloading') return 'needs-download';
  return null;
}

// ---------- MyMemory ----------
function decodeEntities(text) {
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${text}`, 'text/html');
  return doc.body.textContent || '';
}

async function myMemoryChunk(chunk, email) {
  if (!chunk.trim()) return chunk;
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', chunk.trim());
  url.searchParams.set('langpair', 'en|pt-BR');
  if (email) url.searchParams.set('de', email);
  const response = await withTimeout(fetch(url), 12000);
  const data = await response.json();
  if (!response.ok || data.quotaFinished || Number(data.responseStatus) !== 200) {
    throw new Error('Limite diário do tradutor gratuito atingido.');
  }
  return `${decodeEntities(data.responseData?.translatedText || '')}${/\n/.test(chunk) ? '\n' : ' '}`;
}

// Traduz os pedaços 3 de cada vez (mais rápido, sem sobrecarregar o serviço).
async function myMemoryTranslate(text) {
  const { MYMEMORY_EMAIL } = await getLocalConfig();
  const chunks = splitIntoChunks(text);
  const parts = new Array(chunks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(3, chunks.length) }, async () => {
    while (next < chunks.length) {
      const index = next++;
      parts[index] = await myMemoryChunk(chunks[index], MYMEMORY_EMAIL);
    }
  }));
  return parts.join('').replace(/ +\n/g, '\n').trim();
}

/**
 * Traduz um texto para português.
 * Retorna { text, provider } quando traduziu; { needsDownload: true } quando o Chrome pode
 * traduzir mas precisa de um clique para baixar o idioma; ou lança erro se nada funcionou.
 */
export async function translateToPortuguese(text, { cacheKey, allowDownload = false, onProgress } = {}) {
  const source = trimForTranslation(text);
  if (!source) return { text: '', provider: 'vazio' };

  const cached = cacheKey ? cacheGet(cacheKey) : null;
  if (cached) return { text: cached, provider: 'cache' };

  const translator = await getChromeTranslator({ allowDownload, onProgress });
  if (translator && translator !== 'needs-download') {
    const translated = await translator.translate(source);
    if (cacheKey) cacheSet(cacheKey, translated);
    return { text: translated, provider: 'chrome' };
  }

  try {
    const translated = await myMemoryTranslate(source);
    if (cacheKey) cacheSet(cacheKey, translated);
    return { text: translated, provider: 'mymemory' };
  } catch (error) {
    if (translator === 'needs-download') return { needsDownload: true };
    throw error;
  }
}

export function getCachedTranslation(cacheKey) {
  return cacheGet(cacheKey);
}
