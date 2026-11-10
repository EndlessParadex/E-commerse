import { test, expect } from '@playwright/test';

// Demo accounts created by tools/seed-pc-demo.mjs.
const PASSWORD = 'BAM-Demo@2026';
const ACCOUNTS = {
  pribadi: 'pribadi.pc-demo@bam.test',
  toko: 'toko.ice.pc-demo@bam.test',
  sales: 'sales.pc-demo@bam.test',
  admin: 'admin.pc-demo@bam.test',
};

// A signed-out visitor gets 401 from the session check; that is expected, not an error.
const expected = (text) => /status of 401/.test(text);

function watchErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !expected(message.text())) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push('pageerror: ' + error.message));
  return errors;
}

async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'halaman tidak boleh bergeser ke samping').toBeLessThanOrEqual(1);
}

// The button must receive the tap: nothing (a fixed bar, a nav) may cover its centre.
async function expectTappable(locator) {
  await locator.scrollIntoViewIfNeeded();
  const onTop = await locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return hit === element || element.contains(hit) ? 'ok' : hit?.outerHTML.slice(0, 120);
  });
  expect(onTop, 'tombol tertutup elemen lain').toBe('ok');
}

async function login(page, email) {
  await page.goto('/#/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('input[name="password"]').press('Enter');
  await expect(page).not.toHaveURL(/#\/login/);
}

test('tamu: beranda, katalog, dan produk tampil tanpa error', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCount(1);
  await expectNoHorizontalScroll(page);
  await page.goto('/#/kategori/snack');
  await expect(page.locator('.product-card').first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.locator('.product-card h3 a').first().click();
  await expect(page).toHaveURL(/#\/produk\//);
  await expect(page.locator('h1')).toBeVisible();
  await expectNoHorizontalScroll(page);
  // A visitor has no order history, so the empty search box shows plain suggestions.
  await page.getByRole('combobox', { name: 'Cari produk' }).click();
  await expect(page.locator('#search-suggestion-list')).toBeVisible();
  await expect(page.locator('.search-suggestion-heading')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('pembeli pribadi: tambah ke keranjang lalu buat pesanan COD', async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, ACCOUNTS.pribadi);
  await page.goto('/#/kategori/snack');
  await page.locator('.product-card h3 a').first().click();
  await page
    .getByRole('button', { name: /Tambah ke keranjang/ })
    .first()
    .click();
  await page.goto('/#/checkout');
  await expect(page.locator('#checkout-name')).not.toHaveValue('');
  const submit = page.locator('button.checkout-submit:visible');
  await expect(submit).toHaveCount(1);
  await expectTappable(submit);
  await submit.click();
  await expect(page.locator('main')).toContainText(/BAM-[0-9A-F]{8}/);
  await expectNoHorizontalScroll(page);

  // The empty search box now offers what was just ordered; typing returns to normal search.
  await page.goto('/');
  const search = page.getByRole('combobox', { name: 'Cari produk' });
  await search.click();
  await expect(page.locator('.search-suggestion-heading')).toHaveText('Pernah Anda pesan');
  const offered = page.getByRole('listbox', { name: 'Pernah Anda pesan' }).getByRole('option');
  await expect(offered.first()).toBeVisible();
  await search.press('ArrowDown');
  await search.press('Enter');
  await expect(page).toHaveURL(/#\/produk\//);
  await page.goto('/');
  await search.fill('a');
  await expect(page.locator('.search-suggestion-heading')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('pembeli toko: dasbor dan keranjang bersama tampil', async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, ACCOUNTS.toko);
  await page.goto('/');
  await expect(page.locator('.bam-buyer-cart-card')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.goto('/#/keranjang');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Keranjang bersama');
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('sales: Order Cepat terbuka', async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, ACCOUNTS.sales);
  await page.goto('/#/order-cepat');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('admin: daftar pesanan terbuka', async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, ACCOUNTS.admin);
  await page.goto('/#/admin/pesanan');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('akun baru: daftar, disetujui Admin, lalu diperingatkan soal email di keranjang', async ({
  page,
  browser,
}, testInfo) => {
  const errors = watchErrors(page);
  // Unique per run and per retry: the server rejects a repeated email or phone number.
  const stamp = String(Date.now()).slice(-9);
  const email = `baru.${testInfo.project.name}.${stamp}@bam.test`;
  const newPassword = 'Uji-Baru@2026';

  await page.goto('/#/daftar');
  const form = page.locator('main form');
  await form.locator('[name="name"]').fill('Pembeli Baru Uji');
  await form.locator('[name="phone"]').fill('0812' + stamp.slice(-8));
  await form.locator('[name="address"]').fill('Jl. Uji Coba No. 1, Tanjung Pandan');
  await form.locator('[name="email"]').fill(email);
  await form.locator('[name="password"]').fill(newPassword);
  await form.locator('[name="confirmPassword"]').fill(newPassword);
  await page.getByRole('button', { name: 'Daftar akun' }).click();
  await expect(page.locator('main')).toContainText('perlu persetujuan Admin');

  // Admin approves the registration in a separate browser session.
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await login(admin, ACCOUNTS.admin);
  await admin.goto('/#/admin/persetujuan');
  await admin
    .locator('li, tr, article', { hasText: email })
    .last()
    .getByRole('button', { name: 'Setujui' })
    .click();
  const dialog = admin.locator('dialog[open]');
  await dialog.locator('#approval-password').fill(PASSWORD);
  await dialog.getByRole('button', { name: 'Setujui akun' }).click();
  await expect(admin.locator('main')).toContainText('Akun disetujui');
  await adminContext.close();

  // The buyer can sign in and fill a cart, but must be told before checkout.
  await page.goto('/#/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(newPassword);
  await page.locator('input[name="password"]').press('Enter');
  await expect(page).not.toHaveURL(/#\/login/);
  await page.goto('/#/kategori/snack');
  await page.locator('.product-card h3 a').first().click();
  await page
    .getByRole('button', { name: /Tambah ke keranjang/ })
    .first()
    .click();
  await page.goto('/#/keranjang');
  const notice = page.locator('.cart-verify-notice');
  await expect(notice).toContainText('Email akun belum dikonfirmasi');
  await expectNoHorizontalScroll(page);
  await notice.getByRole('link', { name: 'Konfirmasi email' }).click();
  await expect(page).toHaveURL(/#\/akun\/keamanan/);
  // Phone and desktop both land on the screen that holds the confirmation control.
  await expect(page.locator('main')).toContainText('Email belum dikonfirmasi');
  await expect(page.getByRole('button', { name: 'Kirim tautan konfirmasi email' })).toBeVisible();
  expect(errors).toEqual([]);
});
