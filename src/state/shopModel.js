import { packagingSnapshot, readPackagingSnapshot } from '../data/productPackaging.js';
import { notificationKind, notificationMessage, normalizeNotificationReceipts, orderNotification, syncOrderNotifications } from './orderNotifications.js';
export { orderNotification } from './orderNotifications.js';
export const STORAGE_KEY = 'bam.shop.v1';
export const emptyShop = () => ({ cart: [], notifications: [], favoriteIds: [] });
const validId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 100;
const validProduct = (p) => p && validId(p.id) && typeof p.name === 'string' && p.name.trim() && Number.isSafeInteger(p.price) && p.price >= 0 && p.price <= 1_000_000_000;

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
    if (notificationKind(item.kind) && validId(item.orderId)) {
      notification.kind = item.kind;
      notification.orderId = item.orderId;
      notification.title = notificationKind(item.kind).title;
      notification.message = notificationMessage(item.kind, item.orderId);
    }
    result.notifications.push(notification);
  }
  result.notifications.sort((a, b) => b.createdAt - a.createdAt);
  result.notifications = result.notifications.slice(0, 100);
  if (Array.isArray(value.notificationReceipts)) result.notificationReceipts = normalizeNotificationReceipts(value.notificationReceipts);
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
      const synced = syncOrderNotifications(state, [action.order]);
      if (action.order.notificationEvents?.length || state.notifications.some((item) => item.id === notification.id)) return normalizeShop({ ...synced, cart: [] });
      return normalizeShop({ ...state, cart: [], notifications: [notification, ...state.notifications] });
    }
    case 'syncOrderNotifications': {
      const synced = syncOrderNotifications(state, action.orders);
      return synced === state ? state : normalizeShop(synced);
    }
    case 'quantity':
      if (!Number.isInteger(action.quantity) || action.quantity < 1 || action.quantity > 99) return state;
      return { ...state, cart: state.cart.map((item) => item.id === action.id ? { ...item, quantity: action.quantity } : item) };
    case 'updateCart': return normalizeShop({ ...state, cart: action.cart });
    case 'orderCancelled': {
      if (!action.order || !validId(action.order.id)) return state;
      if (action.order.notificationEvents?.length) return normalizeShop(syncOrderNotifications(state, [action.order]));
      const notification = orderNotification(action.order, 'orderCancelled', action.order.cancelledAt);
      if (!notification || state.notifications.some((item) => item.id === notification.id)) return state;
      return normalizeShop({ ...state, notifications: [notification, ...state.notifications] });
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
    case 'removeReadNotifications': return { ...state, notifications: state.notifications.filter((item) => !item.read) };
    case 'restoreNotification': {
      if (!action.notification || state.notifications.some((item) => item.id === action.notification.id)) return state;
      return normalizeShop({ ...state, notifications: [action.notification, ...state.notifications] });
    }
    default: return state;
  }
}
