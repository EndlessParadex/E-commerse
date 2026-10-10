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
export const defaultAppearance = Object.freeze({ mode: 'light', background: 'default' });
export function normalizeAppearance(value) {
  return {
    mode: appearanceModes.some((mode) => mode.id === value?.mode) ? value.mode : defaultAppearance.mode,
    background: appearanceBackgrounds.some((background) => background.id === value?.background) ? value.background : defaultAppearance.background,
  };
}
export const appearanceOwner = (user) => user?.id != null ? `user:${user.id}` : 'guest';
export const appearanceStorageKey = (owner) => `bam.appearance.v1.${encodeURIComponent(owner)}`;
export function readAppearance(storage, owner) {
  try { return normalizeAppearance(JSON.parse(storage.getItem(appearanceStorageKey(owner)))); }
  catch { return { ...defaultAppearance }; }
}
export function writeAppearance(storage, owner, preferences) {
  try { storage.setItem(appearanceStorageKey(owner), JSON.stringify(normalizeAppearance(preferences))); return true; }
  catch { return false; }
}
export const resolveAppearanceMode = (mode, systemDark) => mode === 'dark' || (mode === 'system' && systemDark) ? 'dark' : 'light';
