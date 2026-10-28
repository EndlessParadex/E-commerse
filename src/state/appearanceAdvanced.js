import { companyStorageKey } from '../data/companyStore.js';

export const appearancePresets = [
  { id: 'ocean', name: 'Ocean Blue', accent: '#1769e8', background: '#eef6ff', mode: 'light' },
  { id: 'sakura', name: 'Sakura Pink', accent: '#b82d67', background: '#fff0f5', mode: 'light' },
  { id: 'forest', name: 'Forest Green', accent: '#047857', background: '#eaf8ee', mode: 'light' },
  { id: 'lavender', name: 'Lavender', accent: '#6d28d9', background: '#f5f0ff', mode: 'light' },
  { id: 'sunset', name: 'Sunset Orange', accent: '#ad4016', background: '#fff5e8', mode: 'light' },
  { id: 'midnight', name: 'Midnight Dark', accent: '#789dff', background: '#151e32', mode: 'dark' },
];
export const defaultAdvancedAppearance = Object.freeze({
  preset: 'default',
  accentHex: '',
  backgroundHex: '',
  font: 'modern',
  radius: 16,
  density: 'comfortable',
  motion: true,
});
const validHex = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export const normalizeHex = (value) => (validHex(value) ? value.toLowerCase() : '');
export const normalizeAdvancedAppearance = (value) => ({
  preset: appearancePresets.some((preset) => preset.id === value?.preset)
    ? value.preset
    : 'default',
  accentHex: normalizeHex(value?.accentHex),
  backgroundHex: normalizeHex(value?.backgroundHex),
  font: ['modern', 'classic', 'mono'].includes(value?.font) ? value.font : 'modern',
  radius:
    Number.isInteger(value?.radius) && value.radius >= 0 && value.radius <= 28 ? value.radius : 16,
  density: ['compact', 'comfortable', 'spacious'].includes(value?.density)
    ? value.density
    : 'comfortable',
  motion: typeof value?.motion === 'boolean' ? value.motion : true,
});
export const advancedStorageKey = (owner) =>
  companyStorageKey(`bam.appearance.advanced.v1.${encodeURIComponent(owner)}`);
export function readAdvancedAppearance(storage, owner) {
  try {
    return normalizeAdvancedAppearance(JSON.parse(storage.getItem(advancedStorageKey(owner))));
  } catch {
    return { ...defaultAdvancedAppearance };
  }
}
export function writeAdvancedAppearance(storage, owner, value) {
  try {
    storage.setItem(advancedStorageKey(owner), JSON.stringify(normalizeAdvancedAppearance(value)));
    return true;
  } catch {
    return false;
  }
}
function rgb(value) {
  return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
}
function hex(rgbValues) {
  return (
    '#' +
    rgbValues
      .map((part) =>
        Math.max(0, Math.min(255, Math.round(part)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function mix(first, second, weight) {
  const a = rgb(first),
    b = rgb(second);
  return hex(a.map((component, index) => component * (1 - weight) + b[index] * weight));
}
function brightness(value) {
  return rgb(value)
    .map((n) => {
      const v = n / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}
function ratio(a, b) {
  const l = [brightness(a), brightness(b)].sort((x, y) => y - x);
  return (l[0] + 0.05) / (l[1] + 0.05);
}
function readableAccent(value) {
  let candidate = value;
  for (let i = 0; i < 30 && ratio(candidate, '#ffffff') < 4.5; i++)
    candidate = mix(candidate, '#000000', 0.12);
  return candidate;
}
function readableLink(value, background) {
  let candidate = value;
  const target = background === 'dark' ? '#ffffff' : '#000000';
  const surface = background === 'dark' ? '#172438' : '#ffffff';
  for (let i = 0; i < 30 && ratio(candidate, surface) < 4.5; i++)
    candidate = mix(candidate, target, 0.12);
  return candidate;
}
/** Scoped override variables; only CSS-safe validated HEX reaches style setters. */
export function advancedCssVariables(value, mode) {
  const state = normalizeAdvancedAppearance(value);
  const vars = {
    '--bam-custom-radius': state.radius + 'px',
    '--bam-density-gap': { compact: '10px', comfortable: '16px', spacious: '24px' }[state.density],
  };
  if (state.accentHex) {
    const strong = readableAccent(state.accentHex);
    const link = readableLink(state.accentHex, mode);
    Object.assign(vars, {
      '--color-action': strong,
      '--color-action-hover': mix(strong, '#000000', 0.15),
      '--color-link': link,
      '--color-link-bright': link,
      '--color-focus': link,
      '--color-info-text': link,
      '--color-info-soft':
        mode === 'dark'
          ? mix(state.accentHex, '#172438', 0.8)
          : mix(state.accentHex, '#ffffff', 0.91),
    });
  }
  if (state.backgroundHex) {
    vars['--color-background'] =
      mode === 'dark'
        ? mix(state.backgroundHex, '#0e1726', 0.85)
        : mix(state.backgroundHex, '#ffffff', 0.85);
    vars['--color-admin-background'] = vars['--color-background'];
  }
  return vars;
}
