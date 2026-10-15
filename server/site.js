import { readFileSync, existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { packagingValues, packagingLabel } from '../src/data/productPackaging.js';
const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function publicProduct(catalog, company, id, publicUrl = '') {
  const snapshot = catalog.snapshot(),
    draft = snapshot.edits.find((row) => row.variants.some((v) => v.id === id));
  if (!draft) return null;
  const variant = draft.variants.find((v) => v.id === id),
    profile = company.snapshot().profile;
  const photos = variant.gallery ?? draft.gallery ?? [];
  const path = '/produk/' + encodeURIComponent(id),
    image = '/api/public/products/' + encodeURIComponent(id) + '/image';
  return {
    id,
    name:
      draft.baseName +
      ' ' +
      variant.sizeValue +
      variant.sizeUnit +
      (packagingValues(variant).packagingType === 'satuan' ? '' : ' · ' + packagingLabel(variant)),
    brand: draft.brand,
    description: draft.description || profile.description,
    price: Number(variant.price),
    company: profile.shortName,
    url: publicUrl ? new URL(path, publicUrl).href : path,
    image: publicUrl ? new URL(image, publicUrl).href : image,
    imageData: photos[0]?.src || (variant.gallery ? '' : draft.image) || '',
  };
}
export function productHtml(meta, template) {
  const title = meta.name + ' | ' + meta.company,
    description = meta.description.replace(/\s+/g, ' ').slice(0, 170),
    json = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: meta.name,
      description: meta.description,
      sku: meta.id,
      brand: { '@type': 'Brand', name: meta.brand },
      ...(meta.imageData ? { image: meta.image } : {}),
      offers: { '@type': 'Offer', priceCurrency: 'IDR', price: meta.price, url: meta.url },
    })
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026');
  const head =
    '<title>' +
    escape(title) +
    '</title><meta name="description" content="' +
    escape(description) +
    '"><link rel="canonical" href="' +
    escape(meta.url) +
    '"><meta property="og:type" content="product"><meta property="og:title" content="' +
    escape(title) +
    '"><meta property="og:description" content="' +
    escape(description) +
    '"><meta property="og:url" content="' +
    escape(meta.url) +
    '">' +
    (meta.imageData ? '<meta property="og:image" content="' + escape(meta.image) + '">' : '') +
    '<meta name="twitter:card" content="summary_large_image"><script type="application/ld+json">' +
    json +
    '</script>';
  const body =
    '<article><h1>' +
    escape(meta.name) +
    '</h1><p>' +
    escape(meta.brand) +
    '</p>' +
    (meta.imageData
      ? '<img src="' +
        escape(meta.image) +
        '" alt="' +
        escape(meta.name) +
        '" width="360" height="360">'
      : '') +
    '<p>' +
    escape(meta.description) +
    '</p><p>Rp ' +
    meta.price.toLocaleString('id-ID') +
    '</p><p>Ketersediaan, kemasan, dan ongkir diperiksa saat memesan.</p><a href="/#/produk/' +
    encodeURIComponent(meta.id) +
    '">Lihat pilihan dan pesan</a></article>';
  return template
    .replace(/<title>[\s\S]*?<\/title>|<meta\s+name="description"[^>]*>/gi, '')
    .replace('</head>', head + '</head>')
    .replace('<div id="root"></div>', '<div id="root">' + body + '</div>');
}
export function createSite(
  catalog,
  company,
  { publicUrl = '', indexHtml, dist = resolve('dist') } = {},
) {
  const template = () =>
    indexHtml
      ? indexHtml()
      : existsSync(resolve(dist, 'index.html'))
        ? readFileSync(resolve(dist, 'index.html'), 'utf8')
        : null;
  const send = (res, status, body, type = 'text/html; charset=utf-8', cache = 'no-cache') => {
    res.writeHead(status, {
      'content-type': type,
      'cache-control': cache,
      'x-content-type-options': 'nosniff',
    });
    res.end(body);
  };
  return {
    product: (id) => publicProduct(catalog, company, id, publicUrl),
    respond(req, res, path) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return false;
      if (path === '/robots.txt') {
        send(
          res,
          200,
          'User-agent: *\nAllow: /produk/\nAllow: /api/public/\nDisallow: /api/\n' +
            (publicUrl ? 'Sitemap: ' + new URL('/sitemap.xml', publicUrl).href + '\n' : ''),
          'text/plain; charset=utf-8',
        );
        return true;
      }
      if (path === '/sitemap.xml') {
        if (!publicUrl) {
          send(res, 503, 'Alamat publik website belum dikonfigurasi.', 'text/plain');
          return true;
        }
        const urls = [
          '/',
          ...catalog
            .snapshot()
            .edits.flatMap((p) => p.variants.map((v) => '/produk/' + encodeURIComponent(v.id))),
        ];
        send(
          res,
          200,
          '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
            urls
              .map((path) => '<url><loc>' + escape(new URL(path, publicUrl).href) + '</loc></url>')
              .join('') +
            '</urlset>',
          'application/xml; charset=utf-8',
        );
        return true;
      }
      if (path.startsWith('/assets/') || path === '/favicon.svg') {
        let target;
        try {
          target = resolve(dist, '.' + decodeURIComponent(path));
        } catch {
          return false;
        }
        if (!target.startsWith(resolve(dist) + sep) || !existsSync(target)) return false;
        const extension = target.split('.').pop(),
          types = {
            js: 'text/javascript',
            css: 'text/css',
            webp: 'image/webp',
            png: 'image/png',
            jpg: 'image/jpeg',
            svg: 'image/svg+xml',
            woff2: 'font/woff2',
          };
        if (!types[extension]) return false;
        send(
          res,
          200,
          req.method === 'HEAD' ? '' : readFileSync(target),
          types[extension],
          path.startsWith('/assets/')
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=3600',
        );
        return true;
      }
      const match = path.match(/^\/produk\/([^/]+)$/);
      if (match) {
        let id;
        try {
          id = decodeURIComponent(match[1]);
        } catch {
          return false;
        }
        const meta = publicProduct(catalog, company, id, publicUrl);
        if (!meta) {
          send(res, 404, '<h1>Produk tidak ditemukan</h1>');
          return true;
        }
        const html = template();
        send(
          res,
          html ? 200 : 503,
          html
            ? productHtml(meta, html)
            : '<h1>Website belum dibangun</h1><p>Pengelola perlu menjalankan build website.</p>',
        );
        return true;
      }
      if (path === '/') {
        const html = template();
        if (!html) {
          send(res, 503, '<h1>Website belum dibangun</h1>');
          return true;
        }
        const p = company.snapshot().profile;
        send(
          res,
          200,
          html
            .replace(
              /<title>.*?<\/title>/,
              '<title>' + escape(p.shortName) + ' · Katalog produk</title>',
            )
            .replace(
              '</head>',
              '<meta name="description" content="' + escape(p.description) + '"></head>',
            ),
        );
        return true;
      }
      return false;
    },
  };
}
