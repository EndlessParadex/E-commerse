import { companyStorageKey } from '../data/companyStore.js';
export const appearanceModes = [
  { id: 'light', label: 'Terang', description: 'Tampilan cerah', icon: '☀' },
  { id: 'dark', label: 'Gelap', description: 'Tampilan redup', icon: '☾' },
  { id: 'system', label: 'Ikuti perangkat', description: 'Otomatis sesuai perangkat', icon: '◐' },
];
export const appearanceBackgrounds = [
  { id: 'default', label: 'Netral', light: '#f8fafc', dark: '#0e1726' },
  { id: 'sky', label: 'Biru lembut', light: '#f1f8ff', dark: '#0b1d2a' },
  { id: 'lavender', label: 'Lavender', light: '#f8f5ff', dark: '#1b152a' },
  { id: 'mint', label: 'Hijau lembut', light: '#f0faf5', dark: '#0f211d' },
];
export const appearanceTextSizes = [
  { id: 'normal', label: 'Normal', description: 'Ukuran standar', scale: 1 },
  { id: 'large', label: 'Besar', description: 'Lebih besar 15%', scale: 1.15 },
  { id: 'xlarge', label: 'Sangat besar', description: 'Lebih besar 30%', scale: 1.3 },
];
export const appearanceAccents = [
  { id: 'blue', label: 'Biru', light: '#0369a1', dark: '#7dd3fc' },
  { id: 'green', label: 'Hijau', light: '#047857', dark: '#6ee7b7' },
  { id: 'violet', label: 'Ungu', light: '#6d28d9', dark: '#c4b5fd' },
  { id: 'orange', label: 'Jingga', light: '#9a3412', dark: '#fdba74' },
];
export const defaultAppearance = Object.freeze({ mode: 'light', background: 'default', textSize: 'normal', accent: 'blue' });
export function normalizeAppearance(value) {
  return {
    mode: appearanceModes.some((mode) => mode.id === value?.mode) ? value.mode : defaultAppearance.mode,
    background: appearanceBackgrounds.some((background) => background.id === value?.background) ? value.background : defaultAppearance.background,
    textSize: appearanceTextSizes.some((size) => size.id === value?.textSize) ? value.textSize : defaultAppearance.textSize,
    accent: appearanceAccents.some((accent) => accent.id === value?.accent) ? value.accent : defaultAppearance.accent,
  };
}
export const appearanceOwner = (user) => user?.id != null ? `user:${user.id}` : 'guest';
export const appearanceStorageKey = (owner) => companyStorageKey(`bam.appearance.v1.${encodeURIComponent(owner)}`);
export function readAppearance(storage, owner) {
  try { return normalizeAppearance(JSON.parse(storage.getItem(appearanceStorageKey(owner)))); }
  catch { return { ...defaultAppearance }; }
}
export function writeAppearance(storage, owner, preferences) {
  try { storage.setItem(appearanceStorageKey(owner), JSON.stringify(normalizeAppearance(preferences))); return true; }
  catch { return false; }
}
export const resolveAppearanceMode = (mode, systemDark) => mode === 'dark' || (mode === 'system' && systemDark) ? 'dark' : 'light';
