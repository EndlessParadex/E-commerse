import { products } from './products.js';

/**
 * Products the buyer ordered before, newest order first, for the empty search box.
 * One entry per product group (the exact SKU last ordered), limited to products that are
 * still in the catalog. Orders are whatever the signed-in account can see as a buyer.
 */
export function previouslyOrdered(orders, catalog = products, limit = 8) {
  const byId = new Map(catalog.map((product) => [product.id, product]));
  const seen = new Set();
  const result = [];
  const newestFirst = [...(Array.isArray(orders) ? orders : [])].sort(
    (a, b) => (Number(b?.createdAt) || 0) - (Number(a?.createdAt) || 0),
  );
  for (const order of newestFirst)
    for (const item of Array.isArray(order?.items) ? order.items : []) {
      const product = byId.get(item?.id);
      const group = product && (product.groupId || product.id);
      if (!product || seen.has(group)) continue;
      seen.add(group);
      result.push(product);
      if (result.length >= limit) return result;
    }
  return result;
}
