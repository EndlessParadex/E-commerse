import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from './products.js';
import { categories } from './catalog.js';
import { bannerProducts, bannerSlide, homeSlides, targetHref } from './homeBanners.js';
import { bannerErrors, bannerStatus } from './bannerAdmin.js';

const banner = (extra = {}) => ({
  id: 'b-1',
  active: true,
  startsOn: '',
  endsOn: '',
  label: '',
  title: 'Baris satu\nBaris dua',
  description: 'Deskripsi',
  cta: 'Lihat',
  target: { type: 'category', id: 'snack' },
  theme: 'beauty',
  media: 'products',
  productIds: [],
  image: '',
  imageAlt: '',
  ...extra,
});

test('banner tersimpan menjadi slide; tanpa banner tampil, beranda memakai banner otomatis', () => {
  const automatic = homeSlides(products, categories, { configured: false, banners: [] });
  assert.ok(automatic.length > 0);
  assert.ok(
    automatic.every((slide) => slide.theme === 'snack'),
    'automatic banners stay blue',
  );
  // Saved, but none showing today: still automatic.
  assert.deepEqual(
    homeSlides(products, categories, { configured: true, banners: [] }).map((s) => s.id),
    automatic.map((s) => s.id),
  );
  const slides = homeSlides(products, categories, { configured: true, banners: [banner()] });
  assert.equal(slides.length, 1);
  assert.equal(slides[0].theme, 'beauty');
  assert.equal(slides[0].href, '#/kategori/snack');
  // Without a small label, the banner names where its button leads.
  assert.equal(slides[0].category, 'Snack & Makanan');
});

test('produk banner: pilihan manual didahulukan, kosong berarti otomatis dari tujuan tombol', () => {
  const auto = bannerProducts(banner());
  assert.ok(auto.length > 0 && auto.length <= 2);
  assert.ok(auto.every((product) => product.categoryId === 'snack'));
  const chosen = products.find((product) => product.categoryId !== 'snack');
  assert.deepEqual(
    bannerProducts(banner({ productIds: [chosen.id, 'hilang'] })).map((p) => p.id),
    [chosen.id],
    'a deleted product is skipped',
  );
  // Picture banners show the picture, no product cards.
  const poster = bannerSlide(
    banner({ media: 'image', image: '/api/home/banners/photos/a.png', imageAlt: '' }),
  );
  assert.equal(poster.image, '/api/home/banners/photos/a.png');
  assert.equal(poster.imageAlt, 'Baris satu Baris dua');
  assert.deepEqual(poster.featured, []);
});

test('tujuan tombol: tautan yang hilang dari katalog jatuh ke seluruh katalog', () => {
  assert.equal(targetHref({ type: 'catalog', id: '' }), '#/cari?q=');
  assert.equal(targetHref({ type: 'category', id: 'tidak-ada' }), '#/cari?q=');
  assert.equal(targetHref({ type: 'product', id: products[0].id }), '#/produk/' + products[0].id);
  assert.equal(targetHref({ type: 'brand', id: 'tidak-ada' }), '#/cari?q=');
});

test('status dan pemeriksaan banner di halaman admin', () => {
  const today = '2026-12-02';
  assert.equal(bannerStatus(banner(), today).id, 'live');
  assert.equal(bannerStatus(banner({ active: false }), today).id, 'hidden');
  assert.equal(bannerStatus(banner({ startsOn: '2026-12-03' }), today).id, 'scheduled');
  assert.equal(bannerStatus(banner({ endsOn: '2026-12-01' }), today).id, 'ended');
  assert.equal(bannerStatus(banner({ endsOn: '2026-12-02' }), today).id, 'live');
  assert.deepEqual(bannerErrors(banner()), {});
  assert.deepEqual(
    Object.keys(
      bannerErrors(
        banner({
          title: 'a\nb\nc',
          cta: ' ',
          target: { type: 'brand', id: '' },
          media: 'image',
          startsOn: '2026-12-05',
          endsOn: '2026-12-01',
        }),
      ),
    ).sort(),
    ['cta', 'endsOn', 'image', 'target', 'title'],
  );
});
