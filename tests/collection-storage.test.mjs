import test from 'node:test';
import assert from 'node:assert/strict';

function useMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  globalThis.localStorage = {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
  return values;
}

const { readCollection, setGameStatus, getGameStatus, gameSnapshot } = await import('../js/services/collectionStorage.js');

const hollow = {
  id: 9767,
  slug: 'hollow-knight',
  name: 'Hollow Knight',
  background_image: 'https://example.test/hk.jpg',
  released: '2017-02-24',
  genres: [{ name: 'Action' }, { name: 'Indie' }]
};

test('marca, troca e remove o status de um jogo', () => {
  useMemoryStorage();
  assert.equal(getGameStatus(9767), null);

  assert.deepEqual(setGameStatus(hollow, 'playing'), { ok: true, status: 'playing' });
  assert.equal(getGameStatus(9767), 'playing');

  assert.deepEqual(setGameStatus(hollow, 'completed'), { ok: true, status: 'completed' });
  const entry = readCollection().value[9767];
  assert.equal(entry.name, 'Hollow Knight');
  assert.deepEqual(entry.genres, ['Action', 'Indie']);

  // Clicar de novo no mesmo status tira o jogo da coleção.
  assert.deepEqual(setGameStatus(hollow, 'completed'), { ok: true, status: null });
  assert.deepEqual(readCollection().value, {});
});

test('status desconhecido é recusado', () => {
  useMemoryStorage();
  assert.equal(setGameStatus(hollow, 'platinado').ok, false);
  assert.equal(getGameStatus(9767), null);
});

test('dados corrompidos não são apagados', () => {
  const values = useMemoryStorage({ 'gameverse-collection:v1': '{quebrado' });
  assert.equal(readCollection().available, false);
  assert.equal(setGameStatus(hollow, 'want').ok, false);
  assert.equal(values.get('gameverse-collection:v1'), '{quebrado');
});

test('entradas inválidas são ignoradas na leitura', () => {
  useMemoryStorage({
    'gameverse-collection:v1': JSON.stringify({
      1: { id: 1, name: 'Ok', status: 'want' },
      2: { id: 2, name: 'Status ruim', status: 'xyz' },
      3: { id: -3, name: 'Id ruim', status: 'want' }
    })
  });
  assert.deepEqual(Object.keys(readCollection().value), ['1']);
});

test('snapshot guarda só o necessário', () => {
  assert.deepEqual(gameSnapshot(hollow), {
    id: 9767,
    slug: 'hollow-knight',
    name: 'Hollow Knight',
    image: 'https://example.test/hk.jpg',
    released: '2017-02-24',
    genres: ['Action', 'Indie']
  });
});
