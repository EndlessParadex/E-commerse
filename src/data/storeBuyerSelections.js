import { homePromotions } from './homePromotions.js';

/**
 * Storefront presentation only: distinct product groups across the promo
 * rail and recommendations. Savings use the catalog's validated oldPrice.
 */
export function storeBuyerSelections(catalog, promoLimit = 2, recommendationLimit = 6) {
  const entries = homePromotions(catalog, Array.isArray(catalog) ? catalog.length : 0).items;
  const promos = entries.filter((entry) => entry.discounted).slice(0, promoLimit);
  const promoGroups = new Set(promos.map(({ product }) => product.groupId || product.id));
  const recommendations = entries
    .filter(({ product }) => !promoGroups.has(product.groupId || product.id))
    .slice(0, recommendationLimit);
  return { promos, recommendations };
}
