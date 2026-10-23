import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appearancePresets, defaultAdvancedAppearance, normalizeAdvancedAppearance,
  readAdvancedAppearance, writeAdvancedAppearance, advancedStorageKey,
  advancedCssVariables,
} from './appearanceAdvanced.js';

const contrast = (a, b) => {
  const luminance = (hex) => hex.slice(1).match(/../g)
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + .05) / (darker + .05);
};

test('advanced appearance: reject invalid HEX, CSS injection, overflow and unsupported modes', () => {
  assert.deepEqual(normalizeAdvancedAppearance(null), defaultAdvancedAppearance);
  assert.deepEqual(normalizeAdvancedAppearance({
    preset: '<script>', accentHex: 'red; color:blue', backgroundHex: '#00000g',
    font: 'Comic Sans; display:none', radius: 999, density: 'giant', motion: 'off',
  }), defaultAdvancedAppearance);
  assert.deepEqual(normalizeAdvancedAppearance({
    preset: 'forest', accentHex: '#AAbBcc', backgroundHex: '#123456',
    font: 'mono', radius: 0, density: 'compact', motion: false,
    privateEmail: 'not stored',
  }), {
    preset: 'forest', accentHex: '#aabbcc', backgroundHex: '#123456',
    font: 'mono', radius: 0, density: 'compact', motion: false,
  });
  assert.equal(appearancePresets.length, 6);
});

test('advanced appearance: isolated by account, malformed/blocked storage safely recovers', () => {
  const values = new Map();
  const storage = {
    setItem(key, value) { values.set(key, value); },
    getItem(key) { return values.get(key) ?? null; },
  };
  const first = 'user:first', second = 'user:second';
  const edited = { ...defaultAdvancedAppearance, accentHex: '#123abc', radius: 22 };
  assert.equal(writeAdvancedAppearance(storage, first, edited), true);
  assert.deepEqual(readAdvancedAppearance(storage, first), edited);
  assert.deepEqual(readAdvancedAppearance(storage, second), defaultAdvancedAppearance);
  assert.notEqual(advancedStorageKey(first), advancedStorageKey(second));
  assert.ok(!values.get(advancedStorageKey(first)).includes('privateEmail'));
  values.set(advancedStorageKey(second), '{invalid json');
  assert.deepEqual(readAdvancedAppearance(storage, second), defaultAdvancedAppearance);
  const blocked = { getItem() { throw Error('Denied'); }, setItem() { throw Error('Denied'); } };
  assert.deepEqual(readAdvancedAppearance(blocked, first), defaultAdvancedAppearance);
  assert.equal(writeAdvancedAppearance(blocked, first, edited), false);
});

test('advanced appearance: theme vars guard readability and never include unsafe strings', () => {
  for (const color of ['#ffffff', '#000000', '#ffdf33', '#9c18d9', '#199900', '#789dff']) {
    const value = { ...defaultAdvancedAppearance, accentHex: color, backgroundHex: color };
    for (const mode of ['light', 'dark']) {
      const vars = advancedCssVariables(value, mode);
      assert.ok(contrast(vars['--color-action'], '#ffffff') >= 4.5,
        `on-action text must remain readable: ${color}, ${mode}`);
      assert.ok(contrast(vars['--color-link'], mode === 'dark' ? '#172438' : '#ffffff') >= 4.5,
        `links must be readable: ${color}, ${mode}`);
      assert.match(vars['--color-background'], /^#[0-9a-f]{6}$/);
      assert.equal(vars['--bam-custom-radius'], '16px');
    }
  }
  const vars = advancedCssVariables({ ...defaultAdvancedAppearance, accentHex: 'url(javascript:1)' }, 'light');
  assert.equal(vars['--color-action'], undefined);
  assert.equal(vars['--color-background'], undefined);
});
