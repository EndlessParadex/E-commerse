import { useEffect, useSyncExternalStore } from 'react';
import { freeQuantity, jakartaDate, promotionFor } from './promotions.js';

// Promotions running today, loaded from the server. The server decides the free units when an
// order is made; the store pages use the same rules to show them beforehand.

let state = { loaded: false, today: jakartaDate(), promotions: [] };
const listeners = new Set();
let loading = null;
const announce = () => listeners.forEach((listener) => listener());
export const subscribePromotions = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const promotionState = () => state;
export function setPromotions(value) {
  state = {
    loaded: true,
    today: value?.today || jakartaDate(),
    promotions: Array.isArray(value?.promotions) ? value.promotions : [],
  };
  announce();
}
/** Without a server (browser preview) there are simply no promotions. */
export function loadPromotions(request = (...args) => globalThis.fetch(...args)) {
  loading ??= Promise.resolve()
    .then(() => request('/api/promotions', { credentials: 'include', cache: 'no-store' }))
    .then((response) => (response.ok ? response.json() : null))
    .then((value) => setPromotions(value || {}))
    .catch(() => setPromotions({}))
    .finally(() => {
      loading = null;
    });
  return loading;
}
/** Running promotion for a SKU (or null). */
export const promotionOf = (variantId, current = state) =>
  promotionFor(current.promotions, variantId, current.today);
/** Free units a cart line will receive (before the server checks stock). */
export const cartFree = (variantId, quantity, current = state) =>
  freeQuantity(promotionOf(variantId, current), quantity);

/** React: re-render when promotions load, and load them once. */
export function usePromotions() {
  const current = useSyncExternalStore(subscribePromotions, promotionState, promotionState);
  useEffect(() => {
    if (!state.loaded) loadPromotions();
  }, []);
  return current;
}
