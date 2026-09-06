// Personal data is optional. Never replace unreadable data with an empty value.
function readPersonalData(key, fallback, decode, validate) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return { value: fallback, available: true };
    const value = decode(raw);
    if (validate(value)) return { value, available: true };
  } catch { /* Storage contents and errors must not be logged. */ }
  return { value: fallback, available: false };
}

export function readFavorites() {
  const result = readPersonalData('gameverse-favorites', [], JSON.parse, value => (
    Array.isArray(value) && value.every(item => item &&
      /^\d+$/.test(String(item.id)) && Number.isSafeInteger(Number(item.id)) && Number(item.id) > 0)
  ));
  return { ...result, value: result.value.map(item => ({ ...item, id: Number(item.id) })) };
}

export function readRating(gameId) {
  return readPersonalData(`gameverse-rating-${gameId}`, 0,
    value => /^[0-5]$/.test(value) ? Number(value) : NaN, Number.isInteger);
}

export function readAnalysis(gameId) {
  return readPersonalData(`gameverse-analysis-${gameId}`, null, JSON.parse, value => (
    value === null || (typeof value === 'object' && !Array.isArray(value) &&
      ['user', 'date', 'text'].every(field => value[field] === undefined || typeof value[field] === 'string'))
  ));
}

export function writePersonalData(key, value) {
  try { localStorage.setItem(key, value); return true; }
  catch { return false; }
}

export function removePersonalData(key) {
  try { localStorage.removeItem(key); return true; }
  catch { return false; }
}
