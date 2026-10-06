import { products } from './products.js';

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
export function availableCategories() {
  return categories.map((category) => ({ ...category, children: category.children.filter((sub) => products.some((p) => p.categoryId === category.id && p.subcategoryId === sub.id)) })).filter((category) => category.children.length);
}
export function filterProducts({ categoryId = '', subcategoryId = '', query = '', sort = 'popular' } = {}) {
  const words = query.trim().toLocaleLowerCase('id').split(/\s+/).filter(Boolean);
  const result = products.filter((p) => {
    const category = categoryBy(p.categoryId);
    const sub = category?.children.find((item) => item.id === p.subcategoryId);
    const text = `${p.name} ${category?.name || ''} ${sub?.name || ''}`.toLocaleLowerCase('id');
    return (!categoryId || p.categoryId === categoryId) && (!subcategoryId || p.subcategoryId === subcategoryId) && words.every((word) => text.includes(word));
  });
  return result.sort((a, b) => sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : b.rating - a.rating);
}
export function parseCatalogRoute(route) {
  try {
    const url = new URL(route, 'https://bam.local');
    if (url.pathname === '/cari') return { kind: 'search', query: url.searchParams.get('q') || '', categoryId: url.searchParams.get('kategori') || '', subcategoryId: url.searchParams.get('sub') || '' };
    const match = url.pathname.match(/^\/kategori\/([^/]+)(?:\/([^/]+))?$/);
    if (!match) return null;
    const category = categoryBy(decodeURIComponent(match[1]));
    const subcategoryId = match[2] ? decodeURIComponent(match[2]) : '';
    if (!category || (subcategoryId && !category.children.some((sub) => sub.id === subcategoryId))) return { kind: 'invalid' };
    return { kind: 'category', categoryId: category.id, subcategoryId, query: '' };
  } catch { return { kind: 'invalid' }; }
}
