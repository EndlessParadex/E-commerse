const validId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 100;
const validTime = (time) => Number.isFinite(time) && Math.abs(time) <= 8.64e15;
export const shortOrderId = (id) => String(id).replace(/^BAM-/i, '').slice(-8).toUpperCase();

export const notificationKinds = {
  orderCreated: { title: 'Pesanan dibuat', category: 'orders', tone: 'info', icon: 'bag' },
  orderCancelled: { title: 'Pesanan dibatalkan', category: 'orders', tone: 'neutral', icon: 'cancel' },
  orderShipped: { title: 'Pesanan dikirim', category: 'orders', tone: 'info', icon: 'truck' },
  orderCompleted: { title: 'Pesanan selesai', category: 'orders', tone: 'success', icon: 'check' },
  paymentReceived: { title: 'Pembayaran berhasil', category: 'payments', tone: 'success', icon: 'check' },
  paymentFailed: { title: 'Pembayaran belum berhasil', category: 'payments', tone: 'warning', icon: 'alert' },
  paymentExpired: { title: 'Batas pembayaran berakhir', category: 'payments', tone: 'warning', icon: 'clock' },
};
export const notificationKind = (kind) => typeof kind === 'string' && Object.hasOwn(notificationKinds, kind) ? notificationKinds[kind] : null;
export const isOrderNotification = (item) => Boolean(notificationKind(item?.kind) && validId(item.orderId));
export function notificationMessage(kind, orderId) {
  const number = '#' + shortOrderId(orderId);
  return {
    orderCreated: `Pesanan ${number} berhasil dibuat. Lihat detail pesanan Anda.`,
    orderCancelled: 'Pesanan telah dibatalkan. Lihat detail untuk informasi pembatalan.',
    orderShipped: `Pesanan ${number} telah dikirim. Lihat kurir dan nomor resi pada detail pesanan.`,
    orderCompleted: `Pesanan ${number} telah selesai. Terima kasih sudah berbelanja di BAM.`,
    paymentReceived: `Pembayaran pesanan ${number} tercatat. Pesanan sedang diproses.`,
    paymentFailed: `Pembayaran pesanan ${number} belum berhasil. Buka detail pesanan untuk mencoba kembali.`,
    paymentExpired: `Batas pembayaran pesanan ${number} telah berakhir. Silakan buat pesanan baru jika ingin melanjutkan belanja.`,
  }[kind] || '';
}

export function orderNotification(order, kind = 'orderCreated', createdAt = order?.createdAt, sequence = 0) {
  const display = notificationKind(kind);
  if (!display || !validId(order?.id) || !validTime(createdAt)) return null;
  const prefix = kind === 'orderCreated' ? 'order' : kind === 'orderCancelled' ? 'cancel' : kind;
  const id = `${prefix}-${order.id}${['orderCreated', 'orderCancelled'].includes(kind) ? '' : '-' + sequence}`;
  if (!validId(id)) return null;
  return { id, kind, orderId: order.id, title: display.title, message: notificationMessage(kind, order.id), createdAt, read: false };
}

export function readNotificationEvents(order) {
  const seen = new Set();
  return (Array.isArray(order?.notificationEvents) ? order.notificationEvents : []).filter((event) => {
    if (!event || !notificationKind(event.kind) || !validTime(event.createdAt) || !Number.isSafeInteger(event.sequence) || event.sequence < 1 || seen.has(event.sequence)) return false;
    seen.add(event.sequence); return true;
  }).sort((a, b) => a.sequence - b.sequence).slice(-20);
}

// The event and the order change are saved together. Failed writes cannot create alerts.
export function withNotificationEvent(order, kind, createdAt) {
  const events = readNotificationEvents(order);
  const sequence = (events.at(-1)?.sequence || 0) + 1;
  if (!orderNotification(order, kind, createdAt, sequence) || !Number.isSafeInteger(sequence)) return order;
  return { ...order, notificationEvents: [...events, { kind, createdAt, sequence }].slice(-20) };
}

export function normalizeNotificationReceipts(value) {
  if (!Array.isArray(value)) return [];
  const receipts = new Map();
  for (const item of value) {
    if (!item || !validId(item.orderId) || !Number.isSafeInteger(item.sequence) || item.sequence < 1) continue;
    receipts.set(item.orderId, Math.max(item.sequence, receipts.get(item.orderId) || 0));
  }
  return [...receipts].map(([orderId, sequence]) => ({ orderId, sequence }));
}

export function syncOrderNotifications(state, orders) {
  const receipts = new Map(normalizeNotificationReceipts(state.notificationReceipts).map((item) => [item.orderId, item.sequence]));
  const ids = new Set(state.notifications.map((item) => item.id));
  const notifications = [...state.notifications];
  let changed = false;
  for (const order of Array.isArray(orders) ? orders : []) {
    if (!validId(order?.id)) continue;
    let sequence = receipts.get(order.id) || 0;
    for (const event of readNotificationEvents(order)) {
      if (event.sequence <= sequence) continue;
      const notification = orderNotification(order, event.kind, event.createdAt, event.sequence);
      if (!notification) continue;
      if (!ids.has(notification.id)) { notifications.unshift(notification); ids.add(notification.id); }
      sequence = event.sequence; changed = true;
    }
    if (sequence) receipts.set(order.id, sequence);
  }
  if (!changed) return state;
  return { ...state, notifications, notificationReceipts: [...receipts].map(([orderId, sequence]) => ({ orderId, sequence })) };
}
