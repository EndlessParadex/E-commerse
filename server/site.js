import { publicEncoding, compressPublic } from './publicCompression.js';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { packagingValues, packagingLabel } from '../src/data/productPackaging.js';
const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const imagePath = (id) => '/api/public/products/' + encodeURIComponent(id) + '/image';
// The photo the public image route serves for one SKU: its own first photo, else the group's.
const variantImageData = (draft, variant) =>
  (variant.gallery ?? draft.gallery ?? [])[0]?.src || (variant.gallery ? '' : draft.image) || '';
export function publicProduct(catalog, company, id, publicUrl = '') {
  const snapshot = catalog.snapshot(),
    draft = snapshot.edits.find((row) => row.variants.some((v) => v.id === id));
  if (!draft) return null;
  const variant = draft.variants.find((v) => v.id === id),
    profile = company.snapshot().profile;
  const path = '/produk/' + encodeURIComponent(id),
    image = imagePath(id);
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
    imageData: variantImageData(draft, variant),
  };
}
const SERVABLE_IMAGE = /^data:image\/(?:png|jpeg|webp);base64,/;
/** Absolute URL of the first product photo the public image route can serve, or ''. */
export function homePreviewImage(catalog, publicUrl) {
  for (const draft of catalog.snapshot().edits)
    for (const variant of draft.variants)
      if (SERVABLE_IMAGE.test(variantImageData(draft, variant)))
        return new URL(imagePath(variant.id), publicUrl).href;
  return '';
}
// Icons shipped with the build. The install prompt needs 192 and 512 px PNGs; the maskable one
// keeps the mark inside the safe zone so Android can crop it to any shape.
const APP_ICONS = [
  { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];
const ROOT_FILES = new Set([
  '/favicon.svg',
  '/apple-touch-icon.png',
  ...APP_ICONS.map((icon) => icon.src),
]);
/** Web app manifest: lets a phone install the shop to its home screen under the company name. */
export function appManifest(profile) {
  return {
    name: profile.legalName || profile.shortName,
    short_name: profile.shortName,
    description: profile.description,
    lang: 'id',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0b2b51',
    icons: APP_ICONS,
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
    .replace(
      /<title>[\s\S]*?<\/title>|<meta\s+(?:name="description"|property="og:[a-z_]+")[^>]*>/gi,
      '',
    )
    .replace('</head>', head + '</head>')
    .replace('<div id="root"></div>', '<div id="root">' + body + '</div>');
}
export function createSite(
  catalog,
  company,
  { publicUrl = '', indexHtml, dist = resolve('dist') } = {},
) {
  const compressedAssets = new Map();
  const template = () =>
    indexHtml
      ? indexHtml()
      : existsSync(resolve(dist, 'index.html'))
        ? readFileSync(resolve(dist, 'index.html'), 'utf8')
        : null;
  const send = (req, res, status, body, type = 'text/html; charset=utf-8', cache = 'no-cache') => {
    const encoding = type.startsWith('text/html')
      ? publicEncoding(req.headers?.['accept-encoding'])
      : undefined;
    const bytes = compressPublic(body, encoding);
    res.writeHead(status, {
      ...(type.startsWith('text/html') ? { vary: 'Accept-Encoding' } : {}),
      ...(encoding ? { 'content-encoding': encoding } : {}),
      'content-length': bytes.length,
      'content-type': type,
      'cache-control': cache,
      'x-content-type-options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  };
  return {
    product: (id) => publicProduct(catalog, company, id, publicUrl),
    respond(req, res, path) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return false;
      if (path === '/robots.txt') {
        send(
          req,
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
          send(req, res, 503, 'Alamat publik website belum dikonfigurasi.', 'text/plain');
          return true;
        }
        const urls = [
          '/',
          ...catalog
            .snapshot()
            .edits.flatMap((p) => p.variants.map((v) => '/produk/' + encodeURIComponent(v.id))),
        ];
        send(
          req,
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
      if (path === '/manifest.webmanifest') {
        send(
          req,
          res,
          200,
          JSON.stringify(appManifest(company.snapshot().profile)),
          'application/manifest+json; charset=utf-8',
        );
        return true;
      }
      if (path.startsWith('/assets/') || ROOT_FILES.has(path)) {
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
        const compressible = ['js', 'css', 'svg'].includes(extension);
        // Public build assets only: never compress secrets or authenticated API responses.
        const encoding = compressible
          ? publicEncoding(req.headers?.['accept-encoding'])
          : undefined;
        let body;
        if (encoding) {
          const stat = statSync(target);
          const key = target + ':' + stat.mtimeMs + ':' + stat.size + ':' + encoding;
          body = compressedAssets.get(key);
          if (!body) {
            body = compressPublic(readFileSync(target), encoding);
            if (compressedAssets.size >= 32)
              compressedAssets.delete(compressedAssets.keys().next().value);
            compressedAssets.set(key, body);
          }
        } else body = readFileSync(target);
        res.writeHead(200, {
          'content-type': types[extension],
          'cache-control': path.startsWith('/assets/')
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=3600',
          'x-content-type-options': 'nosniff',
          'content-length': body.length,
          ...(compressible ? { vary: 'Accept-Encoding' } : {}),
          ...(encoding ? { 'content-encoding': encoding } : {}),
        });
        res.end(req.method === 'HEAD' ? undefined : body);
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
          send(req, res, 404, '<h1>Produk tidak ditemukan</h1>');
          return true;
        }
        const html = template();
        send(
          req,
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
          send(req, res, 503, '<h1>Website belum dibangun</h1>');
          return true;
        }
        const p = company.snapshot().profile;
        // Link previews need an absolute image URL, so the photo is only named when the public
        // address is configured. The first product with a servable photo stands for the shop.
        const preview = publicUrl ? homePreviewImage(catalog, publicUrl) : '';
        send(
          req,
          res,
          200,
          // The page title, description and link preview follow the company profile.
          html
            .replace(
              /<title>[\s\S]*?<\/title>|<meta\s+(?:name="(?:description|twitter:card)"|property="og:[a-z_:]+")[^>]*>/gi,
              '',
            )
            .replace(
              '</head>',
              '<title>' +
                escape(p.shortName) +
                ' · Katalog produk</title><meta name="description" content="' +
                escape(p.description) +
                '"><meta property="og:site_name" content="' +
                escape(p.shortName) +
                '"><meta property="og:title" content="' +
                escape(p.shortName) +
                ' · ' +
                escape(p.legalName || 'Katalog produk') +
                '"><meta property="og:description" content="' +
                escape(p.description) +
                '"><meta property="og:type" content="website">' +
                (publicUrl
                  ? '<meta property="og:url" content="' +
                    escape(new URL('/', publicUrl).href) +
                    '">'
                  : '') +
                (preview
                  ? '<meta property="og:image" content="' +
                    escape(preview) +
                    '"><meta name="twitter:card" content="summary_large_image">'
                  : '') +
                '</head>',
            ),
        );
        return true;
      }
      return false;
    },
  };
}
