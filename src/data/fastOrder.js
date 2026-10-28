import { packagingValues } from './productPackaging.js';

/** Group size-matched SKUs so each package type keeps its own price and stock. */
export function fastOrderGroups(catalog, items = [], query = '') {
  const term = String(query).trim().toLocaleLowerCase('id-ID');
  const inCart = new Set(items.map((item) => item.id));
  const groups = new Map();
  for (const product of catalog) {
    const searchable = [
      product.baseName || product.name,
      product.name,
      product.id,
      product.brand,
      product.sizeLabel,
      product.packagingType,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('id-ID');
    if (term && !searchable.includes(term)) continue;
    const key = (product.groupId || product.id) + ':' + (product.sizeLabel || '');
    if (!groups.has(key))
      groups.set(key, {
        key,
        name: product.baseName || product.name,
        size: product.sizeLabel || '',
        imageProduct: product,
        variants: [],
      });
    groups.get(key).variants.push(product);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      variants: group.variants.sort((a, b) => {
        const ranks = { dus: 0, box: 1, pack: 2, renceng: 3, satuan: 4 };
        return (
          (ranks[a.packagingType || 'satuan'] ?? 5) -
          (ranks[b.packagingType || 'satuan'] ?? 5)
        );
      }),
      inCart: group.variants.some((variant) => inCart.has(variant.id)),
    }))
    .sort((a, b) => Number(b.inCart) - Number(a.inCart) || a.name.localeCompare(b.name, 'id'))
    .slice(0, 40);
}

export function fastOrderPackaging(product) {
  const value = packagingValues(product);
  const kind = value.packagingType || 'satuan';
  return {
    label: kind.charAt(0).toUpperCase() + kind.slice(1),
    units: kind === 'satuan' ? 1 : value.unitsPerPackage,
  };
}

export function fastOrderTotals(cart) {
  const items = Array.isArray(cart?.items) ? cart.items : [];
  return {
    sku: items.length,
    packages: items.reduce((sum, item) => sum + item.quantity, 0),
    amount: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  };
}
