import { products, groupProducts, productVariants } from './products.js';
import { supplierBy } from './suppliers.js';

export const categories = [
  { id: 'snack', name: 'Snack & Makanan', icon: '🍫', children: [{ id: 'keripik', name: 'Keripik & Snack' }, { id: 'cokelat', name: 'Cokelat & Permen' }, { id: 'kacang', name: 'Kacang & Buah Kering' }] },
  { id: 'beauty', name: 'Kosmetik & Beauty', icon: '✨', children: [{ id: 'wajah', name: 'Perawatan Wajah' }, { id: 'makeup', name: 'Makeup' }, { id: 'parfum', name: 'Parfum' }] },
  { id: 'bumbu', name: 'Bumbu Masakan', icon: '🍛', children: [{ id: 'siap-pakai', name: 'Bumbu Siap Pakai' }] },
  { id: 'rumah', name: 'Perlengkapan Rumah', icon: '🧼', children: [{ id: 'tubuh', name: 'Perawatan Tubuh' }] },
];
export const categoryBy = (value) => categories.find((item) => item.id === value || item.name === value);
export const categoryHref = (value, subcategory = '') => {
  const category = categoryBy(value);
  return category ? `#/kategori/${category.id}${subcategory ? `/${encodeURIComponent(subcategory)}` : ''}` : '#/';
};
export const searchHref = (query) => `#/cari?q=${encodeURIComponent(query.trim())}`;
export function catalogHref({ supplierId = '', categoryId = '', subcategoryId = '', brandId = '', query = '', sort = 'popular' } = {}) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (brandId) params.set('merek', brandId);
  if (sort !== 'popular') params.set('urut', sort);
  let path = '/cari';
  if (supplierId) {
    path = '/pemasok/' + encodeURIComponent(supplierId);
    if (categoryId) params.set('kategori', categoryId);
    if (subcategoryId) params.set('sub', subcategoryId);
  } else if (categoryId) path = categoryHref(categoryId, subcategoryId).slice(1);
  if (path === '/cari' && !params.has('q')) params.set('q', '');
  return '#' + path + (params.size ? '?' + params.toString() : '');
}
export function availableCategories(supplierId = '') {
  const scoped = supplierId ? products.filter((product) => supplierBy(supplierId)?.productIds.includes(product.id)) : products;
  return categories.map((category) => ({ ...category, children: category.children.filter((sub) => scoped.some((p) => p.categoryId === category.id && p.subcategoryId === sub.id)) })).filter((category) => category.children.length);
}
export function filterProducts({ categoryId = '', subcategoryId = '', query = '', sort = 'popular', supplierId = '', brandId = '', grams = '' } = {}) {
  const words = query.trim().toLocaleLowerCase('id').split(/\s+/).filter(Boolean);
  const result = products.filter((p) => {
    const category = categoryBy(p.categoryId);
    const sub = category?.children.find((item) => item.id === p.subcategoryId);
    const text = `${p.id} ${p.name} ${p.brand || ''} ${category?.name || ''} ${sub?.name || ''}`.toLocaleLowerCase('id');
    return (!brandId || p.brandId === brandId) && (!grams || p.grams === Number(grams)) && (!supplierId || supplierBy(supplierId)?.productIds.includes(p.id)) && (!categoryId || p.categoryId === categoryId) && (!subcategoryId || p.subcategoryId === subcategoryId) && words.every((word) => text.includes(word));
  });
  return result.sort((a, b) => sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : b.rating - a.rating);
}
export function parseCatalogRoute(route) {
  try {
    const url = new URL(route, 'https://bam.local');
    const supplierMatch = url.pathname.match(/^\/pemasok\/([^/]+)$/);
    if (supplierMatch) {
      const supplierId = decodeURIComponent(supplierMatch[1]);
      if (!supplierBy(supplierId)) return { kind: 'invalid' };
      return { kind: 'supplier', supplierId, brandId: url.searchParams.get('merek') || '', grams: url.searchParams.get('gram') || '', query: url.searchParams.get('q') || '', categoryId: url.searchParams.get('kategori') || '', subcategoryId: url.searchParams.get('sub') || '', sort: url.searchParams.get('urut') || 'popular' };
    }
    if (url.pathname === '/cari') return { kind: 'search', query: url.searchParams.get('q') || '', categoryId: url.searchParams.get('kategori') || '', subcategoryId: url.searchParams.get('sub') || '', brandId: url.searchParams.get('merek') || '', sort: url.searchParams.get('urut') || 'popular' };
    const match = url.pathname.match(/^\/kategori\/([^/]+)(?:\/([^/]+))?$/);
    if (!match) return null;
    const category = categoryBy(decodeURIComponent(match[1]));
    const subcategoryId = match[2] ? decodeURIComponent(match[2]) : '';
    if (!category || (subcategoryId && !category.children.some((sub) => sub.id === subcategoryId))) return { kind: 'invalid' };
    return { kind: 'category', categoryId: category.id, subcategoryId, query: url.searchParams.get('q') || '', brandId: url.searchParams.get('merek') || '', sort: url.searchParams.get('urut') || 'popular' };
  } catch { return { kind: 'invalid' }; }
}

export function availableBrands(supplierId) {
  const scoped = filterProducts({ supplierId });
  return [...new Set(scoped.map((p) => p.brandId))].map((id) => ({
    id, name: scoped.find((p) => p.brandId === id).brand,
    grams: [...new Set(scoped.filter((p) => p.brandId === id && p.grams).map((p) => p.grams))].sort((a, b) => a - b),
  }));
}

// Katalog menampilkan satu kartu per produk; SKU ukuran tetap dipakai di detail/keranjang.
export function filterCatalogProducts(options = {}) {
  const result = groupProducts(filterProducts({ ...options, grams: '' }));
  const minimumPrice = (product) => Math.min(...productVariants(product.id).map((variant) => variant.price));
  // Harga pada kartu adalah harga mulai: pengurutan harus memakai harga yang sama.
  return options.sort === 'low' ? result.sort((a, b) => minimumPrice(a) - minimumPrice(b))
    : options.sort === 'high' ? result.sort((a, b) => minimumPrice(b) - minimumPrice(a)) : result;
}
