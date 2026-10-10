import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useDelivery } from './useDelivery';
import { AppearanceContext } from './useAppearance';
import { appearanceOwner, appearanceStorageKey, defaultAppearance, normalizeAppearance, readAppearance, resolveAppearanceMode, writeAppearance } from './appearanceModel';
import '../styles/themes.css';

function browserStorage() { try { return window.localStorage; } catch { return null; } }
const systemSnapshot = () => window.matchMedia?.('(prefers-color-scheme: dark)')?.matches || false;
function subscribeSystem(change) {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (!media) return () => {};
  if (media.addEventListener) {
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }
  media.addListener?.(change);
  return () => media.removeListener?.(change);
}

export default function AppearanceProvider({ children }) {
  const { user } = useDelivery();
  const owner = appearanceOwner(user);
  const stored = useMemo(() => readAppearance(browserStorage(), owner), [owner]);
  const [selection, setSelection] = useState(() => ({ owner, preferences: stored, notice: '' }));
  const systemDark = useSyncExternalStore(subscribeSystem, systemSnapshot, () => false);
  const preferences = selection.owner === owner ? selection.preferences : stored;
  const effectiveMode = resolveAppearanceMode(preferences.mode, systemDark);

  useEffect(() => {
    // Reset feedback when the account changes; render already uses that account's preferences.
    // oxlint-disable-next-line react/set-state-in-effect
    setSelection({ owner, preferences: stored, notice: '' });
  }, [owner, stored]);

  useLayoutEffect(() => {
    const page = document.documentElement;
    const previousTheme = page.getAttribute('data-theme');
    const previousBackground = page.getAttribute('data-background');
    page.setAttribute('data-theme', effectiveMode);
    page.setAttribute('data-background', preferences.background);
    return () => {
      if (previousTheme === null) page.removeAttribute('data-theme'); else page.setAttribute('data-theme', previousTheme);
      if (previousBackground === null) page.removeAttribute('data-background'); else page.setAttribute('data-background', previousBackground);
    };
  }, [effectiveMode, preferences.background]);

  useEffect(() => {
    const sync = (event) => {
      if (event.storageArea && event.storageArea !== browserStorage()) return;
      if (event.key !== null && event.key !== appearanceStorageKey(owner)) return;
      setSelection({ owner, preferences: readAppearance(browserStorage(), owner), notice: '' });
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [owner]);

  const update = (patch) => {
    const next = normalizeAppearance({ ...preferences, ...patch });
    const saved = writeAppearance(browserStorage(), owner, next);
    setSelection({ owner, preferences: next, notice: saved ? 'Pilihan tampilan tersimpan di perangkat ini.' : 'Pilihan diterapkan, tetapi belum tersimpan. Penyimpanan di perangkat ini tidak tersedia; pilihan dapat hilang setelah halaman dimuat ulang.' });
  };
  return <AppearanceContext.Provider value={{ preferences, effectiveMode, update, reset: () => update(defaultAppearance), notice: selection.owner === owner ? selection.notice : '' }}>{children}</AppearanceContext.Provider>;
}
