import { normalizeWhatsApp } from './whatsappModel.js';
import { cartItemPresentation } from '../data/cartItemPresentation.js';
import { snapshotImage } from '../data/productSnapshot.js';
import { reviewCart } from '../data/cartValidation.js';
import { paymentMethod } from './paymentMethods.js';
import { notifyWorkflow } from './workflowEvents.js';
export const ORDER_STORAGE_KEY = 'bam.order.last.v1';
export const ORDER_HISTORY_KEY = 'bam.orders.v1';
export const ORDER_NOTE_MAX_LENGTH = 300;

const validItem = (item) => item && typeof item.id === 'string' && item.id.length > 0 && typeof item.name === 'string' && Number.isSafeInteger(item.price) && item.price >= 0 && Number.isInteger(item.quantity) && item.quantity > 0;

export function createOrder({ cart, recipient, address, shipping, payment, whatsappNumber = '', whatsappOptIn = false, note = '' }) {
  const selectedPayment = paymentMethod(payment?.id);
  const items = (Array.isArray(cart) ? cart : []).filter(validItem).map((item) => {
    const display = cartItemPresentation(item);
    return {
      id: item.id,
      name: item.name.trim().slice(0, 200),
      price: item.price,
      quantity: item.quantity,
      details: {
        name: display.name, brand: display.brand, sizeLabel: display.sizeLabel,
        ...(display.packaging ? { packaging: { ...display.packaging } } : {}),
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
    payment: selectedPayment ? { id: selectedPayment.id, groupId: selectedPayment.groupId, provider: selectedPayment.provider, label: selectedPayment.label, status: selectedPayment.groupId === 'cod' ? 'pay_on_delivery' : 'pending' } : { label: String(payment?.label || 'Bayar di tempat').slice(0, 100) },
    status: selectedPayment && selectedPayment.groupId !== 'cod' ? 'awaiting_payment' : 'processing',
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

export function createCheckoutOrder(input) {
  if (!Array.isArray(input?.cart) || input.cart.some((item) => !validItem(item) || item.quantity > 99)) throw new Error('Jumlah barang pada keranjang tidak valid.');
  const review = reviewCart(input.cart);
  if (!review.ready) throw new Error('Periksa kembali keranjang. Ada barang yang tidak tersedia atau informasi produk yang berubah.');
  if (!paymentMethod(input.payment?.id)) throw new Error('Pilih metode pembayaran yang tersedia.');
  return createOrder(input);
}

export const orderStatus = (order) => order.status || 'processing';
export const orderStatusLabel = (order) => ({ processing: 'Diproses', awaiting_payment: 'Menunggu pembayaran', shipped: 'Dikirim', completed: 'Selesai', cancelled: 'Dibatalkan', expired: 'Kedaluwarsa' })[orderStatus(order)] || 'Diproses';
export function cancellationReason(order) {
  if (orderStatus(order) === 'cancelled') return 'Pesanan sudah dibatalkan.';
  if (orderStatus(order) === 'expired') return 'Batas pembayaran telah berakhir. Silakan buat pesanan baru.';
  if (orderStatus(order) === 'shipped' || orderStatus(order) === 'completed') return 'Pesanan yang sudah dikirim atau selesai tidak dapat dibatalkan dari halaman ini.';
  if (order.payment?.status === 'paid') return 'Pembayaran sudah tercatat. Pembatalan memerlukan pemeriksaan pengembalian dana.';
  return '';
}
export function cancelOrder(id, reason, storage) {
  try {
    const orders = readOrders(storage);
    const existing = orders.find((order) => order.id === id);
    if (!existing) return { error: 'Pesanan tidak ditemukan. Coba muat ulang halaman.' };
    const blocked = cancellationReason(existing);
    if (blocked) return { error: blocked };
    const cancelled = { ...existing, status: 'cancelled', cancelledAt: Date.now(), cancellationReason: String(reason || 'Berubah pikiran').trim().slice(0, 200), payment: { ...existing.payment, status: 'cancelled' } };
    storage.setItem(ORDER_HISTORY_KEY, JSON.stringify(orders.map((order) => order.id === id ? cancelled : order)));
    notifyWorkflow();
    return { order: cancelled };
  } catch { return { error: 'Pembatalan belum tersimpan. Penyimpanan browser tidak tersedia atau penuh. Coba lagi.' }; }
}

export function saveOrder(order, storage) {
  try {
    if (!validOrder(order)) return false;
    const orders = readOrders(storage).filter((entry) => entry.id !== order.id);
    storage.setItem(ORDER_HISTORY_KEY, JSON.stringify([order, ...orders]));
    notifyWorkflow();
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
  && (order.status === undefined || ['awaiting_payment', 'processing', 'shipped', 'completed', 'cancelled', 'expired'].includes(order.status))
  && (order.inventory === undefined || (Array.isArray(order.inventory) && order.inventory.every((row) => typeof row.key === 'string' && row.key.length <= 200 && Number.isSafeInteger(row.units) && row.units > 0)))
  && (order.payment?.expiresAt === undefined || (Number.isFinite(order.payment.expiresAt) && Math.abs(order.payment.expiresAt) <= 8.64e15))
  && (order.cancelledAt === undefined || (Number.isFinite(order.cancelledAt) && Math.abs(order.cancelledAt) <= 8.64e15))
  && (order.cancellationReason === undefined || (typeof order.cancellationReason === 'string' && order.cancellationReason.length <= 200))
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
export function readOrders(storage, now = Date.now()) {
  const history = storage.getItem(ORDER_HISTORY_KEY);
  const value = history === null ? [parseStored(storage.getItem(ORDER_STORAGE_KEY))] : parseStored(history);
  const seen = new Set();
  return (Array.isArray(value) ? value : []).filter((order) => {
    if (!validOrder(order) || seen.has(order.id)) return false;
    seen.add(order.id);
    return true;
  }).map((order) => order.status === 'awaiting_payment' && order.payment?.expiresAt <= now ? { ...order, status: 'expired', payment: { ...order.payment, status: 'expired' } } : order).sort((a, b) => b.createdAt - a.createdAt);
}
