import { products } from './products.js';
const supplierProducts = (groupIds) => products.filter((product) => groupIds.includes(product.groupId)).map((product) => product.id);
// Demo names and assignments only. Replace with actual suppliers before publishing.
export const suppliers = [
  { id: 'demo-pangan', name: 'PT Pangan Contoh', initials: 'PC', logo: '', color: 'sky', productIds: supplierProducts(['snack-pedas', 'cokelat-import', 'kacang-almond']) },
  { id: 'demo-beauty', name: 'PT Kecantikan Contoh', initials: 'KC', logo: '', color: 'violet', productIds: supplierProducts(['skincare-glow', 'lipstik-matte']) },
  { id: 'demo-distribusi', name: 'PT Distribusi Contoh', initials: 'DC', logo: '', color: 'amber', productIds: supplierProducts(['bumbu-rendang', 'parfum-floral']) },
  { id: 'demo-rumah', name: 'PT Rumah Contoh', initials: 'RC', logo: '', color: 'mint', productIds: supplierProducts(['sabun-natural']) },
];

export const supplierBy = (id) => suppliers.find((supplier) => supplier.id === id);
export function supplierHref(id, { categoryId = '', subcategoryId = '', query = '', brandId = '', grams = '' } = {}) {
  const params = new URLSearchParams();
  if (categoryId) params.set('kategori', categoryId);
  if (subcategoryId) params.set('sub', subcategoryId);
  if (query) params.set('q', query);
  if (brandId) params.set('merek', brandId);
  if (grams) params.set('gram', String(grams));
  return `#/pemasok/${encodeURIComponent(id)}${params.size ? '?' + params.toString() : ''}`;
}
