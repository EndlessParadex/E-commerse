import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from './products.js';
import { categories, categoryHref, availableCategories, parseCatalogRoute, filterProducts, searchHref } from './catalog.js';

test('every product has a valid category and subcategory', () => {
  for (const product of products) {
    const category = categories.find((item) => item.id === product.categoryId);
    assert.ok(category);
    assert.equal(category.name, product.category);
    assert.ok(category.children.some((item) => item.id === product.subcategoryId));
  }
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
  assert.deepEqual(filterProducts({ categoryId: 'beauty', subcategoryId: 'wajah' }).map((p) => p.id), ['skincare-glow']);
  assert.deepEqual(filterProducts({ query: 'perawatan wajah' }).map((p) => p.id), ['skincare-glow']);
});
test('search preserves text, filters, sorting, and empty results', () => {
  const query = 'Snack & Makanan';
  assert.equal(parseCatalogRoute(searchHref(query).slice(1)).query, query);
  const result = filterProducts({ query: 'almond', categoryId: 'snack', sort: 'low' });
  assert.deepEqual(result.map((p) => p.id), ['kacang-almond', 'cokelat-import']);
  assert.equal(filterProducts({ query: 'almond', categoryId: 'beauty' }).length, 0);
  assert.equal(filterProducts({ query: 'produk-tidak-ada' }).length, 0);
  assert.equal(filterProducts({ query: '  ' }).length, products.length);
});
