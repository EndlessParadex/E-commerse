import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedDraftWhatsAppUrl } from './sharedDraftWhatsApp.js';

test('WhatsApp recap is explicitly a draft, uses true packaging, and never sends automatically', () => {
  const cart = {
    store: { phone: '+6281234567890', storeName: 'Toko Contoh' },
    date: '2026-11-02',
    status: 'open',
    items: [{
      name: 'Keripik Singkong Balado 180g', quantity: 2,
      packaging: { packagingType: 'dus', unitsPerPackage: 24 },
    }],
  };
  const url = sharedDraftWhatsAppUrl(cart);
  assert.ok(url.startsWith('https://wa.me/6281234567890?text='));
  const message = decodeURIComponent(url.split('?text=')[1]);
  assert.match(message, /DRAFT KERANJANG/);
  assert.match(message, /2 dus \(isi 24 satuan\)/);
  assert.match(message, /finalisasi Admin BAM/);
  assert.equal(sharedDraftWhatsAppUrl({ ...cart, status: 'finalized' }), null);
  assert.equal(sharedDraftWhatsAppUrl({ ...cart, store: { phone: '0812' } }), null);
  assert.equal(sharedDraftWhatsAppUrl({ ...cart, items: [] }), null);
});
