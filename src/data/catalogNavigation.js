import { parseCatalogRoute } from './catalog.js';

/** Ignore only query parameters; preserve exact path matching for quick order. */
export function isFastOrderRoute(route) {
  return /^\/order-cepat(?:\?[^#]*)?$/.test(route || '');
}

export function catalogNavigationKey(route) {
  const catalog = parseCatalogRoute(route);
  if (catalog?.kind === 'supplier' && !catalog.brandId)
    return `supplier-brands:${catalog.supplierId}:${catalog.query || ''}`;
  return catalog && catalog.kind !== 'invalid' ? `catalog:${catalog.query || ''}` : null;
}

export function shouldResetRouteScroll(previous, next) {
  if (previous === next) return false;
  const previousKey = catalogNavigationKey(previous);
  return previousKey === null || previousKey !== catalogNavigationKey(next);
}
