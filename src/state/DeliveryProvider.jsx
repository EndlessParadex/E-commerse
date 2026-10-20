import { useCallback, useEffect, useRef, useState } from 'react';
import { DeliveryContext } from './useDelivery';
import { normalizeDelivery, readDelivery, writeDelivery } from './deliveryModel';
import { requestLogout } from '../components/account/accountSession';
import { normalizeWhatsApp } from './whatsappModel';

function initialLocation() {
  try {
    return readDelivery(window.localStorage);
  } catch {
    return null;
  }
}

export default function DeliveryProvider({ children }) {
  const [savedLocation, setSavedLocation] = useState(initialLocation);
  const [storageError, setStorageError] = useState(false);
  const [user, setUserState] = useState(null);
  const userRef = useRef(null);
  const sessionGeneration = useRef(0);
  const setUser = useCallback((value) => {
    const next = typeof value === 'function' ? value(userRef.current) : value;
    if ((next?.id || null) !== (userRef.current?.id || null)) sessionGeneration.current += 1;
    userRef.current = next;
    setUserState(next);
  }, []);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const logoutPending = useRef(false);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { credentials: 'include', signal: AbortSignal.timeout(15000) })
      .then((response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error('Session unavailable');
        return response.json();
      })
      .then((payload) => {
        if (!active || !payload?.user) return;
        setUser(payload.user);
        setSavedLocation(
          normalizeDelivery({ namaToko: payload.user.name, namaJalan: payload.user.address }),
        );
      })
      .catch(() => {
        if (active)
          setAuthError('Sesi belum dapat diperiksa. Periksa koneksi lalu muat ulang halaman.');
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, [setUser]);

  const saveLocation = async (value) => {
    const actor = userRef.current;
    const generation = sessionGeneration.current;
    const normalized = normalizeDelivery(value);
    if (!normalized) return { ok: false, persisted: false };
    let persisted = false;
    if (actor) {
      try {
        const storeName =
          typeof value?.storeName === 'string' ? value.storeName.trim() : actor.storeName || '';
        if (storeName.length > 100 || (storeName.length > 0 && storeName.length < 2))
          return { ok: false, persisted: false };
        const response = await fetch('/api/profile', {
          method: 'PUT',
          credentials: 'include',
          signal: AbortSignal.timeout(15000),
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: normalized.namaToko,
            address: normalized.namaJalan,
            storeName,
          }),
        });
        if (!response.ok) return { ok: false, persisted: false };
        const payload = await response.json();
        if (
          sessionGeneration.current !== generation ||
          payload?.user?.id !== actor.id ||
          payload.user.name !== normalized.namaToko ||
          payload.user.address !== normalized.namaJalan ||
          (payload.user.storeName || '') !== storeName
        )
          return { ok: false, persisted: false };
        setUser((current) => ({
          ...payload.user,
          avatar: current?.avatar ?? payload.user.avatar ?? '',
          phone: current?.phone ?? payload.user.phone ?? '',
          phoneVerified: current?.phoneVerified ?? payload.user.phoneVerified ?? false,
          phoneVerifiedAt: current?.phoneVerifiedAt ?? payload.user.phoneVerifiedAt ?? null,
          phoneRevision: current?.phoneRevision ?? payload.user.phoneRevision ?? '',
        }));
      } catch {
        return { ok: false, persisted: false };
      }
    }
    try {
      persisted = writeDelivery(normalized, window.localStorage);
    } catch {
      /* Storage can be blocked; keep the address for this session. */
    }
    setSavedLocation(normalized);
    setStorageError(!persisted);
    return { ok: true, persisted };
  };

  const saveAvatar = async (avatar) => {
    const actor = userRef.current;
    const generation = sessionGeneration.current;
    if (!actor) return { ok: false, error: 'Masuk untuk mengubah foto profil.' };
    const userId = actor.id;
    try {
      const response = await fetch('/api/profile/photo', {
        method: 'PUT',
        credentials: 'include',
        signal: AbortSignal.timeout(15000),
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ avatar }),
      });
      const payload = await response.json();
      if (sessionGeneration.current !== generation)
        return {
          ok: false,
          error: 'Sesi akun berubah. Muat ulang profil akun yang sedang digunakan.',
        };
      if (!response.ok)
        return {
          ok: false,
          error:
            response.status === 401
              ? 'Sesi berakhir. Masuk kembali.'
              : payload.errors?.form || 'Foto belum dapat disimpan.',
        };
      if (payload?.user?.id !== userId || payload.user.avatar !== avatar)
        return {
          ok: false,
          error:
            'Foto belum dapat dikonfirmasi. Jalankan ulang server terbaru, lalu muat ulang profil untuk memeriksa hasilnya.',
        };
      setUser((current) =>
        current?.id === userId ? { ...current, avatar: payload.user.avatar } : current,
      );
      return { ok: true };
    } catch {
      return {
        ok: false,
        error:
          'Hasil penyimpanan belum dapat dikonfirmasi. Periksa koneksi lalu muat ulang profil sebelum mencoba lagi.',
      };
    }
  };

  const savePhone = async (value) => {
    const actor = userRef.current;
    const generation = sessionGeneration.current;
    if (!actor) return { ok: false, error: 'Masuk untuk mengubah nomor HP.' };
    const phone = normalizeWhatsApp(value);
    if (typeof value !== 'string' || value.length > 40 || (value.trim() && !phone))
      return { ok: false, error: 'Isi nomor HP Indonesia yang valid, misalnya 081234567890.' };
    try {
      const response = await fetch('/api/profile/phone', {
        method: 'PUT',
        credentials: 'include',
        signal: AbortSignal.timeout(15000),
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const payload = await response.json();
      if (sessionGeneration.current !== generation)
        return {
          ok: false,
          error: 'Sesi akun berubah. Muat ulang profil akun yang sedang digunakan.',
        };
      if (!response.ok)
        return {
          ok: false,
          error:
            response.status === 401
              ? 'Sesi berakhir. Masuk kembali.'
              : payload.errors?.form || 'Nomor HP belum dapat disimpan.',
        };
      if (payload?.user?.id !== actor.id || payload.user.phone !== phone)
        return {
          ok: false,
          error: 'Nomor HP belum dapat dikonfirmasi. Muat ulang profil untuk memeriksa hasilnya.',
        };
      setUser((current) =>
        current?.id === actor.id
          ? {
              ...current,
              phone,
              phoneVerified: payload.user.phoneVerified === true,
              phoneVerifiedAt: payload.user.phoneVerifiedAt ?? null,
              phoneRevision: payload.user.phoneRevision || '',
            }
          : current,
      );
      return { ok: true, phone };
    } catch {
      return {
        ok: false,
        error:
          'Hasil penyimpanan belum dapat dikonfirmasi. Periksa koneksi lalu muat ulang profil sebelum mencoba lagi.',
      };
    }
  };

  const logout = async () => {
    if (logoutPending.current) return false;
    logoutPending.current = true;
    setLoggingOut(true);
    setLogoutError('');
    const ok = await requestLogout();
    if (ok) setUser(null);
    else setLogoutError('Belum berhasil keluar. Periksa koneksi server lalu coba lagi.');
    logoutPending.current = false;
    setLoggingOut(false);
    return ok;
  };

  return (
    <DeliveryContext.Provider
      value={{
        savedLocation,
        saveLocation,
        saveAvatar,
        savePhone,
        storageError,
        user,
        setUser,
        authLoading,
        authError,
        logout,
        loggingOut,
        logoutError,
      }}
    >
      {children}
    </DeliveryContext.Provider>
  );
}
