import test from 'node:test';
import assert from 'node:assert/strict';
import { products, productVariants } from './products.js';
import { categories, categoryHref, availableBrands, availableCategories, parseCatalogRoute, filterProducts, filterCatalogProducts, searchHref } from './catalog.js';
import { emptyShop, shopReducer, cartTotals } from '../state/shopModel.js';
import { suppliers, supplierBy, supplierHref } from './suppliers.js';

test('semua contoh memiliki varian unik, satuan benar dan pemetaan PT lengkap', () => {
  assert.equal(products.length, 25);
  assert.equal(new Set(products.map((product) => product.id)).size, products.length);
  const cards = filterCatalogProducts();
  assert.equal(cards.length, 8);
  for (const card of cards) {
    const variants = productVariants(card.id);
    assert.ok(variants.length >= 3);
    assert.equal(new Set(variants.map((variant) => variant.sizeLabel)).size, variants.length);
    assert.ok(variants.every((variant) => variant.brandId === card.brandId && variant.sizeUnit === card.sizeUnit));
    assert.ok(variants.every((variant) => variant.name.endsWith(variant.sizeLabel)));
    assert.ok(variants.every((variant) => Number.isSafeInteger(variant.price) && variant.price > 0));
    for (const variant of variants) {
      assert.equal(suppliers.filter((supplier) => supplier.productIds.includes(variant.id)).length, 1);
      assert.equal(variant.grams, variant.sizeUnit === 'g' ? variant.sizeValue : null);
    }
    const first = variants[0], last = variants.at(-1);
    let state = emptyShop();
    for (const product of [first, last, first]) state = shopReducer(state, { type: 'add', product });
    assert.equal(state.cart.length, 2);
    assert.equal(cartTotals(state.cart).subtotal, first.price * 2 + last.price);
    assert.ok(state.cart.every((item) => item.name.endsWith(item.id === first.id ? first.sizeLabel : last.sizeLabel)));
  }
  assert.deepEqual(productVariants('skincare-glow').map((variant) => variant.sizeLabel), ['10ml', '30ml', '50ml']);
  assert.deepEqual(productVariants('sabun-natural').map((variant) => variant.sizeLabel), ['100ml', '250ml', '500ml']);
});

test('urutan katalog mengikuti harga mulai yang tampil pada kartu', () => {
  const prices = (sort) => filterCatalogProducts({ sort }).map((product) => Math.min(...productVariants(product.id).map((variant) => variant.price)));
  const low = prices('low');
  assert.deepEqual(low, [...low].sort((a, b) => a - b));
  assert.deepEqual(prices('high'), [...low].reverse());
});

test('katalog satu kartu per produk; detail menyediakan seluruh ukuran dari grup yang sama', () => {
  const cards = filterCatalogProducts({ supplierId: 'demo-pangan' });
  assert.equal(cards.length, 3);
  assert.equal(cards.filter((item) => item.groupId === 'snack-pedas').length, 1);
  const variants = productVariants('snack-pedas-62g');
  assert.deepEqual(variants.map((item) => item.grams), [23, 62, 130, 180]);
  assert.equal(new Set(variants.map((item) => item.id)).size, 4);
  assert.ok(variants.every((item) => item.groupId === 'snack-pedas'));
  assert.equal(productVariants('cokelat-import').length, 3);
  assert.deepEqual(productVariants('unknown'), []);
  assert.equal(filterCatalogProducts({ supplierId: 'demo-pangan', brandId: 'rasa-contoh' }).length, 1);
  const search = filterCatalogProducts({ query: 'balado 62g' });
  assert.equal(search.length, 1);
  assert.equal(search[0].id, 'snack-pedas-62g');
  // Tautan gramasi versi sebelumnya tetap membuka katalog tanpa memisahkan SKU.
  assert.equal(filterCatalogProducts({ supplierId: 'demo-pangan', brandId: 'rasa-contoh', grams: 23 }).length, 1);
});

test('merek dan gramasi hanya menampilkan SKU milik PT dan merek terpilih', () => {
  const brand = availableBrands('demo-pangan').find((item) => item.id === 'rasa-contoh');
  assert.deepEqual(brand.grams, [23, 62, 130, 180]);
  for (const grams of brand.grams) {
    const route = parseCatalogRoute(supplierHref('demo-pangan', { brandId: brand.id, grams, query: 'balado' }).slice(1));
    assert.equal(route.brandId, brand.id);
    assert.equal(route.grams, String(grams));
    const result = filterProducts(route);
    assert.equal(result.length, 1);
    assert.equal(result[0].grams, grams);
    assert.equal(result[0].brandId, brand.id);
  }
  assert.deepEqual(filterProducts({ supplierId: 'demo-beauty', brandId: brand.id }), []);
  assert.deepEqual(filterProducts({ supplierId: 'demo-pangan', brandId: brand.id, grams: 999 }), []);
  assert.deepEqual(filterProducts({ supplierId: 'demo-pangan', brandId: 'unknown' }), []);
  assert.deepEqual(availableBrands('unknown'), []);
  assert.deepEqual(availableBrands('demo-beauty').find((item) => item.id === 'glow-contoh').grams, []);
});

test('gramasi berbeda menjadi item keranjang terpisah dengan harga dan subtotal tepat', () => {
  const small = filterProducts({ supplierId: 'demo-pangan', brandId: 'rasa-contoh', grams: 23 })[0];
  const large = filterProducts({ supplierId: 'demo-pangan', brandId: 'rasa-contoh', grams: 180 })[0];
  let state = emptyShop();
  for (const product of [small, large, small]) state = shopReducer(state, { type: 'add', product });
  assert.equal(state.cart.length, 2);
  assert.equal(state.cart.find((item) => item.id === small.id).quantity, 2);
  assert.ok(state.cart.find((item) => item.id === small.id).name.endsWith('23g'));
  assert.equal(cartTotals(state.cart).subtotal, small.price * 2 + large.price);
});

test('every product has a valid category and subcategory', () => {
  for (const product of products) {
    const category = categories.find((item) => item.id === product.categoryId);
    assert.ok(category);
    assert.equal(category.name, product.category);
    assert.ok(category.children.some((item) => item.id === product.subcategoryId));
  }
});

test('semua kartu pemasok menuju produk yang tepat dan tiap produk punya pemetaan dummy', () => {
  for (const supplier of suppliers) {
    const route = parseCatalogRoute(supplierHref(supplier.id).slice(1));
    assert.equal(route.kind, 'supplier');
    assert.equal(route.supplierId, supplier.id);
    assert.deepEqual(filterProducts(route).map((product) => product.id).sort(), [...supplier.productIds].sort());
  }
  for (const product of products) assert.ok(suppliers.some((supplier) => supplier.productIds.includes(product.id)));
});

test('kategori, subkategori, query dan urutan harga tidak keluar dari lingkup PT', () => {
  const supplierId = 'demo-distribusi';
  assert.equal(availableCategories(supplierId).length, 2);
  const route = parseCatalogRoute(supplierHref(supplierId, { categoryId: 'beauty', subcategoryId: 'parfum', query: 'floral' }).slice(1));
  assert.deepEqual(filterCatalogProducts(route).map((product) => product.id), ['parfum-floral']);
  assert.deepEqual(filterProducts({ supplierId, categoryId: 'snack' }), []);
  assert.deepEqual(filterCatalogProducts({ supplierId, sort: 'low' }).map((product) => product.id), ['bumbu-rendang', 'parfum-floral-30ml']);
  const cleared = parseCatalogRoute(supplierHref(supplierId).slice(1));
  assert.equal(filterCatalogProducts(cleared).length, 2);
  assert.equal(supplierBy(cleared.supplierId).id, supplierId);
});

test('pemasok tidak dikenal dan URL rusak ditangani tanpa menampilkan semua produk', () => {
  assert.equal(parseCatalogRoute('/pemasok/unknown').kind, 'invalid');
  assert.equal(parseCatalogRoute('/pemasok/%').kind, 'invalid');
  assert.deepEqual(filterProducts({ supplierId: 'unknown' }), []);
  assert.deepEqual(availableCategories('unknown'), []);
});
test('all menu links resolve to the exact nonempty product group', () => {
  for (const category of availableCategories()) for (const sub of category.children) {
    const route = parseCatalogRoute(categoryHref(category.id, sub.id).slice(1));
    const result = filterProducts(route);
    assert.ok(result.length);
    assert.ok(result.every((p) => p.categoryId === category.id && p.subcategoryId === sub.id));
  }
});
test('old category links and malformed routes are handled', () => {
  assert.equal(parseCatalogRoute('/kategori/Snack%20%26%20Makanan').categoryId, 'snack');
  assert.equal(parseCatalogRoute('/kategori/beauty/wajah').subcategoryId, 'wajah');
  assert.equal(parseCatalogRoute('/kategori/beauty/unknown').kind, 'invalid');
  assert.equal(parseCatalogRoute('/kategori/%').kind, 'invalid');
});
test('skincare is found by subcategory rather than product name', () => {
  assert.deepEqual(filterCatalogProducts({ categoryId: 'beauty', subcategoryId: 'wajah' }).map((p) => p.id), ['skincare-glow']);
  assert.deepEqual(filterCatalogProducts({ query: 'perawatan wajah' }).map((p) => p.id), ['skincare-glow']);
});
test('search preserves text, filters, sorting, and empty results', () => {
  const query = 'Snack & Makanan';
  assert.equal(parseCatalogRoute(searchHref(query).slice(1)).query, query);
  const result = filterCatalogProducts({ query: 'almond', categoryId: 'snack', sort: 'low' });
  assert.deepEqual(result.map((p) => p.id), ['cokelat-import-35g', 'kacang-almond-23g']);
  assert.equal(filterProducts({ query: 'almond', categoryId: 'beauty' }).length, 0);
  assert.equal(filterProducts({ query: 'produk-tidak-ada' }).length, 0);
  assert.equal(filterProducts({ query: '  ' }).length, products.length);
});
