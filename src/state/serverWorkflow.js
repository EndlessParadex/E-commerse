import { companyStorageKey } from '../data/companyStore.js';
import { sizeKey, packagingValues } from '../data/productPackaging.js';
import { validOrder } from './orderModel.js';

const listeners = new Set();
const empty = () => ({
  owner: '',
  role: '',
  orders: [],
  adminOrders: [],
  details: {},
  stock: {},
  skuAvailability: {},
  publishedSales: {},
  canImportPreview: false,
  loading: true,
  failed: false,
  error: '',
  nextCursor: null,
  adminCursor: null,
});
let state = empty();
let generation = 0;
let inFlight = null;
const publish = (value) => {
  state = { ...state, ...value };
  listeners.forEach((listener) => listener());
};
export const serverWorkflowSnapshot = () => state;
export const subscribeServerWorkflow = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    ...options,
  });
  const payload = await response.json();
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? 'Sesi berakhir. Masuk kembali ke akun Anda.'
        : payload.errors?.form || 'Server belum dapat memuat atau menyimpan data.',
    );
  return payload;
}
function inventory(payload) {
  if (
    payload?.version !== 1 ||
    !payload.stock ||
    Array.isArray(payload.stock) ||
    Object.values(payload.stock).some(
      (row) =>
        (row.available === undefined
          ? typeof row.inStock !== 'boolean'
          : !Number.isSafeInteger(row.available) || row.available < 0) ||
        !Number.isSafeInteger(row.revision) ||
        row.revision < 0 ||
        ['soldUnits', 'reservedUnits'].some(
          (key) => row[key] !== undefined && (!Number.isSafeInteger(row[key]) || row[key] < 0),
        ),
    )
  )
    throw new Error('Data stok server tidak valid.');
  if (
    payload.skuAvailability !== undefined &&
    (!payload.skuAvailability ||
      Array.isArray(payload.skuAvailability) ||
      Object.values(payload.skuAvailability).some((x) => typeof x !== 'boolean'))
  )
    throw new Error('Data ketersediaan tidak valid.');
  if (
    payload.publishedSales !== undefined &&
    (!payload.publishedSales ||
      Array.isArray(payload.publishedSales) ||
      Object.values(payload.publishedSales).some((x) => !Number.isSafeInteger(x) || x < 0))
  )
    throw new Error('Data penjualan publik tidak valid.');
  if (
    Object.values(payload.stock).some((x) => x.available === undefined) &&
    !payload.skuAvailability
  )
    throw new Error('Data ketersediaan SKU belum tersedia.');
  return payload.stock;
}
function order(value) {
  if (
    !validOrder(value) ||
    value.storage !== 'server' ||
    typeof value.userId !== 'string' ||
    !Number.isSafeInteger(value.revision)
  )
    throw new Error('Data pesanan server tidak valid.');
  return value;
}
function listing(payload, owned = false) {
  if (
    payload?.version !== 1 ||
    !Array.isArray(payload.orders) ||
    !(payload.nextCursor === null || typeof payload.nextCursor === 'string')
  )
    throw new Error('Daftar pesanan server tidak valid.');
  const orders = payload.orders.map(order);
  if (owned && orders.some((entry) => entry.userId !== state.owner))
    throw new Error('Pesanan tidak sesuai dengan akun aktif.');
  return orders;
}
const merge = (existing, incoming) =>
  [...new Map([...existing, ...incoming].map((entry) => [entry.id, entry])).values()].sort(
    (a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id),
  );
export function configureWorkflowSession(user, authLoading = false) {
  generation++;
  inFlight = null;
  state = { ...empty(), owner: user?.id || 'guest', role: user?.role || '', loading: true };
  publish({});
  if (!authLoading) return refreshServerWorkflow();
  return Promise.resolve();
}
export async function refreshServerWorkflow() {
  if (inFlight) return inFlight;
  const token = generation;
  const owner = state.owner;
  const role = state.role;
  inFlight = (async () => {
    try {
      const tasks = [
        api(role === 'admin' ? '/api/admin/inventory' : '/api/inventory'),
        owner !== 'guest'
          ? api('/api/orders')
          : Promise.resolve({ version: 1, orders: [], nextCursor: null }),
        role === 'admin'
          ? api('/api/admin/orders')
          : Promise.resolve({ version: 1, orders: [], nextCursor: null }),
      ];
      const [stock, own, admin] = await Promise.all(tasks);
      if (token !== generation) return;
      const ownedOrders = listing(own, true);
      const allOrders = listing(admin);
      const details = { ...state.details };
      for (const next of [...ownedOrders, ...allOrders])
        if (details[next.id] && details[next.id].revision <= next.revision) details[next.id] = next;
      publish({
        stock: inventory(stock),
        skuAvailability: stock.skuAvailability || {},
        publishedSales: stock.publishedSales || {},
        details,
        canImportPreview: stock.canImportPreview === true,
        orders: merge(state.orders, ownedOrders),
        adminOrders: merge(state.adminOrders, allOrders),
        nextCursor: state.orders.length > 50 ? state.nextCursor : own.nextCursor,
        adminCursor: state.adminOrders.length > 50 ? state.adminCursor : admin.nextCursor,
        loading: false,
        failed: false,
        error: '',
      });
    } catch (error) {
      if (token === generation)
        publish({
          orders: [],
          adminOrders: [],
          details: {},
          stock: {},
          skuAvailability: {},
          publishedSales: {},
          loading: false,
          failed: true,
          error: error.message || 'Server belum dapat dihubungi.',
        });
    } finally {
      if (token === generation) inFlight = null;
    }
  })();
  return inFlight;
}
export function serverStock(product) {
  if (state.failed || state.loading)
    throw new Error(state.error || 'Stok sedang dimuat dari server.');
  const row = state.stock[`${product.groupId || product.id}:${sizeKey(product)}`] || {
    available: 0,
    revision: 0,
  };
  return {
    ...row,
    available: row.available ?? null,
    inStock:
      row.available === undefined
        ? state.skuAvailability[product.id] === true
        : row.available >= packagingValues(product).unitsPerPackage,
    publishedSoldMinimum: state.publishedSales[product.groupId || product.id] ?? null,
  };
}
export async function loadMoreOrders(admin = false) {
  const cursor = admin ? state.adminCursor : state.nextCursor;
  if (!cursor) return { saved: true };
  const token = generation;
  try {
    const payload = await api(
      `${admin ? '/api/admin/orders' : '/api/orders'}?before=${encodeURIComponent(cursor)}`,
    );
    if (token !== generation) return { error: 'Akun berubah. Muat ulang data.' };
    if (admin)
      publish({
        adminOrders: merge(state.adminOrders, listing(payload)),
        adminCursor: payload.nextCursor,
      });
    else
      publish({
        orders: merge(state.orders, listing(payload, true)),
        nextCursor: payload.nextCursor,
      });
    return { saved: true };
  } catch (error) {
    return { error: error.message };
  }
}
function acceptOrder(value) {
  const next = order(value);
  if (state.role !== 'admin' && next.userId !== state.owner)
    throw new Error('Pesanan tidak sesuai dengan akun aktif.');
  if (next.userId === state.owner) {
    try {
      const key = requestStorageKey();
      const metadata = JSON.parse(window.sessionStorage.getItem(key));
      if (metadata?.key === next.requestKey)
        window.sessionStorage.setItem(key, JSON.stringify({ ...metadata, completed: true }));
    } catch {
      /* Reading an order must work even if request metadata is unavailable. */
    }
  }
  publish({
    orders: next.userId === state.owner ? merge(state.orders, [next]) : state.orders,
    adminOrders: state.role === 'admin' ? merge(state.adminOrders, [next]) : [],
    details: { ...state.details, [next.id]: next },
  });
  return next;
}
export async function fetchServerOrder(id) {
  const token = generation;
  try {
    const payload = await api('/api/orders/' + encodeURIComponent(id));
    if (token !== generation) return { error: 'Akun berubah.' };
    return { order: acceptOrder(payload.order) };
  } catch (error) {
    return { error: error.message };
  }
}
export async function setServerStock(product, amount, revision) {
  const token = generation;
  try {
    const payload = await api('/api/admin/inventory', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        key: `${product.groupId || product.id}:${sizeKey(product)}`,
        available: amount,
        revision,
      }),
    });
    if (token !== generation) return { error: 'Akun berubah. Muat ulang data.' };
    publish({
      stock: inventory(payload),
      canImportPreview: payload.canImportPreview === true,
      failed: false,
      error: '',
    });
    return { saved: true };
  } catch (error) {
    await refreshServerWorkflow();
    return { error: error.message };
  }
}
export async function importServerStock(rows) {
  const token = generation;
  try {
    const payload = await api('/api/admin/inventory/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    if (token !== generation) return { error: 'Akun berubah. Muat ulang data.' };
    publish({ stock: inventory(payload), canImportPreview: false, failed: false, error: '' });
    return { saved: true };
  } catch (error) {
    await refreshServerWorkflow();
    return { error: error.message };
  }
}
export async function changeServerOrder(id, action, details = {}, revision) {
  const token = generation;
  const current =
    state.details[id] || [...state.orders, ...state.adminOrders].find((entry) => entry.id === id);
  try {
    const payload = await api('/api/orders/' + encodeURIComponent(id), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...details, action, revision: revision ?? current?.revision }),
    });
    if (token !== generation) return { error: 'Akun berubah. Muat ulang data.' };
    const saved = acceptOrder(payload.order);
    await refreshServerWorkflow();
    return { order: saved };
  } catch (error) {
    await refreshServerWorkflow();
    await fetchServerOrder(id);
    return { error: error.message };
  }
}
const requestStorageKey = () => companyStorageKey('bam.checkout.request.v1.' + state.owner);
export function clearCompletedCheckoutRequest() {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(requestStorageKey()));
    if (raw?.completed) window.sessionStorage.removeItem(requestStorageKey());
  } catch {
    /* Metadata is optional for editing the cart. */
  }
}
export async function createServerOrder(input) {
  if (!state.owner || state.owner === 'guest')
    throw new Error('Masuk ke akun sebelum membuat pesanan.');
  const token = generation;
  const owner = state.owner;
  const body = {
    recipient: input.recipient,
    address: input.address,
    shippingId: input.shipping.id,
    paymentId: input.payment.id,
    note: input.note || '',
    whatsappNumber: input.whatsappNumber || '',
    whatsappOptIn: input.whatsappOptIn === true,
    items: input.cart
      .map((item) => ({ id: item.id, quantity: item.quantity, expectedPrice: item.price }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(body)),
  );
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  if (token !== generation) throw new Error('Akun berubah. Masuk kembali sebelum checkout.');
  const storageKey = requestStorageKey();
  let metadata;
  try {
    metadata = JSON.parse(window.sessionStorage.getItem(storageKey));
    if (
      !/^[a-f\d-]{36}$/i.test(metadata?.key || '') ||
      (metadata.completed && metadata.hash !== hash)
    )
      metadata = { hash, key: crypto.randomUUID(), completed: false };
    window.sessionStorage.setItem(storageKey, JSON.stringify(metadata));
  } catch {
    throw new Error(
      'Nomor permintaan belum dapat disimpan. Izinkan penyimpanan browser sebelum checkout agar pengulangan tidak membuat pesanan ganda.',
    );
  }
  let payload;
  try {
    payload = await api('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, requestKey: metadata.key }),
    });
  } catch (error) {
    await refreshServerWorkflow();
    throw new Error(error.message + ' Periksa Pesanan saya sebelum mencoba kembali.');
  }
  if (token !== generation || owner !== state.owner)
    throw new Error(
      'Pesanan mungkin sudah tersimpan pada akun sebelumnya. Masuk kembali ke akun itu untuk memeriksa riwayat.',
    );
  const saved = acceptOrder(payload.order);
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify({ ...metadata, completed: true }));
  } catch {
    /* The original idempotency key remains available. */
  }
  await refreshServerWorkflow();
  return saved;
}

export async function uploadServerProof(id, image, revision) {
  const token = generation;
  try {
    const payload = await api('/api/orders/' + encodeURIComponent(id) + '/proof', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image, revision }),
    });
    if (token !== generation) return { error: 'Akun berubah. Muat ulang data.' };
    const saved = acceptOrder(payload.order);
    await refreshServerWorkflow();
    return { order: saved };
  } catch (error) {
    await refreshServerWorkflow();
    await fetchServerOrder(id);
    return { error: error.message };
  }
}
