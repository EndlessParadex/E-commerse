import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWhatsApp, validateWhatsApp } from './whatsappModel.js';
import { createOrder } from './orderModel.js';

test('format Indonesia dinormalisasi tanpa menganggap nomor terverifikasi', () => {
  for (const number of ['081234567890', '+6281234567890', '62812 3456 7890', '(0812) 3456-7890']) assert.equal(normalizeWhatsApp(number), '+6281234567890');
  for (const number of ['', '+1234567890', '0812abc34567890', '08123', '+62812345678901234']) assert.equal(normalizeWhatsApp(number), '');
});

test('persetujuan opsional; nomor wajib valid hanya jika dipilih', () => {
  assert.equal(validateWhatsApp('', false), '');
  assert.ok(validateWhatsApp('', true));
  assert.equal(validateWhatsApp('081234567890', true), '');
});

test('nomor tidak disimpan tanpa persetujuan; pilihan tersimpan pada pesanan mock', () => {
  const input = { cart: [], whatsappNumber: '081234567890' };
  assert.deepEqual(createOrder(input).whatsapp, { optedIn: false, number: '', simulation: true });
  assert.deepEqual(createOrder({ ...input, whatsappOptIn: true }).whatsapp, { optedIn: true, number: '+6281234567890', simulation: true });
});
