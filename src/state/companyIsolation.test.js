import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCompany, companySnapshot, companyStorageKey, saveCompany } from '../data/companyStore.js';
import { demoCompanyProfile, emptyCompanyProfile } from '../data/companyProfile.js';
import { readOrders, ORDER_HISTORY_KEY } from './orderModel.js';
import { readDelivery, writeDelivery, DELIVERY_STORAGE_KEY } from './deliveryModel.js';
import { availableStock, setAvailableStock, initialStock, STOCK_KEY, stockKey } from './frontendWorkflow.js';
import { readAppearance, writeAppearance, defaultAppearance } from './appearanceModel.js';
const first = '11111111-1111-4111-8111-111111111111'; const second = '22222222-2222-4222-8222-222222222222';
const metadata = (instanceId, mode) => ({ version: 1, instanceId, revision: 0, mode, profile: mode === 'company' ? emptyCompanyProfile : demoCompanyProfile });
test('database perusahaan mendapat ruang browser sendiri; stok 0, alamat, riwayat dan preferensi tidak mengambil data demo', () => {
  const entries = new Map(); const storage = { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  const product = { id: 'sku', groupId: 'group', sizeValue: 1, sizeUnit: 'pcs' };
  try {
    applyCompany(metadata(first, 'demo')); assert.equal(initialStock(), 120);
    writeDelivery({ namaToko: 'BAM Lama', namaJalan: 'Alamat BAM lama lengkap' }, storage); writeAppearance(storage, 'guest', { mode: 'dark', textSize: 'xlarge' });
    storage.setItem(STOCK_KEY, JSON.stringify({ [stockKey(product)]: 999 })); storage.setItem(ORDER_HISTORY_KEY, '{bad demo history}');
    applyCompany(metadata(first, 'company')); assert.equal(initialStock(), 0); assert.equal(availableStock(product, storage), 0); assert.equal(readDelivery(storage), null); assert.deepEqual(readOrders(storage), []); assert.deepEqual(readAppearance(storage, 'guest'), defaultAppearance);
    const companyCart = companyStorageKey('bam.shop.v1'); const companyCatalog = companyStorageKey('bam.admin.catalog.v1');
    assert.notEqual(companyCart, 'bam.shop.v1'); assert.notEqual(companyCatalog, 'bam.admin.catalog.v1');
    assert.equal(setAvailableStock(product, 119, storage).saved, true); assert.equal(availableStock(product, storage), 119);
    writeDelivery({ namaToko: 'Perusahaan A', namaJalan: 'Alamat perusahaan A lengkap' }, storage); writeAppearance(storage, 'guest', { mode: 'dark', accent: 'green' });
    applyCompany(metadata(second, 'company')); assert.equal(availableStock(product, storage), 0); assert.equal(readDelivery(storage), null); assert.deepEqual(readOrders(storage), []); assert.deepEqual(readAppearance(storage, 'guest'), defaultAppearance); assert.notEqual(companyStorageKey('bam.shop.v1'), companyCart);
    applyCompany(metadata(first, 'company')); assert.equal(availableStock(product, storage), 119); assert.equal(readDelivery(storage).namaToko, 'Perusahaan A'); assert.equal(readAppearance(storage, 'guest').accent, 'green');
    applyCompany(metadata(first, 'demo')); assert.equal(availableStock(product, storage, []), 999); assert.equal(readDelivery(storage).namaToko, 'BAM Lama'); assert.equal(readAppearance(storage, 'guest').textSize, 'xlarge'); assert.equal(entries.get(ORDER_HISTORY_KEY), '{bad demo history}'); assert.ok(entries.has(DELIVERY_STORAGE_KEY));
  } finally { applyCompany(metadata(first, 'demo')); }
});
test('client mempertahankan identitas lama ketika simpan gagal, konflik, atau server mengembalikan data yang berbeda', async () => {
  applyCompany(metadata(first, 'company')); const before = companySnapshot(); const profile = { ...before.profile, shortName: 'Usaha Baru' };
  for (const request of [async () => { throw new Error('offline'); }, async () => ({ ok: false, status: 409, json: async () => ({ errors: { form: 'Konflik' } }) }), async () => ({ ok: true, json: async () => ({ ...before, revision: 1, profile: { ...profile, shortName: 'Wrong' } }) })]) {
    const result = await saveCompany(profile, request); assert.ok(result.error); assert.equal(companySnapshot(), before);
  }
  const saved = await saveCompany(profile, async (_, options) => { assert.equal(options.credentials, 'include'); assert.equal(JSON.parse(options.body).revision, 0); return { ok: true, json: async () => ({ ...before, revision: 1, profile }) }; });
  assert.equal(saved.saved, true); assert.equal(companySnapshot().profile.shortName, 'Usaha Baru');
  applyCompany(metadata(first, 'demo'));
});
