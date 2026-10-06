import { normalizeWhatsApp } from './whatsappModel.js';
export const ORDER_STORAGE_KEY = 'bam.order.last.v1';

const validItem = (item) => item && typeof item.id === 'string' && item.id.length > 0 && typeof item.name === 'string' && Number.isSafeInteger(item.price) && item.price >= 0 && Number.isInteger(item.quantity) && item.quantity > 0;

export function createOrder({ cart, recipient, address, shipping, payment, whatsappNumber = '', whatsappOptIn = false }) {
  const items = (Array.isArray(cart) ? cart : []).filter(validItem).map((item) => ({
    id: item.id,
    name: item.name.trim().slice(0, 200),
    price: item.price,
    quantity: item.quantity,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingCost = Number.isSafeInteger(shipping?.cost) && shipping.cost >= 0 ? shipping.cost : 0;
  const id = 'BAM-' + Date.now().toString(36).toUpperCase();
  return {
    id,
    createdAt: Date.now(),
    recipient: String(recipient || '').trim().slice(0, 100),
    address: String(address || '').trim().slice(0, 500),
    shipping: { label: String(shipping?.label || 'Pengiriman reguler').slice(0, 100), cost: shippingCost },
    payment: { label: String(payment?.label || 'Bayar di tempat').slice(0, 100) },
    items,
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
    storage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
    return true;
  } catch {
    return false;
  }
}

export function readOrder(id, storage) {
  try {
    const order = JSON.parse(storage.getItem(ORDER_STORAGE_KEY));
    return order && order.id === id && Array.isArray(order.items) ? order : null;
  } catch {
    return null;
  }
}
