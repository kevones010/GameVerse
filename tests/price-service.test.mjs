import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTitle, steamAppIdFromStores, pickExactTitle, buildPriceSummary, storesMap,
  curateDeals, formatUsd, brlEstimate, dealUrl
} from '../js/services/priceService.js';

test('normalizeTitle ignora acentos, símbolos e apóstrofos', () => {
  assert.equal(normalizeTitle("Sid Meier's Civilization® VI"), normalizeTitle('Sid Meiers Civilization VI'));
  assert.equal(normalizeTitle('Deus Ex: Human Revolution – Director’s Cut'), 'deus ex human revolution directors cut');
  assert.equal(normalizeTitle('Pokémon'), 'pokemon');
});

test('steamAppIdFromStores acha o id no link da Steam', () => {
  const stores = [
    { store_id: 3, url: 'https://store.playstation.com/x' },
    { store_id: 1, url: 'https://store.steampowered.com/app/2050650/Resident_Evil_4/' }
  ];
  assert.equal(steamAppIdFromStores(stores), '2050650');
  assert.equal(steamAppIdFromStores([{ url: 'https://gog.com/game/x' }]), null);
  assert.equal(steamAppIdFromStores(undefined), null);
});

test('pickExactTitle nunca escolhe outro jogo', () => {
  const results = [
    { external: 'Hollow Knight: Silksong', gameID: '2' },
    { external: 'Hollow Knight', gameID: '1' }
  ];
  assert.equal(pickExactTitle(results, 'Hollow Knight').gameID, '1');
  assert.equal(pickExactTitle(results, 'Hollow Knight 2'), null);
  assert.equal(pickExactTitle(results, ''), null);
});

test('buildPriceSummary ordena por preço, calcula desconto e ignora lojas inativas', () => {
  const stores = storesMap([
    { storeID: '1', storeName: 'Steam', isActive: 1, images: { icon: '/img/stores/icons/0.png' } },
    { storeID: '23', storeName: 'GameBillet', isActive: 1, images: { icon: '/img/stores/icons/22.png' } },
    { storeID: '99', storeName: 'Fechada', isActive: 0, images: {} }
  ]);
  const summary = buildPriceSummary({
    info: { title: 'Resident Evil 4', steamAppID: '2050650' },
    cheapestPriceEver: { price: '4.99', date: 1591592509 },
    deals: [
      { storeID: '1', dealID: 'a%3D', price: '39.99', retailPrice: '39.99' },
      { storeID: '23', dealID: 'b', price: '8.46', retailPrice: '39.99' },
      { storeID: '99', dealID: 'c', price: '1.00', retailPrice: '39.99' }
    ]
  }, stores);

  assert.equal(summary.deals.length, 2);
  assert.equal(summary.best.store, 'GameBillet');
  assert.equal(summary.best.savings, 79);
  assert.equal(summary.deals[1].savings, 0);
  assert.equal(summary.onSale, true);
  assert.deepEqual(summary.historicLow, { price: 4.99, date: '2020-06-08' });
  assert.equal(summary.deals[1].url, 'https://www.cheapshark.com/redirect?dealID=a%3D');
  assert.equal(stores['1'].icon, 'https://www.cheapshark.com/img/stores/icons/0.png');
  assert.equal(buildPriceSummary({ deals: [] }, stores), null);
  assert.equal(buildPriceSummary(null, stores), null);
});

test('curateDeals: só populares, sem repetidos, extras, adulto ou desconto pequeno', () => {
  const deal = (title, steamAppID, savings, steamRatingCount = 20000, steamRatingPercent = 90) => ({
    title, steamAppID, savings: String(savings), salePrice: '5', normalPrice: '20', metacriticScore: '85', dealID: 'x',
    steamRatingCount: String(steamRatingCount), steamRatingPercent: String(steamRatingPercent)
  });
  const result = curateDeals([
    deal('Hollow Knight', '367520', 50, 30000),
    deal('Hollow Knight', '367520', 50, 30000),
    deal('Mortal Kombat 11 Ultimate', '976310', 85, 88000),
    deal('Mortal Kombat11', '976311', 90, 26000),
    deal('Hollow Knight - Official Soundtrack', '1', 60),
    deal('Waifu Hentai Simulator', '2', 90),
    deal('Desconto pequeno', '3', 10),
    deal('Sem Steam', null, 80),
    deal('Desconhecido', '4', 90, 137),
    deal('Mal avaliado', '5', 90, 50000, 60),
    deal('Celeste', '504230', 75, 70000)
  ]);
  assert.deepEqual(result.map((item) => item.title), ['Mortal Kombat 11 Ultimate', 'Celeste', 'Hollow Knight']);
  assert.match(result[2].image, /\/367520\/header\.jpg$/);
  assert.equal(result[0].metacritic, 85);
});

test('formatação em dólar e estimativa em reais', () => {
  assert.equal(formatUsd(8.46), 'US$ 8,46');
  assert.equal(formatUsd('0.00'), 'Grátis');
  assert.match(brlEstimate(10, 5.5), /^≈ R\$\s?55,00$/);
  assert.equal(brlEstimate(10, null), '');
  assert.equal(brlEstimate(0, 5.5), '');
  assert.equal(dealUrl('abc%2Bdef'), 'https://www.cheapshark.com/redirect?dealID=abc%2Bdef');
});
