import { products } from '../data/products.js';
import { packagingValues, sizeKey } from '../data/productPackaging.js';
import { createCheckoutOrder, readOrders, saveOrder } from './orderModel.js';
import { notifyWorkflow } from './workflowEvents.js';
import { paymentMethod } from './paymentMethods.js';

export const STOCK_KEY = 'bam.stock.preview.v1';
export const DEMO_STOCK = 120;
export const PAYMENT_WINDOW = 24 * 60 * 60 * 1000;
export const stockKey = (product) => `${product.groupId || product.id}:${sizeKey(product)}`;
export const isCOD = (order) => order.payment?.groupId === 'cod' || /^(cod|bayar di tempat)$/i.test(order.payment?.label || '');

function readStock(storage) {
  const raw = storage.getItem(STOCK_KEY);
  if (raw === null) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some((amount) => !Number.isSafeInteger(amount) || amount < 0)) throw new Error('Data stok pratinjau tidak dapat dibaca.');
  return value;
}
export function usedStock(key, orders) {
  return orders.filter((order) => !['cancelled', 'expired'].includes(order.status)).reduce((sum, order) => sum + (order.inventory || []).filter((row) => row.key === key).reduce((amount, row) => amount + row.units, 0), 0);
}
export function availableStock(product, storage, orders = readOrders(storage)) {
  const key = stockKey(product);
  return Math.max(0, (readStock(storage)[key] ?? DEMO_STOCK) - usedStock(key, orders));
}
export function cartStockLimit(product, cart, storage, orders = readOrders(storage)) {
  const key = stockKey(product);
  const others = cart.filter((item) => item.id !== product.id).reduce((sum, item) => {
    const current = products.find((entry) => entry.id === item.id);
    return current && stockKey(current) === key ? sum + item.quantity * packagingValues(current).unitsPerPackage : sum;
  }, 0);
  return Math.min(99, Math.max(0, Math.floor((availableStock(product, storage, orders) - others) / packagingValues(product).unitsPerPackage)));
}
export function reviewStock(cart, storage, orders = readOrders(storage)) {
  return cart.flatMap((item) => {
    const product = products.find((entry) => entry.id === item.id);
    if (!product) return [];
    const maximum = cartStockLimit(product, cart, storage, orders);
    return item.quantity > maximum ? [{ id: item.id, name: item.name, type: 'stock', maximum, current: product }] : [];
  });
}
export function setAvailableStock(product, amount, storage) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000_000) return { error: 'Isi stok dengan bilangan bulat antara 0 dan 1.000.000.000 satuan.' };
  try {
    const key = stockKey(product);
    const stock = readStock(storage);
    // Existing orders retain their allocation; changing availability does not undo them.
    stock[key] = amount + usedStock(key, readOrders(storage));
    storage.setItem(STOCK_KEY, JSON.stringify(stock)); notifyWorkflow();
    return { saved: true };
  } catch { return { error: 'Stok belum tersimpan. Periksa penyimpanan browser dan coba lagi.' }; }
}
export function placePreviewOrder(input, storage, now = Date.now()) {
  const order = createCheckoutOrder(input);
  if (reviewStock(input.cart, storage).length) throw new Error('Stok tidak cukup. Kurangi jumlah barang pada keranjang sebelum checkout.');
  const allocations = new Map();
  for (const item of input.cart) {
    const product = products.find((entry) => entry.id === item.id);
    const key = stockKey(product);
    allocations.set(key, (allocations.get(key) || 0) + packagingValues(product).unitsPerPackage * item.quantity);
  }
  order.inventory = [...allocations].map(([key, units]) => ({ key, units }));
  order.createdAt = now;
  if (!isCOD(order)) order.payment.expiresAt = now + PAYMENT_WINDOW;
  if (!saveOrder(order, storage)) throw new Error('Pesanan belum tersimpan. Penyimpanan browser tidak tersedia atau penuh.');
  return order;
}
export function updatePreviewOrder(id, action, storage, details = {}, now = Date.now()) {
  try {
    const order = readOrders(storage, now).find((entry) => entry.id === id);
    if (!order) return { error: 'Pesanan tidak ditemukan.' };
    let next;
    const awaiting = order.status === 'awaiting_payment' && !isCOD(order) && ['pending', 'failed'].includes(order.payment.status);
    if (['paid', 'failed', 'retry', 'expire'].includes(action)) {
      if (!awaiting) return { error: 'Status pesanan sudah berubah. Pembayaran ini tidak dapat dilanjutkan.' };
      if (action !== 'expire' && !paymentMethod(order.payment.id)) return { error: 'Metode pembayaran ini tidak lagi tersedia. Batalkan pesanan dan pilih metode lain pada checkout.' };
      next = { ...order, status: action === 'paid' ? 'processing' : action === 'expire' ? 'expired' : 'awaiting_payment', payment: { ...order.payment, status: ({ paid: 'paid', failed: 'failed', retry: 'pending', expire: 'expired' })[action], ...(action === 'paid' ? { paidAt: now } : {}) } };
    } else if (action === 'ship') {
      if (order.status !== 'processing' || (!isCOD(order) && order.payment.status !== 'paid')) return { error: 'Pesanan harus diproses dan pembayarannya tercatat sebelum dikirim.' };
      const courier = String(details.courier || '').trim(); const trackingNumber = String(details.trackingNumber || '').trim();
      if (!courier || !trackingNumber || courier.length > 100 || trackingNumber.length > 100) return { error: 'Isi nama kurir dan nomor resi, maksimal 100 karakter.' };
      next = { ...order, status: 'shipped', shipping: { ...order.shipping, courier, trackingNumber, shippedAt: now } };
    } else if (action === 'complete') {
      if (order.status !== 'shipped') return { error: 'Hanya pesanan yang sudah dikirim yang dapat diselesaikan.' };
      next = { ...order, status: 'completed', shipping: { ...order.shipping, deliveredAt: now }, payment: { ...order.payment, ...(isCOD(order) ? { status: 'paid', paidAt: now } : {}) } };
    } else return { error: 'Tindakan tidak tersedia.' };
    if (!saveOrder(next, storage)) return { error: 'Perubahan belum tersimpan. Coba lagi.' };
    return { order: next };
  } catch { return { error: 'Penyimpanan browser belum dapat diakses. Perubahan belum tersimpan.' }; }
}
