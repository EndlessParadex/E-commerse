import { useEffect, useLayoutEffect, useRef } from 'react';
import { normalizeShop } from './shopModel.js';

// The part of the shop state that follows the account across devices.
export function savedPart(state) {
  const value = normalizeShop({ cart: state?.cart, favoriteIds: state?.favoriteIds });
  return { cart: value.cart, favoriteIds: value.favoriteIds };
}

/**
 * Decide what the cart becomes when the server copy first loads on this device.
 * - Nothing changed here since the last sync: the server copy wins (it may have newer edits
 *   from another device, including removals).
 * - Changes made here were never synced (guest cart before login, first use of this device):
 *   keep the server copy and add the items and favourites that only exist here.
 */
export function mergeOnLoad(server, local, lastSynced) {
  const remote = savedPart(server);
  const here = savedPart(local);
  if (
    (lastSynced !== null && JSON.stringify(here) === lastSynced) ||
    (!here.cart.length && !here.favoriteIds.length)
  )
    return { value: remote, push: false };
  const ids = new Set(remote.cart.map((item) => item.id));
  const value = savedPart({
    cart: [...remote.cart, ...here.cart.filter((item) => !ids.has(item.id))],
    favoriteIds: [...new Set([...remote.favoriteIds, ...here.favoriteIds])],
  });
  return { value, push: JSON.stringify(value) !== JSON.stringify(remote) };
}

const request = (method, body) =>
  fetch('/api/cart', {
    method,
    credentials: 'include',
    signal: AbortSignal.timeout(15000),
    ...(body ? { headers: { 'content-type': 'application/json' }, body } : {}),
  });

// Plain controller (no React state) so the network logic stays outside render.
export function createCartSync(latestRef, syncedKey) {
  const getLatest = () => latestRef.current;
  const sync = { revision: null, sent: '', timer: 0, busy: false, active: false };
  const current = () => savedPart(getLatest().stateRef.current);
  const remember = (value) => {
    sync.sent = JSON.stringify(value);
    try {
      localStorage.setItem(syncedKey, sync.sent);
    } catch {
      // The server still holds the cart; only the offline comparison is skipped.
    }
  };
  const adopt = (server) => {
    sync.revision = server.revision;
    const value = savedPart(server);
    remember(value);
    getLatest().replace(value);
  };
  const schedule = (delay) => {
    if (!sync.active || sync.timer) return;
    sync.timer = window.setTimeout(push, delay);
  };
  async function push() {
    sync.timer = 0;
    if (!sync.active || sync.busy || sync.revision === null) return;
    const value = current();
    if (JSON.stringify(value) === sync.sent) return;
    sync.busy = true;
    try {
      const response = await request('PUT', JSON.stringify({ revision: sync.revision, ...value }));
      const payload = await response.json().catch(() => null);
      if (!sync.active) return;
      if (response.ok && payload) {
        sync.revision = payload.revision;
        remember(savedPart(payload));
      } else if (response.status === 409 && payload?.current) adopt(payload.current);
    } catch {
      // Offline: the next change or the next focus retries.
    } finally {
      sync.busy = false;
    }
    if (JSON.stringify(current()) !== sync.sent) schedule(400);
  }
  async function load(initial) {
    if (!initial && (sync.busy || sync.timer)) return;
    try {
      const response = await request('GET');
      if (!response.ok || !sync.active) return;
      const server = await response.json();
      if (!sync.active || sync.busy || (!initial && sync.timer)) return;
      if (!initial) {
        if (server.revision !== sync.revision) adopt(server);
        return;
      }
      let lastSynced = null;
      try {
        lastSynced = localStorage.getItem(syncedKey);
      } catch {
        lastSynced = null;
      }
      const merged = mergeOnLoad(server, getLatest().stateRef.current, lastSynced);
      sync.revision = server.revision;
      remember(savedPart(server));
      getLatest().replace(merged.value);
      if (merged.push) schedule(0);
    } catch {
      // The local copy keeps working; the next focus tries again.
    }
  }
  const refresh = () => {
    if (document.visibilityState === 'visible') void load(false);
  };
  return {
    start() {
      sync.active = true;
      void load(true);
      window.addEventListener('focus', refresh);
      document.addEventListener('visibilitychange', refresh);
      return () => {
        sync.active = false;
        window.clearTimeout(sync.timer);
        sync.timer = 0;
        window.removeEventListener('focus', refresh);
        document.removeEventListener('visibilitychange', refresh);
      };
    },
    changed() {
      if (sync.revision !== null && JSON.stringify(current()) !== sync.sent) schedule(400);
    },
  };
}

/**
 * Keep the personal cart and favourites of a signed-in account in the server.
 * Local storage stays the fast cache; the server is the copy shared by every device.
 */
export function usePersonalCartSync({ enabled, storageKey, stateRef, state, replace }) {
  const latest = useRef({ stateRef, replace });
  useLayoutEffect(() => {
    latest.current = { stateRef, replace };
  });
  const controller = useRef(null);
  useEffect(() => {
    if (!enabled) return undefined;
    const instance = createCartSync(latest, storageKey + '.synced');
    controller.current = instance;
    const stop = instance.start();
    return () => {
      stop();
      controller.current = null;
    };
  }, [enabled, storageKey]);
  useEffect(() => {
    if (enabled) controller.current?.changed();
  }, [enabled, state]);
}
