import { readFile } from 'node:fs/promises';
import { productHtml } from './server/site.js';
export function productPages() {
  return {
    name: 'bam-public-product-pages',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = new URL(req.url, 'http://local').pathname,
          match = path.match(/^\/produk\/([^/]+)$/);
        if (!match) return next();
        try {
          const response = await fetch(
            'http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/public/products/' + match[1],
            { signal: AbortSignal.timeout(5000) },
          );
          if (!response.ok) {
            res.statusCode = response.status;
            res.end('Produk belum dapat dibuka.');
            return;
          }
          const meta = await response.json(),
            template = await readFile(server.config.root + '/index.html', 'utf8'),
            html = await server.transformIndexHtml(req.url, productHtml(meta, template));
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(html);
        } catch {
          res.statusCode = 503;
          res.end('Katalog belum dapat dimuat. Periksa server lalu muat ulang halaman.');
        }
      });
    },
  };
}
