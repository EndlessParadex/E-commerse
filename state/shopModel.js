import { packagingSnapshot, readPackagingSnapshot } from '../data/productPackaging.js';
export const STORAGE_KEY = 'bam.shop.v1';
export const emptyShop = () => ({ cart: [], notifications: [], favoriteIds: [] });
const validId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 100;
const validProduct = (p) => p && validId(p.id) && typeof p.name === 'string' && p.name.trim() && Number.isSafeInteger(p.price) && p.price >= 0 && p.price <= 1_000_000_000;
const orderMessage = (id) => `Pesanan #${id.replace(/^BAM-/i, '').slice(-8).toUpperCase()} berhasil dibuat. Lihat detail pesanan Anda.`;

export function normalizeShop(value) {
  const result = emptyShop();
  if (!value || typeof value !== 'object') return result;
  const ids = new Set();
  for (const item of Array.isArray(value.cart) ? value.cart : []) {
    if (!validProduct(item) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 || ids.has(item.id)) continue;
    ids.add(item.id);
    const packaging = readPackagingSnapshot(item.packaging);
    result.cart.push({ id: item.id, name: item.name.trim().slice(0, 200), price: item.price, quantity: item.quantity, ...(packaging ? { packaging } : {}) });
    if (result.cart.length === 100) break;
  }
  ids.clear();
  for (const item of Array.isArray(value.notifications) ? value.notifications : []) {
    if (!item || !validId(item.id) || typeof item.title !== 'string' || typeof item.message !== 'string' || !Number.isFinite(item.createdAt) || !Number.isFinite(new Date(item.createdAt).getTime()) || ids.has(item.id)) continue;
    if (item.kind === 'cartAdded' || item.title === 'Ditambahkan ke keranjang') continue;
    ids.add(item.id);
    const notification = { id: item.id, title: item.title.slice(0, 200), message: item.message.slice(0, 1000), createdAt: item.createdAt, read: item.read === true };
    if (['orderCreated', 'orderCancelled'].includes(item.kind) && validId(item.orderId)) {
      notification.kind = item.kind;
      notification.orderId = item.orderId;
      notification.message = item.kind === 'orderCreated' ? orderMessage(item.orderId) : 'Pesanan telah dibatalkan. Lihat detail untuk informasi pembatalan.';
    }
    result.notifications.push(notification);
    if (result.notifications.length === 100) break;
  }
  for (const id of Array.isArray(value.favoriteIds) ? value.favoriteIds : []) {
    if (!validId(id) || result.favoriteIds.includes(id)) continue;
    result.favoriteIds.push(id);
    if (result.favoriteIds.length === 100) break;
  }
  return result;
}

export function cartTotals(cart) {
  return cart.reduce((total, item) => ({ quantity: total.quantity + item.quantity, subtotal: total.subtotal + item.price * item.quantity }), { quantity: 0, subtotal: 0 });
}

export function orderNotification(order) {
  if (!order || !validId(order.id) || !Number.isFinite(order.createdAt) || !Number.isFinite(new Date(order.createdAt).getTime())) return null;
  const id = 'order-' + order.id;
  if (!validId(id)) return null;
  return { id, kind: 'orderCreated', orderId: order.id, title: 'Pesanan dibuat', message: orderMessage(order.id), createdAt: order.createdAt, read: false };
}

export function shopReducer(state, action) {
  switch (action.type) {
    case 'add': {
      if (!validProduct(action.product)) return state;
      const quantity = action.quantity ?? 1;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return state;
      const existing = state.cart.find((item) => item.id === action.product.id);
      if ((existing?.quantity || 0) + quantity > 99 || (!existing && state.cart.length >= 100)) return state;
      const packaging = readPackagingSnapshot(packagingSnapshot(action.product));
      const cart = existing
        ? state.cart.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + quantity } : item)
        : [...state.cart, { id: action.product.id, name: action.product.name.trim().slice(0, 200), price: action.product.price, quantity, ...(packaging ? { packaging } : {}) }];
      return { ...state, cart };
    }
    case 'completeOrder': {
      const notification = orderNotification(action.order);
      if (!notification) return state;
      if (state.notifications.some((item) => item.id === notification.id)) return { ...state, cart: [] };
      return normalizeShop({ ...state, cart: [], notifications: [notification, ...state.notifications] });
    }
    case 'quantity':
      if (!Number.isInteger(action.quantity) || action.quantity < 1 || action.quantity > 99) return state;
      return { ...state, cart: state.cart.map((item) => item.id === action.id ? { ...item, quantity: action.quantity } : item) };
    case 'updateCart': return normalizeShop({ ...state, cart: action.cart });
    case 'orderCancelled': {
      if (!action.order || !validId(action.order.id)) return state;
      const notification = { id: 'cancel-' + action.order.id, kind: 'orderCancelled', orderId: action.order.id, title: 'Pesanan dibatalkan', message: 'Pesanan telah dibatalkan. Lihat detail untuk informasi pembatalan.', createdAt: action.order.cancelledAt, read: false };
      return normalizeShop({ ...state, notifications: [notification, ...state.notifications.filter((item) => item.id !== notification.id)] });
    }
    case 'remove': return { ...state, cart: state.cart.filter((item) => item.id !== action.id) };
    case 'clearCart': return { ...state, cart: [] };
    case 'toggleFavorite': {
      if (!validId(action.id)) return state;
      const favoriteIds = state.favoriteIds.includes(action.id)
        ? state.favoriteIds.filter((id) => id !== action.id)
        : state.favoriteIds.length >= 100 ? state.favoriteIds : [...state.favoriteIds, action.id];
      return { ...state, favoriteIds };
    }
    case 'read': return { ...state, notifications: state.notifications.map((item) => item.id === action.id ? { ...item, read: true } : item) };
    case 'readAll': return { ...state, notifications: state.notifications.map((item) => ({ ...item, read: true })) };
    case 'removeNotification': return { ...state, notifications: state.notifications.filter((item) => item.id !== action.id) };
    default: return state;
  }
}
