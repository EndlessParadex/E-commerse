import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeOnLoad, savedPart } from './personalCartSync.js';

const item = (id, quantity = 1) => ({ id, name: 'Produk ' + id, price: 12000, quantity });
const server = (cart, favoriteIds = [], revision = 3) => ({ revision, cart, favoriteIds });

test('tanpa perubahan lokal, isi server menang (termasuk barang yang dihapus di perangkat lain)', () => {
  const local = { cart: [item('A'), item('B')], favoriteIds: ['A'] };
  const lastSynced = JSON.stringify(savedPart(local));
  const result = mergeOnLoad(server([item('A', 4)]), local, lastSynced);
  assert.deepEqual(result.value.cart, [item('A', 4)]);
  assert.deepEqual(result.value.favoriteIds, []);
  assert.equal(result.push, false);
});

test('keranjang tamu sebelum login digabung ke keranjang akun lalu dikirim', () => {
  const guest = { cart: [item('A', 2), item('C')], favoriteIds: ['C'] };
  const result = mergeOnLoad(server([item('A', 5), item('B')], ['B']), guest, null);
  assert.deepEqual(result.value.cart, [item('A', 5), item('B'), item('C')]);
  assert.deepEqual(result.value.favoriteIds, ['B', 'C']);
  assert.equal(result.push, true);
});

test('perangkat baru dengan keranjang lokal kosong mengambil isi server', () => {
  const result = mergeOnLoad(server([item('A')]), { cart: [], favoriteIds: [] }, null);
  assert.deepEqual(result.value.cart, [item('A')]);
  assert.equal(result.push, false);
});
