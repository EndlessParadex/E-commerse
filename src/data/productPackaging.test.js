import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from './products.js';
import { productDraft, validateDraft, buildVariants } from './adminEditor.js';
import { packagingValues, packagingErrors, packagingContents, packagingQuantity, variantForSize, packagingSnapshot } from './productPackaging.js';
import { emptyShop, shopReducer, normalizeShop, cartTotals } from '../state/shopModel.js';
import { reviewCart, updateCartPrices } from './cartValidation.js';
import { createCheckoutOrder, readOrder, saveOrder } from '../state/orderModel.js';
import { cartItemPresentation } from './cartItemPresentation.js';
import { orderItemPresentation } from './orderItemPresentation.js';
import { packagingOptionLabel, purchasePackagingLabel, purchasePackagingChoice, purchaseProductName } from './packagingPresentation.js';

function packagedDraft() {
  const draft = productDraft('snack-pedas'); const single = draft.variants[0];
  draft.variants.push({ ...single, id: 'PACK-180', packagingType: 'pack', unitsPerPackage: '6', price: '90000', oldPrice: '' });
  draft.variants.push({ ...single, id: 'DUS-180', packagingType: 'dus', unitsPerPackage: '24', packsPerBox: '4', price: '350000', oldPrice: '' });
  return draft;
}
test('produk lama menjadi Satuan tanpa mengganti SKU/nama/harga; kombinasi ukuran dan kemasan tervalidasi', () => {
  const draft = packagedDraft(); assert.deepEqual(validateDraft(draft), {});
  const built = buildVariants(draft); const old = products.find((product) => product.id === draft.variants[0].id);
  assert.equal(built[0].name, old.name); assert.equal(built[0].price, old.price); assert.equal(built[0].id, old.id);
  assert.deepEqual(packagingValues(built[0]), { packagingType: 'satuan', unitsPerPackage: 1, packsPerBox: 0 });
  draft.variants.push({ ...draft.variants.at(-2), id: 'PACK-DUP' });
  assert.match(validateDraft(draft)[`variants.${draft.variants.length - 1}.sizeValue`], /sudah ditambahkan/);
  draft.variants.at(-1).unitsPerPackage = '12'; assert.deepEqual(validateDraft(draft), {});
  const choices = buildVariants(draft);
  const pack6 = choices.find((entry) => entry.id === 'PACK-180');
  const pack12 = choices.find((entry) => entry.id === 'PACK-DUP');
  assert.equal(purchasePackagingChoice(pack6, choices), '1 pack (isi 6)');
  assert.equal(purchasePackagingChoice(pack12, choices), '1 pack (isi 12)');
  assert.equal(packagingOptionLabel(pack6, built), 'Pack');
  assert.equal(packagingOptionLabel(pack6, choices), 'Pack (isi 6)');
  assert.equal(packagingOptionLabel(pack12, choices), 'Pack (isi 12)');
  assert.equal(packagingOptionLabel(built[0], built), 'Satuan');
  assert.equal(packagingOptionLabel(built.at(-1), built), 'Dus');
  assert.equal(purchaseProductName(pack6, built), 'Keripik Singkong Balado 180g · 1 pack');
  assert.equal(purchasePackagingLabel(pack6, 2), '2 pack');
  assert.equal(purchasePackagingLabel(built.at(-1)), '1 dus');
  for (const value of ['', '0', '1', '2.5', '1000001', 'oops']) assert.ok(packagingErrors({ packagingType: 'pack', unitsPerPackage: value }).unitsPerPackage);
  assert.ok(packagingErrors({ packagingType: 'satuan', unitsPerPackage: 6 }).unitsPerPackage);
  assert.ok(packagingErrors({ packagingType: 'other', unitsPerPackage: 6 }).packagingType);
  for (const value of ['1', '5', '24', '2.5']) assert.ok(packagingErrors({ packagingType: 'dus', unitsPerPackage: 24, packsPerBox: value }).packsPerBox);
  assert.equal(packagingContents(built.at(-1)), '1 dus = 4 pack × 6 satuan = 24 satuan (180g per satuan)');
});
test('ganti ukuran mempertahankan kemasan yang tersedia dan memilih SKU nyata jika kombinasi tidak tersedia', () => {
  const built = buildVariants(packagedDraft()); const pack = built.find((item) => item.id === 'PACK-180');
  assert.equal(variantForSize(built, built[0], pack).id, pack.id);
  const small = built.find((item) => item.sizeValue === 23);
  assert.equal(variantForSize(built, small, pack).id, small.id);
});
test('Satuan/Pack/Dus menjadi baris terpisah, jumlah menghitung kemasan, harga benar dan riwayat menyimpan isinya', () => {
  const built = buildVariants(packagedDraft()); const selected = [built[0], built.find((item) => item.id === 'PACK-180'), built.find((item) => item.id === 'DUS-180')];
  const previous = products.map((item) => ({ ...item })); products.splice(0, products.length, ...built);
  try {
    let shop = emptyShop();
    for (const product of selected) shop = shopReducer(shop, { type: 'add', product });
    shop = shopReducer(shop, { type: 'add', product: selected[1] });
    shop = normalizeShop(JSON.parse(JSON.stringify(shop)));
    assert.equal(shop.cart.length, 3); assert.equal(shop.cart[1].quantity, 2);
    assert.deepEqual(cartTotals(shop.cart), { quantity: 4, subtotal: 548000 });
    assert.equal(packagingQuantity(shop.cart[1].packaging, 2), '2 pack = 12 satuan');
    assert.equal(cartItemPresentation(shop.cart[1]).name, 'Keripik Singkong Balado');
    const order = createCheckoutOrder({ cart: shop.cart, recipient: 'Pembeli', address: 'Alamat lengkap', shipping: { label: 'Reguler', cost: 10000 }, payment: { id: 'cod' } });
    assert.equal(order.total, 558000); const values = new Map(); const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
    assert.equal(saveOrder(order, storage), true);
    const cartBefore = structuredClone(shop.cart);
    products.find((item) => item.id === 'DUS-180').packsPerBox = 6;
    assert.equal(reviewCart(shop.cart).ready, false, 'pack structure changes must be acknowledged even if price/name match');
    assert.equal(updateCartPrices(shop.cart)[2].packaging.packsPerBox, 6);
    assert.deepEqual(shop.cart, cartBefore);
    products.splice(0, products.length);
    const history = readOrder(order.id, storage);
    assert.equal(history.items[1].details.packaging.unitsPerPackage, 6);
    assert.equal(history.items[2].details.packaging.packsPerBox, 4);
    assert.match(packagingContents(orderItemPresentation(history.items[2]).packaging), /4 pack × 6 satuan/);
    assert.equal(history.total, 558000);
  } finally { products.splice(0, products.length, ...previous); }
});
test('keranjang lama dengan SKU pack harus memperbarui informasi; riwayat lama tidak mengarang isi kemasan', () => {
  const product = buildVariants(packagedDraft()).find((item) => item.id === 'PACK-180');
  const legacy = { id: product.id, name: product.name, price: product.price, quantity: 1 };
  assert.equal(reviewCart([legacy], [product]).ready, false);
  const updated = updateCartPrices([legacy], [product]); assert.equal(reviewCart(updated, [product]).ready, true);
  assert.deepEqual(updated[0].packaging, packagingSnapshot(product));
  assert.equal(orderItemPresentation({ ...legacy, details: { name: 'Produk lama', sizeLabel: '180g' } }).packaging, null);
  assert.equal(normalizeShop({ cart: [{ ...legacy, packaging: { packagingType: 'pack', unitsPerPackage: -2, sizeLabel: '180g' } }] }).cart[0].packaging, undefined);
});
