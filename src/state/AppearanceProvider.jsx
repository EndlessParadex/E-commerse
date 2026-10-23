import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useDelivery } from './useDelivery';
import { AppearanceContext } from './useAppearance';
import {
  appearanceOwner,
  appearanceStorageKey,
  defaultAppearance,
  normalizeAppearance,
  readAppearance,
  resolveAppearanceMode,
  writeAppearance,
} from './appearanceModel';
import '../styles/themes.css';
import '../styles/preferences.css';
import {
  advancedCssVariables, defaultAdvancedAppearance, advancedStorageKey,
  normalizeAdvancedAppearance, readAdvancedAppearance, writeAdvancedAppearance,
} from './appearanceAdvanced.js';
import '../styles/advancedAppearance.css';

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
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
  const storedAdvanced = useMemo(() => readAdvancedAppearance(browserStorage(), owner), [owner]);
  const [selection, setSelection] = useState(() => ({ owner, preferences: stored, notice: '' }));
  const [advancedSelection, setAdvancedSelection] = useState(() =>
    ({ owner, preferences: storedAdvanced, notice: '' }));
  const systemDark = useSyncExternalStore(subscribeSystem, systemSnapshot, () => false);
  const preferences = selection.owner === owner ? selection.preferences : stored;
  const advanced = advancedSelection.owner === owner
    ? advancedSelection.preferences : storedAdvanced;
  const effectiveMode = resolveAppearanceMode(preferences.mode, systemDark);

  useEffect(() => {
    // Reset feedback when the account changes; render already uses that account's preferences.
    // oxlint-disable-next-line react/set-state-in-effect
    setSelection({ owner, preferences: stored, notice: '' });
    // oxlint-disable-next-line react/set-state-in-effect
    setAdvancedSelection({ owner, preferences: storedAdvanced, notice: '' });
  }, [owner, stored, storedAdvanced]);

  useLayoutEffect(() => {
    const page = document.documentElement;
    const attributes = {
      'data-theme': effectiveMode,
      'data-background': preferences.background,
      'data-text-size': preferences.textSize,
      'data-accent': preferences.accent,
    };
    const previous = Object.fromEntries(
      Object.keys(attributes).map((name) => [name, page.getAttribute(name)]),
    );
    for (const [name, value] of Object.entries(attributes)) page.setAttribute(name, value);
    return () => {
      for (const [name, value] of Object.entries(previous)) {
        if (value === null) page.removeAttribute(name);
        else page.setAttribute(name, value);
      }
    };
  }, [effectiveMode, preferences.background, preferences.textSize, preferences.accent]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const attrs = {
      'data-appearance-font': advanced.font,
      'data-appearance-density': advanced.density,
      'data-appearance-motion': advanced.motion ? 'on' : 'off',
    };
    const vars = advancedCssVariables(advanced, effectiveMode);
    const oldAttributes = Object.fromEntries(
      Object.keys(attrs).map((key) => [key, root.getAttribute(key)]));
    const oldStyles = Object.fromEntries(
      Object.keys(vars).map((key) => [key, root.style.getPropertyValue(key)]));
    for (const [key, value] of Object.entries(attrs)) root.setAttribute(key, value);
    for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
    return () => {
      for (const [key, value] of Object.entries(oldAttributes)) {
        if (value === null) root.removeAttribute(key);
        else root.setAttribute(key, value);
      }
      for (const [key, value] of Object.entries(oldStyles)) {
        if (value) root.style.setProperty(key, value);
        else root.style.removeProperty(key);
      }
    };
  }, [advanced, effectiveMode]);

  useEffect(() => {
    const sync = (event) => {
      if (event.storageArea && event.storageArea !== browserStorage()) return;
      if (event.key !== null &&
          event.key !== appearanceStorageKey(owner) &&
          event.key !== advancedStorageKey(owner)) return;
      if (event.key === null || event.key === appearanceStorageKey(owner))
        setSelection({ owner, preferences: readAppearance(browserStorage(), owner), notice: '' });
      if (event.key === null || event.key === advancedStorageKey(owner))
        setAdvancedSelection({
          owner, preferences: readAdvancedAppearance(browserStorage(), owner), notice: '',
        });
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [owner]);

  const update = (patch) => {
    const next = normalizeAppearance({ ...preferences, ...patch });
    const saved = writeAppearance(browserStorage(), owner, next);
    setSelection({
      owner,
      preferences: next,
      notice: saved
        ? 'Pilihan tampilan tersimpan di perangkat ini.'
        : 'Pilihan diterapkan, tetapi belum tersimpan. Penyimpanan di perangkat ini tidak tersedia; pilihan dapat hilang setelah halaman dimuat ulang.',
    });
  };
  const updateAdvanced = (patch) => {
    const next = normalizeAdvancedAppearance({ ...advanced, ...patch });
    const saved = writeAdvancedAppearance(browserStorage(), owner, next);
    setAdvancedSelection({
      owner, preferences: next,
      notice: saved
        ? 'Tema dan pengaturan lanjutan tersimpan di perangkat ini.'
        : 'Tema diterapkan, tetapi penyimpanan browser tidak tersedia.',
    });
  };
  return (
    <AppearanceContext.Provider
      value={{
        preferences,
        effectiveMode,
        update,
        advanced,
        updateAdvanced,
        resetAdvanced: () => updateAdvanced(defaultAdvancedAppearance),
        reset: () => {
          update(defaultAppearance);
          updateAdvanced(defaultAdvancedAppearance);
        },
        notice: advancedSelection.owner === owner && advancedSelection.notice
          ? advancedSelection.notice
          : selection.owner === owner ? selection.notice : '',
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}
