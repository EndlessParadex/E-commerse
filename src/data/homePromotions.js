/**
 * Build a storefront panel from the currently loaded catalog.
 * Prices and discounts come only from product fields; there is no simulated
 * countdown, campaign deadline, or claim about inventory.
 */
export function homePromotions(catalog, limit = 4) {
  if (!Array.isArray(catalog) || limit <= 0) return { items: [], discountedCount: 0 };
  const groups = new Map();
  for (const item of catalog) {
    if (!item || !Number.isFinite(item.price) || item.price < 0) continue;
    const key = item.groupId || item.id;
    const oldPrice = item.oldPrice;
    const discounted = Number.isFinite(oldPrice) && oldPrice > item.price;
    const discount = discounted ? Math.floor(((oldPrice - item.price) * 100) / oldPrice) : 0;
    const entry = { product: item, discounted, discount };
    const previous = groups.get(key);
    if (
      !previous ||
      (discounted && !previous.discounted) ||
      (discounted === previous.discounted &&
        (discount > previous.discount ||
          (discount === previous.discount && item.price < previous.product.price)))
    )
      groups.set(key, entry);
  }
  const rows = [...groups.values()].sort(
    (a, b) => Number(b.discounted) - Number(a.discounted) || b.discount - a.discount,
  );
  return {
    items: rows.slice(0, limit),
    discountedCount: rows.filter((entry) => entry.discounted).length,
  };
}
