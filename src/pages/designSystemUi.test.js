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
  const rail = read('./StorefrontFeatureRail.css');
  const home = read('./Home.jsx');
  assert.match(home, /import '\.\/StorefrontFeatureRail\.css'/);
  assert.match(rail, /:root\[data-theme='dark'\] \.home-landing \.home-feature-rail/);
  assert.match(rail, /\.bam-promo-product-name\s*\{\s*color: var\(--color-text\)/);
  assert.match(rail, /\.bam-vertical-promo-detail h3 a\s*\{\s*color: var\(--color-text\)/);
  assert.match(rail, /\.bam-promo-footer\s*\{\s*background: #071b30bb/);
  assert.match(rail, /\.bam-vertical-promo-item:nth-child\(4n\+1\).*var\(--catalog-tint-sky\)/s);
  assert.doesNotMatch(storefront, /Promotional graphics stay decorative/);
});


test('account icons and calendar use semantic theme colors', () => {
  const account = read('../components/account/AccountMenu.css');
  const calendar = read('./AdminB2BStoresPage.css');
  assert.match(account, /var\(--color-success-pill\)/);
  assert.match(account, /var\(--catalog-tint-violet\)/);
  assert.match(calendar, /background: var\(--color-success-soft\)/);
  assert.match(calendar, /color: var\(--color-on-action\)/);
});

test('cart and checkout share the same product color palette', () => {
  const cart = read('../components/shop/ShopActions.css');
  const checkout = read('./CheckoutPage.css');
  for (const token of ['--catalog-tint-coral','--catalog-tint-lilac','--catalog-tint-amber',
    '--catalog-tint-rose','--catalog-tint-brown','--catalog-tint-mint','--catalog-tint-red','--catalog-tint-sand']) {
    assert.ok(cart.includes('var(' + token + ')'));
    assert.ok(checkout.includes('var(' + token + ')'));
  }
});


test('admin approval toolbar and global search share theme-aware controls', () => {
  const approval = read('./AdminApprovalsPage.jsx');
  const accounts = read('./AdminAccountsPage.css');
  const admin = read('./AdminPage.css');
  assert.match(approval, /accounts-filters--approvals/);
  assert.match(approval, /accounts-filter-search/);
  assert.match(approval, /accounts-approvals-refresh/);
  assert.match(accounts, /\.accounts-filters--approvals #approval-status/);
  assert.match(accounts, /\.accounts-filter-search:focus-within/);
  assert.match(accounts, /height: 48px/);
  assert.match(accounts, /@media \(max-width: 600px\)/);
  assert.match(admin, /\.admin-topbar-search \{[\s\S]*?background: var\(--color-surface\)/);
});


test('B2B account ownership selection is visible in creation and edit flows', () => {
  const ui = read('./AdminB2BStoresPage.jsx');
  const style = read('./AdminB2BStoresPage.css');
  assert.match(ui, /ownerUserId: newOwner\?\.id/);
  assert.match(ui, /BuyerAccountPicker/);
  assert.match(ui, /Tinjau perubahan pemilik/);
  assert.match(ui, /keepPreviousMember/);
  assert.match(style, /\.b2b-owner-overview/);
  assert.match(style, /\.b2b-owner-option:focus-visible/);
});
