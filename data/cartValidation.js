import { products } from './products.js';
import { packagingSnapshot, packagingValues, readPackagingSnapshot } from './productPackaging.js';

export function reviewCart(cart, catalog = products) {
  const issues = cart.flatMap((item) => {
    const current = catalog.find((product) => product.id === item.id);
    if (!current) return [{ id: item.id, name: item.name, type: 'unavailable' }];
    const saved = readPackagingSnapshot(item.packaging);
    const changedPackaging = saved ? JSON.stringify(saved) !== JSON.stringify(packagingSnapshot(current)) : packagingValues(current).packagingType !== 'satuan';
    if (current.price !== item.price || current.name !== item.name || changedPackaging) return [{ id: item.id, name: item.name, type: 'changed', current }];
    return [];
  });
  return { issues, ready: cart.length > 0 && issues.length === 0 };
}

// Missing products remain visible until the buyer explicitly removes them.
export function updateCartPrices(cart, catalog = products) {
  return cart.map((item) => {
    const current = catalog.find((product) => product.id === item.id);
    const packaging = current && readPackagingSnapshot(packagingSnapshot(current));
    return current ? { ...item, name: current.name, price: current.price, ...(packaging ? { packaging } : {}) } : item;
  });
}
