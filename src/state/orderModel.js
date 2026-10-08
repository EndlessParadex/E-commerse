import { normalizeWhatsApp } from './whatsappModel.js';
import { cartItemPresentation } from '../data/cartItemPresentation.js';
import { snapshotImage } from '../data/productSnapshot.js';
export const ORDER_STORAGE_KEY = 'bam.order.last.v1';
export const ORDER_HISTORY_KEY = 'bam.orders.v1';
export const ORDER_NOTE_MAX_LENGTH = 300;

const validItem = (item) => item && typeof item.id === 'string' && item.id.length > 0 && typeof item.name === 'string' && Number.isSafeInteger(item.price) && item.price >= 0 && Number.isInteger(item.quantity) && item.quantity > 0;

export function createOrder({ cart, recipient, address, shipping, payment, whatsappNumber = '', whatsappOptIn = false, note = '' }) {
  const items = (Array.isArray(cart) ? cart : []).filter(validItem).map((item) => {
    const display = cartItemPresentation(item);
    return {
      id: item.id,
      name: item.name.trim().slice(0, 200),
      price: item.price,
      quantity: item.quantity,
      details: {
        name: display.name, brand: display.brand, sizeLabel: display.sizeLabel,
        image: snapshotImage(display.product.image),
        imageAlt: display.product.imageAlt || item.name, icon: display.product.icon || '📦', color: display.product.color || '',
      },
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingCost = Number.isSafeInteger(shipping?.cost) && shipping.cost >= 0 ? shipping.cost : 0;
  const id = 'BAM-' + crypto.randomUUID().toUpperCase();
  return {
    id,
    createdAt: Date.now(),
    recipient: String(recipient || '').trim().slice(0, 100),
    address: String(address || '').trim().slice(0, 500),
    shipping: { label: String(shipping?.label || 'Pengiriman reguler').slice(0, 100), cost: shippingCost },
    payment: { label: String(payment?.label || 'Bayar di tempat').slice(0, 100) },
    items,
    note: typeof note === 'string' ? note.trim().slice(0, ORDER_NOTE_MAX_LENGTH) : '',
    subtotal,
    total: subtotal + shippingCost,
    whatsapp: {
      optedIn: whatsappOptIn === true && Boolean(normalizeWhatsApp(whatsappNumber)),
      number: whatsappOptIn === true ? normalizeWhatsApp(whatsappNumber) : '',
      simulation: true,
    },
  };
}

export function saveOrder(order, storage) {
  try {
    if (!validOrder(order)) return false;
    const orders = readOrders(storage).filter((entry) => entry.id !== order.id);
    storage.setItem(ORDER_HISTORY_KEY, JSON.stringify([order, ...orders]));
    return true;
  } catch {
    return false;
  }
}

export function readOrder(id, storage) {
  try {
    return readOrders(storage).find((order) => order.id === id) || null;
  } catch {
    return null;
  }
}

const validOrder = (order) => order && typeof order.id === 'string' && order.id.length > 0
  && Number.isFinite(order.createdAt) && Math.abs(order.createdAt) <= 8.64e15
  && typeof order.recipient === 'string' && typeof order.address === 'string'
  && (order.note === undefined || (typeof order.note === 'string' && order.note.length <= ORDER_NOTE_MAX_LENGTH))
  && Array.isArray(order.items) && order.items.every(validItem)
  && typeof order.shipping?.label === 'string' && Number.isSafeInteger(order.shipping.cost) && order.shipping.cost >= 0
  && typeof order.payment?.label === 'string'
  && Number.isSafeInteger(order.subtotal) && order.subtotal >= 0
  && order.subtotal === order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  && Number.isSafeInteger(order.total) && order.total === order.subtotal + order.shipping.cost;

function parseStored(value) {
  try { return JSON.parse(value); }
  catch { return null; }
}

// Import the legacy last order until the first history is saved.
// Storage errors propagate to prevent checkout from overwriting unreadable history.
export function readOrders(storage) {
  const history = storage.getItem(ORDER_HISTORY_KEY);
  const value = history === null ? [parseStored(storage.getItem(ORDER_STORAGE_KEY))] : parseStored(history);
  const seen = new Set();
  return (Array.isArray(value) ? value : []).filter((order) => {
    if (!validOrder(order) || seen.has(order.id)) return false;
    seen.add(order.id);
    return true;
  }).sort((a, b) => b.createdAt - a.createdAt);
}
