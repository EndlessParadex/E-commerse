import { parseCatalogRoute } from '../data/catalog.js';
import { approveNextRoute, canLeaveRoute } from './routeGuards.js';

export function productReturnRoute(previous) {
  if (previous === '/' || previous === '/keranjang' || previous === '/favorit') return previous;
  const catalog = parseCatalogRoute(previous || '');
  return catalog && catalog.kind !== 'invalid' ? previous : '/cari?q=';
}

let snapshot = { route: typeof window === 'undefined' ? '/' : window.location.hash.slice(1) || '/', productReturnTo: '/cari?q=', restoreY: null };
const positions = new Map();
const listeners = new Set();
function onRouteChange(notify = true, scrollOverride = null) {
  const route = window.location.hash.slice(1) || '/';
  const previous = snapshot.route;
  if (route === previous) return;
  if (notify && !canLeaveRoute(route)) {
    window.history.replaceState(window.history.state, '', '#' + previous);
    return;
  }
  positions.set(previous, window.scrollY);
  const enteringProduct = route.startsWith('/produk/') && !previous.startsWith('/produk/');
  const returning = previous.startsWith('/produk/') && route === snapshot.productReturnTo;
  snapshot = { route, productReturnTo: enteringProduct ? productReturnRoute(previous) : snapshot.productReturnTo, restoreY: scrollOverride ?? (returning ? positions.get(route) || 0 : null) };
  if (notify) listeners.forEach((listener) => listener());
}
export function goToHome() {
  if ((window.location.hash.slice(1) || '/') === '/') {
    window.scrollTo({ top: 0, left: 0, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'instant' : 'smooth' });
    document.getElementById('main-content')?.focus({ preventScroll: true });
    return;
  }
  if (!canLeaveRoute('/')) return;
  approveNextRoute('/');
  window.location.hash = '/';
  // A logo opens the top of home; the product's Back link still restores its previous position.
  onRouteChange(true, 0);
}
export function subscribeShopRoute(listener) {
  if (!listeners.size) window.addEventListener('hashchange', onRouteChange);
  listeners.add(listener);
  onRouteChange();
  return () => { listeners.delete(listener); if (!listeners.size) window.removeEventListener('hashchange', onRouteChange); };
}
export function shopRouteSnapshot() {
  // Read the initial route before subscription. Once subscribed, only hashchange
  // advances the store so an intervening render cannot consume its notification.
  if (!listeners.size && typeof window !== 'undefined' && snapshot.route !== (window.location.hash.slice(1) || '/')) onRouteChange(false);
  return snapshot;
}
