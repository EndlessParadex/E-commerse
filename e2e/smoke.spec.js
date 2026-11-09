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
