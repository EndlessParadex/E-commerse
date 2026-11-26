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

test('tamu: beranda tanpa harga, isi toko meminta masuk/daftar, lalu kembali ke produk setelah masuk', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCount(1);
  await expectNoHorizontalScroll(page);
  // Installable on a phone: the page names a manifest the browser can load, with its icons.
  const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await page.request.get(manifestUrl)).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.short_name).toBeTruthy();
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).status()).toBe(200);

  // No prices for visitors: not on the page, and not from the API either.
  await expect(
    page.locator('.product-card').getByText('Masuk untuk lihat harga').first(),
  ).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/Rp\s?\d/);
  const catalog = await (await page.request.get('/api/catalog')).json();
  expect(catalog.pricesHidden).toBe(true);
  expect(catalog.edits.flatMap((draft) => draft.variants).every((v) => v.price === null)).toBe(
    true,
  );
  // The search box suggests products, without prices.
  await page.getByRole('combobox', { name: 'Cari produk' }).click();
  await expect(page.locator('#search-suggestion-list')).toBeVisible();
  await expect(page.locator('#search-suggestion-list')).not.toContainText(/Rp\s?\d/);
  await page.keyboard.press('Escape');

  // Anything past the home page asks to sign in; the prompt can be closed.
  await page.goto('/#/kategori/snack');
  const prompt = page.getByRole('dialog', { name: 'Masuk untuk melihat produk dan harga' });
  await expect(prompt).toBeVisible();
  await expectNoHorizontalScroll(page);
  await prompt.getByRole('button', { name: /Nanti saja/ }).click();
  await expect(prompt).toHaveCount(0);
  await expect(page).toHaveURL(/#\/$/);

  // A product from the home page: prompt, sign in, and land back on that product with prices.
  const product = page.locator('main a[href^="#/produk/"]:visible').first();
  const href = await product.getAttribute('href');
  await product.click();
  await expect(prompt).toBeVisible();
  await prompt.getByRole('link', { name: 'Masuk' }).click();
  await expect(page).toHaveURL(/#\/login$/);
  // "Daftar akun baru" sits right under the sign-in button.
  const signIn = page.locator('main form').getByRole('button', { name: 'Masuk' });
  const register = page.getByRole('link', { name: 'Daftar akun baru' });
  await expect(register).toBeVisible();
  expect((await register.boundingBox()).y).toBeGreaterThan((await signIn.boundingBox()).y);
  await expectTappable(register);
  await page.locator('input[name="email"]').fill(ACCOUNTS.pribadi);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('input[name="password"]').press('Enter');
  await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('main')).toContainText(/Rp\s?\d/);
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
  // The emptied cart reaches the account too, so the next test starts from an empty cart.
  await expect
    .poll(async () => (await (await page.request.get('/api/cart')).json()).cart.length)
    .toBe(0);
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

test('akun baru tanpa email: daftar, disetujui Admin, masuk dengan nomor HP, diarahkan ke konfirmasi WhatsApp', async ({
  page,
  browser,
}, testInfo) => {
  const errors = watchErrors(page);
  // Unique per run and per retry: the server rejects a repeated phone number.
  const stamp = String(Date.now()).slice(-9);
  const phone = '0812' + stamp.slice(-8);
  const name = `Pembeli Tanpa Email ${testInfo.project.name} ${stamp}`;
  const newPassword = 'Uji-Baru@2026';

  await page.goto('/#/daftar');
  const form = page.locator('main form');
  await expect(form.getByLabel('Email (opsional)')).toBeVisible();
  await form.locator('[name="name"]').fill(name);
  await form.locator('[name="phone"]').fill(phone);
  // Address: typed street, kelurahan/desa from the official Belitung list.
  await form.locator('[name="jalan"]').fill('Jl. Uji Coba No. 1');
  await form.getByLabel('Kecamatan').selectOption({ label: 'Manggar' });
  // Choosing a kecamatan narrows the list to its desa only.
  await expect(form.locator('[name="desa"] option')).toHaveCount(10);
  await form.locator('[name="desa"]').selectOption({ label: 'Baru (Desa)' });
  await expect(form.locator('.address-area-summary')).toContainText(
    'Jl. Uji Coba No. 1, Desa Baru, Kec. Manggar, Kab. Belitung Timur',
  );
  await expectNoHorizontalScroll(page);
  // A typo in the optional email is still caught; an empty one is accepted.
  await form.locator('[name="email"]').fill('bukan-email');
  await form.locator('[name="password"]').fill(newPassword);
  await form.locator('[name="confirmPassword"]').fill(newPassword);
  await page.getByRole('button', { name: 'Daftar akun' }).click();
  await expect(form.locator('#email-error')).toContainText('kosongkan');
  await form.locator('[name="email"]').fill('');
  await page.getByRole('button', { name: 'Daftar akun' }).click();
  await expect(page.locator('main')).toContainText('perlu persetujuan Admin');
  await expect(page.locator('main')).toContainText('konfirmasi nomor WhatsApp');

  // Admin approves the registration in a separate browser session.
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await login(admin, ACCOUNTS.admin);
  await admin.goto('/#/admin/persetujuan');
  const row = admin.locator('li, tr, article', { hasText: name }).last();
  await expect(row).toContainText('Tanpa email');
  await row.getByRole('button', { name: 'Setujui' }).click();
  const dialog = admin.locator('dialog[open]');
  await dialog.locator('#approval-password').fill(PASSWORD);
  await dialog.getByRole('button', { name: 'Setujui akun' }).click();
  await expect(admin.locator('main')).toContainText('Akun disetujui');
  await adminContext.close();

  // The buyer signs in with the phone number and is told to confirm WhatsApp before checkout.
  await page.goto('/#/login');
  await page.locator('input[name="email"]').fill(phone);
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
  await expect(notice).toContainText('Nomor WhatsApp atau email akun belum dikonfirmasi');
  await expectNoHorizontalScroll(page);
  await notice.getByRole('link', { name: 'Konfirmasi sekarang' }).click();
  await expect(page).toHaveURL(/#\/akun\/profil/);
  await expect(page.getByRole('region', { name: 'Konfirmasi nomor HP' })).toBeVisible();
  await page.goto('/#/akun/keamanan');
  await expect(page.locator('main')).toContainText('Tanpa email');
  await expect(page.getByRole('button', { name: 'Ubah kata sandi' })).toBeVisible();

  // Forgot password opens on WhatsApp.
  await page.goto('/#/forgot-password');
  await expect(page.getByRole('button', { name: 'WhatsApp', pressed: true })).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('admin: foto produk baru tersimpan ke database', async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, ACCOUNTS.admin);
  await page.goto('/#/admin/produk');
  await page
    .getByRole('button', { name: /^Edit / })
    .first()
    .click();
  const count = page.locator('.admin-photo-count');
  const before = Number((await count.innerText()).split('/')[0]);
  // A different picture on each run and retry, so the upload is always a new photo.
  const photo = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d');
    context.fillStyle = `hsl(${Math.floor(Math.random() * 360)} 70% 50%)`;
    context.fillRect(0, 0, 64, 64);
    context.fillStyle = '#fff';
    context.fillText(String(Date.now()), 2, 32);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Tambah foto produk').setInputFiles({
    name: 'uji.png',
    mimeType: 'image/png',
    buffer: Buffer.from(photo, 'base64'),
  });
  // One photo at a time opens the cropper; zoom in, then use it.
  const cropper = page.locator('dialog.photo-crop-dialog[open]');
  await expect(cropper).toBeVisible();
  await expect(count).toHaveText(new RegExp(`^${before}/`));
  await cropper.getByRole('slider', { name: 'Perbesar' }).fill('2');
  await cropper.getByRole('button', { name: 'Pakai foto' }).click();
  await expect(cropper).toHaveCount(0);
  await expect(count).toHaveText(new RegExp(`^${before + 1}/`));
  // An existing photo can be re-framed without adding a new one.
  await page.getByRole('button', { name: 'Atur posisi foto 1' }).click();
  await cropper.getByRole('button', { name: 'Pakai foto' }).click();
  await expect(cropper).toHaveCount(0);
  await expect(count).toHaveText(new RegExp(`^${before + 1}/`));
  await page.getByRole('button', { name: 'Simpan produk' }).click();
  // The server answers with photo URLs, not the uploaded data; the form must accept that.
  await expect(page.locator('main')).toContainText('Produk berhasil disimpan ke database');
  await expect(page.locator('.admin-form-alert')).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('admin: banner beranda bisa ditambah dengan gambar, tampil di beranda, disembunyikan, dan dihapus', async ({
  page,
}, testInfo) => {
  const errors = watchErrors(page);
  const label = `Promo uji ${testInfo.project.name} ${Date.now().toString(36)}`;
  await login(page, ACCOUNTS.admin);
  await page.goto('/#/admin/banner');
  await expect(page.getByRole('heading', { name: 'Banner beranda', level: 2 })).toBeVisible();
  const copy = page.getByRole('button', { name: 'Salin banner otomatis' });
  if (await copy.isVisible()) await copy.click();
  await page.getByRole('button', { name: '+ Tambah banner' }).click();

  await page.getByLabel('Label kecil (opsional)').fill(label);
  await page.getByLabel('Judul *').fill('Promo akhir tahun\nuntuk tokomu');
  await page.getByLabel('Teks tombol *').fill('Lihat promo');
  await page.getByLabel('Tombol menuju').selectOption('catalog');
  await page.getByText('Jingga').click();
  await page.getByText('Gambar / poster').click();
  // A picture is required for a picture banner.
  await page.getByRole('button', { name: 'Tambah banner' }).last().click();
  await expect(page.getByText('Unggah gambar banner.')).toBeVisible();
  const photo = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f97316';
    context.fillRect(0, 0, 300, 200);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Pilih gambar banner').setInputFiles({
    name: 'promo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(photo, 'base64'),
  });
  const cropper = page.locator('dialog.photo-crop-dialog[open]');
  await cropper.getByRole('button', { name: 'Pakai foto' }).click();
  await expect(cropper).toHaveCount(0);
  await expect(page.locator('.admin-banner-preview .bam-promo-poster img')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Tambah banner' }).last().click();
  await expect(page.getByText('Banner ditambahkan.')).toBeVisible();
  const row = page.locator('.admin-banner-row', { hasText: 'Promo akhir tahun' });
  await expect(row).toContainText('Tampil');

  // On the home page, among the banners.
  await page.goto('/#/');
  const dot = page.getByRole('button', { name: 'Tampilkan pilihan ' + label });
  await dot.click();
  await expect(page.locator('.bam-promo')).toHaveClass(/bam-promo--spice/);
  await expect(page.locator('.bam-promo-title')).toContainText('Promo akhir tahun');
  await expect(page.locator('.bam-promo-poster img')).toBeVisible();
  await expect(page.locator('.bam-promo-cta')).toHaveAttribute('href', '#/cari?q=');

  // Hidden: gone from the home page. Deleted: gone from the list.
  await page.goto('/#/admin/banner');
  await row.getByRole('button', { name: 'Sembunyikan' }).click();
  await expect(row).toContainText('Disembunyikan');
  await page.goto('/#/');
  await expect(page.locator('.bam-promo')).toBeVisible();
  await expect(dot).toHaveCount(0);
  await page.goto('/#/admin/banner');
  await row.getByRole('button', { name: 'Hapus' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Hapus banner' }).click();
  await expect(row).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('promo beli 2 gratis 1: Admin membuat promo, pembeli menerima barang gratis tanpa bayar', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await login(page, ACCOUNTS.admin);
  await page.goto('/#/admin/promo');
  await expect(page.getByRole('heading', { name: 'Promo beli gratis', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: '+ Tambah promo' }).click();
  await page.getByRole('button', { name: 'Simpan promo' }).click();
  await expect(page.getByText('Pilih SKU produk.')).toBeVisible();
  await page.getByLabel('SKU produk *').selectOption('snack-pedas');
  await expect(page.locator('.admin-promo-example')).toContainText('bayar 2');
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Simpan promo' }).click();
  await expect(page.getByText('Promo ditambahkan.')).toBeVisible();
  const row = page.locator('.admin-banner-row', { hasText: 'Beli 2 gratis 1' });
  await expect(row).toContainText('Berjalan');
  await page.context().clearCookies();

  await login(page, ACCOUNTS.pribadi);
  await page.goto('/#/produk/snack-pedas');
  await expect(page.locator('.detail-promotion')).toContainText('Bayar 2');
  await page
    .getByRole('button', { name: /Tambah ke keranjang/ })
    .first()
    .click();
  await page.goto('/#/keranjang');
  const promo = page.locator('.cart-promotion').first();
  await expect(promo).toContainText('Beli 2 gratis 1');
  // The nudge adds the one missing package; the free one appears as its own line.
  await promo.getByRole('button', { name: '+ Tambah 1' }).click();
  await expect(promo.locator('.cart-free-line')).toContainText('Gratis · 1');
  await expectNoHorizontalScroll(page);
  await page.goto('/#/checkout');
  await expect(page.locator('main')).toContainText('Barang gratis promo');
  await page.locator('button.checkout-submit:visible').click();
  await expect(page.locator('main')).toContainText(/BAM-[0-9A-F]{8}/);
  await expect(page.locator('.order-item-free').first()).toContainText('+ 1 gratis');
  await page.context().clearCookies();

  // The report counts the free unit; deleting the promotion leaves the order as it was.
  await login(page, ACCOUNTS.admin);
  await page.goto('/#/admin/promo');
  await expect(row).toContainText(/Sudah diberikan: [1-9]\d* \S+ di [1-9]/);
  await row.getByRole('button', { name: 'Hapus' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Hapus promo' }).click();
  await expect(row).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('foto profil: geser dan perbesar sebelum disimpan, hasilnya persegi sesuai pilihan', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await login(page, ACCOUNTS.pribadi);
  await page.goto('/#/akun/profil');
  // 400 × 200: left half red, right half blue. Centred "cover" shows half of each.
  const picture = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ff0000';
    context.fillRect(0, 0, 200, 200);
    context.fillStyle = '#0000ff';
    context.fillRect(200, 0, 200, 200);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#account-photo').setInputFiles({
    name: 'profil.png',
    mimeType: 'image/png',
    buffer: Buffer.from(picture, 'base64'),
  });
  const cropper = page.locator('dialog.photo-crop-dialog[open]');
  await expect(cropper).toBeVisible();
  await expectNoHorizontalScroll(page);
  const frame = cropper.locator('.photo-crop-frame');
  await expect(frame.locator('img')).toBeVisible();
  const zoom = cropper.getByRole('slider', { name: 'Perbesar' });
  await zoom.fill('1.5');
  await expect(zoom).toHaveValue('1.5');
  // Drag far to the right: the left (red) part of the photo moves into the frame.
  const box = await frame.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await cropper.getByRole('button', { name: 'Pakai foto' }).click();
  await expect(cropper).toHaveCount(0);
  await expect(page.locator('main')).toContainText('Foto profil berhasil disimpan');
  const saved = page.locator('.account-avatar-large img');
  await expect(saved).toBeVisible();
  const result = await saved.evaluate(async (image) => {
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const corner = context.getImageData(canvas.width - 4, canvas.height / 2, 1, 1).data;
    return { width: image.naturalWidth, height: image.naturalHeight, corner: [...corner] };
  });
  expect(result.width).toBe(result.height);
  // Even the right edge of the saved square is red: the blue half was moved out.
  expect(result.corner[0]).toBeGreaterThan(200);
  expect(result.corner[2]).toBeLessThan(60);
  expect(errors).toEqual([]);
});

test('tampilan: pemilih warna tetap terbuka selama warna digeser', async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, ACCOUNTS.pribadi);
  await page.goto('/#/akun/tampilan');
  await page.locator('.appearance-studio-tabs button').last().click();
  const picker = page.getByLabel('Pilih warna aksen');
  await expect(picker).toBeVisible();
  // Each step is an input event, like dragging inside the browser's colour picker.
  const handle = await picker.elementHandle();
  for (const hex of ['#6f73fb', '#5a5ff0', '#4b50e6']) await picker.fill(hex);
  expect(await handle.evaluate((element) => element.isConnected)).toBe(true);
  await expect(page.getByLabel('Warna aksen (HEX)')).toHaveValue('#4b50e6');
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});
