import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('buyer, sales and admin load the same semantic control tokens', () => {
  const provider = read('../state/AppearanceProvider.jsx');
  const foundation = read('../styles/uiConsistency.css');
  assert.match(provider, /import '\.\.\/styles\/uiConsistency\.css'/);
  assert.match(foundation, /--bam-ui-radius-control:/);
  assert.match(foundation, /--bam-ui-radius-card:/);
  assert.match(foundation, /data-appearance-corners='custom'/);
  assert.match(foundation, /var\(--color-focus\)/);
});

test('admin does not force a light theme or override user accent', () => {
  const admin = read('./AdminDesign2.css');
  assert.doesNotMatch(admin, /color-scheme: light/);
  assert.doesNotMatch(admin, /--color-action:\s*#[a-f0-9]+/i);
  assert.match(admin, /background: var\(--color-admin-background\)/);
  assert.match(admin, /background: var\(--color-action\)/);
});

test('catalog sort uses a shared themed popover', () => {
  const home = read('./Home.jsx');
  const dropdown = read('../components/shop/CatalogSearchDropdown.css');
  assert.match(home, /label="Urutkan"/);
  assert.match(home, /searchable=\{false\}/);
  assert.match(dropdown, /var\(--bam-ui-shadow-popover\)/);
  assert.match(dropdown, /aria-pressed='true'/);
});

test('storefront has dark-mode readable promo surfaces', () => {
  const storefront = read('./StorefrontDesign2.css');
  assert.match(storefront, /:root\[data-theme='dark'\]/);
  assert.match(storefront, /background: linear-gradient\(120deg, var\(--color-surface-soft\)/);
});
