import { useEffect, useState } from 'react';
import { DeliveryContext } from './useDelivery';
import { normalizeDelivery, readDelivery, writeDelivery } from './deliveryModel';

function initialLocation() {
  try { return readDelivery(window.localStorage); }
  catch { return null; }
}

export default function DeliveryProvider({ children }) {
  const [savedLocation, setSavedLocation] = useState(initialLocation);
  const [storageError, setStorageError] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { credentials: 'include' }).then((response) => response.ok ? response.json() : null).then((payload) => {
      if (!active || !payload?.user) return;
      setUser(payload.user);
      setSavedLocation(normalizeDelivery({ namaToko: payload.user.name, namaJalan: payload.user.address }));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const saveLocation = async (value) => {
    const normalized = normalizeDelivery(value);
    if (!normalized) return { ok: false, persisted: false };
    let persisted = false;
    try { persisted = writeDelivery(normalized, window.localStorage); }
    catch { /* Storage can be blocked; keep the address for this session. */ }
    if (user) {
      try {
        const response = await fetch('/api/profile', { method: 'PUT', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: normalized.namaToko, address: normalized.namaJalan }) });
        if (!response.ok) return { ok: false, persisted: false };
        const payload = await response.json();
        setUser(payload.user);
      } catch { return { ok: false, persisted: false }; }
    }
    setSavedLocation(normalized);
    setStorageError(!persisted);
    return { ok: true, persisted };
  };

  return <DeliveryContext.Provider value={{ savedLocation, saveLocation, storageError, user, setUser }}>
    {children}
  </DeliveryContext.Provider>;
}
