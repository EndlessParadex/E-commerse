import test from 'node:test';
import assert from 'node:assert/strict';
import { roleNavigation, roleNavigationActive } from './roleNavigation.js';

test('navigasi role hanya menampilkan jalur relevan', () => {
  const guest = roleNavigation('guest');
  assert.deepEqual(
    guest.map(({ label }) => label),
    ['Beranda', 'Katalog', 'Keranjang', 'Akun'],
  );
  assert.equal(guest.at(-1).href, '#/login');
  const personal = roleNavigation('personal');
  assert.ok(personal.some((link) => link.href === '#/pesanan'));
  assert.ok(!personal.some((link) => link.href === '#/order-cepat'));
  const sales = roleNavigation('sales');
  assert.deepEqual(
    sales.map(({ label }) => label),
    ['Beranda', 'Order Cepat', 'Keranjang', 'Pesanan', 'Akun'],
  );
  assert.equal(sales.find((link) => link.href === '#/order-cepat').cartMode, 'store');
  assert.ok(!sales.some((link) => link.href === '#/admin'));
  const buyer = roleNavigation('buyer');
  assert.ok(buyer.some((link) => link.href === '#/akun/kalender'));
  assert.equal(buyer.filter((link) => link.mobile !== false).length, 5);
  assert.ok(!buyer.some((link) => link.href === '#/order-cepat'));
  const admin = roleNavigation('admin');
  assert.ok(admin.some((link) => link.href === '#/admin'));
  assert.ok(!admin.some((link) => link.href === '#/order-cepat'));
});

test('penanda halaman aktif mengikuti jalur tanpa menandai menu lain', () => {
  const sales = roleNavigation('sales');
  const quick = sales.find((link) => link.href === '#/order-cepat');
  const cart = sales.find((link) => link.href === '#/keranjang');
  const orders = sales.find((link) => link.href === '#/pesanan');
  assert.equal(roleNavigationActive(quick, '/order-cepat?q=snack'), true);
  assert.equal(roleNavigationActive(quick, '/keranjang'), false);
  assert.equal(roleNavigationActive(cart, '/keranjang'), true);
  assert.equal(roleNavigationActive(cart, '/checkout'), true);
  assert.equal(roleNavigationActive(orders, '/pesanan/ORDER-123'), true);
  const buyer = roleNavigation('buyer');
  const schedule = buyer.find((link) => link.href === '#/akun/kalender');
  const account = buyer.find((link) => link.href === '#/akun');
  assert.equal(roleNavigationActive(schedule, '/akun/kalender'), true);
  assert.equal(roleNavigationActive(account, '/akun/kalender'), false);
  assert.equal(roleNavigationActive(account, '/akun/profil'), true);
});
