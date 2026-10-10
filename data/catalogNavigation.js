import { parseCatalogRoute } from './catalog.js';

export function catalogNavigationKey(route) {
  const catalog = parseCatalogRoute(route);
  return catalog && catalog.kind !== 'invalid' ? `catalog:${catalog.query || ''}` : null;
}

export function shouldResetRouteScroll(previous, next) {
  if (previous === next) return false;
  const previousKey = catalogNavigationKey(previous);
  return previousKey === null || previousKey !== catalogNavigationKey(next);
}
