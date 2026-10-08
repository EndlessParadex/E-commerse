import { products } from './products.js';
import { suppliers } from './suppliers.js';

export const adminProducts = products.map((product) => ({ ...product, supplier: suppliers.find((entry) => entry.productIds.includes(product.id)) || null }));
export function adminBrands(supplierId = '') {
  const scoped = adminProducts.filter((product) => !supplierId || product.supplier?.id === supplierId);
  return [...new Map(scoped.map((product) => [product.brandId, { id: product.brandId, name: product.brand }])).values()].sort((a, b) => a.name.localeCompare(b.name, 'id'));
}
export function filterAdminProducts({ query = '', supplierId = '', brandId = '' } = {}) {
  const search = query.trim().toLocaleLowerCase('id');
  return adminProducts.filter((product) => (!supplierId || product.supplier?.id === supplierId)
    && (!brandId || product.brandId === brandId)
    && (!search || [product.baseName, product.brand, product.sizeLabel, product.id, product.supplier?.name].join(' ').toLocaleLowerCase('id').includes(search)));
}
