import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { companyStorageKey } from '../data/companyStore.js';
import { nextStoreDelivery } from '../data/b2bDeliverySchedule.js';
import { workflowUsesServer } from '../data/adminStore.js';
import { subscribeShopRoute, shopRouteSnapshot } from './shopNavigation.js';

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    signal: AbortSignal.timeout(15000),
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.errors?.form || 'Keranjang belum dapat dimuat. Coba lagi.');
    error.status = response.status;
    throw error;
  }
  return payload;
}
const cartPath = (selection) =>
  '/api/b2b/stores/' + encodeURIComponent(selection.storeId) + '/cart';
const keyFor = (userId) => companyStorageKey('bam.shared-cart.selection.' + userId);
const emptyPage = { stores: [], total: 0, page: 1, pages: 1 };

export default function useSharedCart(user, authLoading) {
  const userId = user?.id;
  const { route } = useSyncExternalStore(subscribeShopRoute, shopRouteSnapshot, shopRouteSnapshot);
  const active =
    workflowUsesServer && Boolean(user) && (user.role !== 'admin' || route === '/admin/keranjang');
  const [context, setContext] = useState(null);
  const [status, setStatus] = useState(active ? 'loading' : 'legacy');
  const [selection, setSelection] = useState({ storeId: '', date: '' });
  const [cart, setCart] = useState(null);
  const [stores, setStores] = useState(emptyPage);
  const [cycles, setCycles] = useState({ cycles: [], page: 1, pages: 1 });
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(false);
  const selected = useRef(selection);
  const snapshot = useRef(null);
  const changing = useRef(false);
  const pending = useRef(null);
  const readId = useRef(0);
  const storeReadId = useRef(0);
  const bootId = useRef(0);

  const load = useCallback(async (target = selected.current, quiet = false) => {
    if (!target.storeId || !target.date) return null;
    const id = ++readId.current;
    if (!quiet) setReading(true);
    try {
      const payload = await request(cartPath(target) + '?date=' + encodeURIComponent(target.date));
      if (!alive.current || id !== readId.current || changing.current) return null;
      if (!payload.cart || !Array.isArray(payload.cart.items))
        throw new Error('Respons keranjang tidak valid.');
      const previous = snapshot.current;
      const next =
        previous?.id === payload.cart.id && previous?.revision === payload.cart.revision
          ? { ...payload.cart, events: previous.events, hasMore: previous.hasMore }
          : payload.cart;
      snapshot.current = next;
      setCart(next);
      setError('');
      return next;
    } catch (failure) {
      if (alive.current && id === readId.current) {
        setError(failure.message);
        // Access loss must remove cached business data immediately.
        if ([401, 403, 404].includes(failure.status)) {
          snapshot.current = null;
          setCart(null);
        }
      }
      return null;
    } finally {
      if (alive.current && id === readId.current) setReading(false);
    }
  }, []);
  const findStores = useCallback(async (query = '', page = 1) => {
    const id = ++storeReadId.current;
    try {
      const payload = await request(
        '/api/b2b/stores?page=' + page + '&q=' + encodeURIComponent(query),
      );
      if (!Array.isArray(payload.stores)) throw new Error('Daftar toko tidak valid.');
      if (alive.current && id === storeReadId.current) setStores(payload);
      return payload;
    } catch (failure) {
      if (alive.current && id === storeReadId.current) setError(failure.message);
      return null;
    }
  }, []);
  const loadCycles = useCallback(async (page = 1, target = selected.current) => {
    if (!target.storeId) return;
    try {
      const payload = await request(
        '/api/b2b/stores/' + encodeURIComponent(target.storeId) + '/carts?page=' + page,
      );
      if (alive.current && selected.current.storeId === target.storeId) setCycles(payload);
    } catch (failure) {
      if (alive.current && selected.current.storeId === target.storeId) setError(failure.message);
    }
  }, []);
  const choose = useCallback(
    async (target) => {
      if (changing.current || pending.current) return false;
      selected.current = target;
      snapshot.current = null;
      setSelection(target);
      setCart(null);
      setError('');
      setNotice('');
      setCycles({ cycles: [], page: 1, pages: 1 });
      try {
        localStorage.setItem(keyFor(userId), JSON.stringify(target));
      } catch {
        /* Selection only; cart lives on server. */
      }
      const [loaded] = await Promise.all([load(target), loadCycles(1, target)]);
      return Boolean(loaded);
    },
    [userId, load, loadCycles],
  );

  useEffect(() => {
    const generation = ++bootId.current;
    alive.current = true;
    if (!active || authLoading)
      return () => {
        alive.current = false;
      };
    // oxlint-disable-next-line react/set-state-in-effect
    setStatus('loading');
    snapshot.current = null;
    pending.current = null;
    changing.current = false;
    setCart(null);
    setBusy(false);
    setUncertain(false);
    setReading(false);
    setError('');
    setNotice('');
    (async () => {
      try {
        const result = await request('/api/b2b/cart-context');
        if (!alive.current || generation !== bootId.current) return;
        if (typeof result.enabled !== 'boolean')
          throw new Error('Status keranjang B2B tidak valid.');
        setContext(result);
        if (!result.enabled) {
          setStatus('legacy');
          return;
        }
        const page = await findStores();
        if (!alive.current || generation !== bootId.current) return;
        if (!page) throw new Error('Daftar toko belum dapat dimuat.');
        let saved;
        try {
          saved = JSON.parse(localStorage.getItem(keyFor(userId)));
        } catch {
          /* Optional preference. */
        }
        const chosenStoreId =
          typeof saved?.storeId === 'string'
            ? saved.storeId
            : page.total === 1
              ? page.stores[0].id
              : '';
        const chosenStore = page.stores.find((store) => store.id === chosenStoreId);
        const scheduledDate = nextStoreDelivery(chosenStore?.deliverySchedule, result.today);
        const target = {
          storeId: chosenStoreId,
          date:
            scheduledDate ||
            (/^20\d{2}-\d{2}-\d{2}$/.test(saved?.date || '') ? saved.date : result.today),
        };
        selected.current = target;
        setSelection(target);
        setStatus('ready');
        if (target.storeId) await Promise.all([load(target), loadCycles(1, target)]);
      } catch (failure) {
        if (alive.current && generation === bootId.current) {
          setError(failure.message);
          setStatus('error');
        }
      }
    })();
    return () => {
      alive.current = false;
      bootId.current += 1;
      readId.current += 1;
      storeReadId.current += 1;
    };
  }, [active, authLoading, userId, attempt, findStores, load, loadCycles]);

  useEffect(() => {
    if (!active || status !== 'ready' || !context?.enabled) return;
    const refresh = () => {
      if (!document.hidden && !changing.current && !pending.current)
        void load(selected.current, true);
    };
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [active, status, context?.enabled, load]);

  const send = async (operation) => {
    if (changing.current) return false;
    changing.current = true;
    readId.current += 1;
    setBusy(true);
    setError('');
    setNotice('');
    let conflict = false;
    let failureMessage = '';
    const session = bootId.current;
    try {
      const payload = await request(operation.endpoint || cartPath(operation.target), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(operation.body),
      });
      if (!payload.cart || !Array.isArray(payload.cart.items))
        throw new Error('Status penyimpanan belum dapat dipastikan.');
      if (!alive.current || session !== bootId.current) return false;
      pending.current = null;
      setUncertain(false);
      snapshot.current = payload.cart;
      setCart(payload.cart);
      if (payload.cart.date !== operation.target.date) {
        const target = { storeId: operation.target.storeId, date: payload.cart.date };
        selected.current = target;
        setSelection(target);
        try {
          localStorage.setItem(keyFor(userId), JSON.stringify(target));
        } catch {
          /* Cart remains usable when browser storage is unavailable. */
        }
      }
      setNotice(
        operation.admin
          ? payload.order
            ? payload.order.inventoryReserved
              ? 'Pesanan berhasil difinalisasi. Stok sudah dicadangkan.'
              : 'Pesanan toko sudah tercatat. Buka detail untuk melihat status terbaru.'
            : 'Status pemrosesan keranjang tersimpan.'
          : 'Tersimpan di keranjang bersama.',
      );
      return true;
    } catch (failure) {
      if (!alive.current || session !== bootId.current) return false;
      if (!failure.status || failure.status >= 500) {
        pending.current = operation;
        setUncertain(true);
        setError(
          'Status penyimpanan belum pasti. Tekan “Pastikan penyimpanan” sebelum melanjutkan; perubahan yang sama tidak akan digandakan.',
        );
      } else {
        pending.current = null;
        setUncertain(false);
        conflict = failure.status === 409;
        failureMessage = failure.message;
        setError(failure.message);
        if ([401, 403, 404].includes(failure.status)) {
          snapshot.current = null;
          setCart(null);
        }
      }
      return false;
    } finally {
      if (session === bootId.current) changing.current = false;
      if (alive.current && session === bootId.current) {
        setBusy(false);
        setReading(false);
        if (conflict) {
          await load(operation.target);
          if (alive.current && session === bootId.current)
            setError(
              operation.admin
                ? failureMessage
                : 'Keranjang sudah berubah. Isian terbaru dimuat; periksa lalu ulangi perubahan Anda.',
            );
        }
        if (session === bootId.current) void loadCycles(1, operation.target);
      }
    }
  };
  const mutate = (action, productId, quantity, expectedRevision, options = {}) => {
    if (!snapshot.current?.canEdit || changing.current || pending.current || reading)
      return Promise.resolve(false);
    const operation = {
      target: { ...selected.current },
      body: {
        date: selected.current.date,
        revision: expectedRevision ?? snapshot.current.revision,
        // Local-network HTTP browsers may expose getRandomValues without randomUUID.
        requestId: Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join(''),
        action,
        ...(action === 'payment' ? { paymentId: productId } : productId ? { productId } : {}),
        ...(quantity !== undefined ? { quantity } : {}),
        ...(action === 'switch_package' ? { targetProductId: options.targetProductId } : {}),
      },
    };
    return send(operation);
  };
  const olderEvents = async () => {
    const previous = snapshot.current;
    if (!previous?.events.length || !previous.hasMore) return;
    const target = selected.current;
    try {
      const payload = await request(
        cartPath(target) +
          '/events?date=' +
          target.date +
          '&before=' +
          previous.events.at(-1).revision,
      );
      if (alive.current && snapshot.current === previous) {
        const next = {
          ...previous,
          events: [...previous.events, ...payload.events],
          hasMore: payload.hasMore,
        };
        snapshot.current = next;
        setCart(next);
      }
    } catch (failure) {
      if (alive.current) setError(failure.message);
    }
  };
  const adminAction = (action, options = {}) => {
    if (
      !['admin', 'owner'].includes(context?.role) ||
      !snapshot.current ||
      changing.current ||
      pending.current ||
      reading
    )
      return Promise.resolve(false);
    return send({
      target: { ...selected.current },
      admin: true,
      endpoint: '/api/admin/b2b/stores/' + encodeURIComponent(selected.current.storeId) + '/cart',
      body: {
        date: selected.current.date,
        revision: snapshot.current.revision,
        requestId: Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join(''),
        action,
        ...options,
      },
    });
  };
  return {
    enabled: active && status !== 'legacy',
    status,
    role: context?.role,
    selection,
    stores,
    cycles,
    cart,
    busy,
    reading,
    uncertain,
    error,
    notice,
    canEdit: Boolean(
      status === 'ready' && cart?.canEdit && !busy && !reading && !uncertain && !error,
    ),
    findStores,
    choose,
    loadCycles,
    olderEvents,
    mutate,
    adminAction,
    clearError: () => {
      if (!pending.current) setError('');
    },
    refresh: () => load(),
    retry: () => {
      setStatus('loading');
      setAttempt((value) => value + 1);
    },
    retryPending: () => (pending.current ? send(pending.current) : Promise.resolve(false)),
  };
}
