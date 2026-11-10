import test from 'node:test';
import assert from 'node:assert/strict';
import { previouslyOrdered } from './purchaseHistory.js';

const catalog = [
  { id: 'A-DUS', groupId: 'a' },
  { id: 'A-PACK', groupId: 'a' },
  { id: 'B-DUS', groupId: 'b' },
  { id: 'C-DUS', groupId: 'c' },
];

test('pernah dipesan: pesanan terbaru dulu, satu per produk, hanya yang masih di katalog', () => {
  const orders = [
    { createdAt: 100, items: [{ id: 'A-PACK' }, { id: 'GONE' }] },
    { createdAt: 300, items: [{ id: 'B-DUS' }, { id: 'A-DUS' }] },
    { createdAt: 200, items: [{ id: 'C-DUS' }, { id: 'B-DUS' }] },
  ];
  // Newest order (300) first; A-DUS wins over the older A-PACK of the same product.
  assert.deepEqual(
    previouslyOrdered(orders, catalog).map((product) => product.id),
    ['B-DUS', 'A-DUS', 'C-DUS'],
  );
  assert.deepEqual(
    previouslyOrdered(orders, catalog, 2).map((product) => product.id),
    ['B-DUS', 'A-DUS'],
  );
});

test('pernah dipesan: data kosong atau rusak menghasilkan daftar kosong', () => {
  assert.deepEqual(previouslyOrdered([], catalog), []);
  assert.deepEqual(previouslyOrdered(undefined, catalog), []);
  assert.deepEqual(previouslyOrdered([null, { items: 'x' }, { items: [null, {}] }], catalog), []);
});
