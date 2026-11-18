import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApp } from '../../server/app.js';
import { initializeCatalog, pricesHidden, saveMaster } from './adminStore.js';
import { products } from './products.js';
import { brands } from './catalogMasters.js';

// The visitor's view of /api/catalog, through the real server handler (no session cookie).
async function visitorCatalog(api) {
  const req = Readable.from([]);
  Object.assign(req, {
    method: 'GET',
    url: '/api/catalog',
    headers: { host: 'bam.test' },
    socket: { remoteAddress: '192.0.2.5' },
  });
  let body;
  await api.handler(req, { writeHead() {}, end: (value) => (body = String(value)) });
  return JSON.parse(body);
}

test('a catalog without prices loads for visitors, shows no price, and can never be saved back', async () => {
  const api = createApp({ dbPath: ':memory:', mailer: { enabled: false }, logger: () => {} });
  let writes = 0;
  let hidden = true;
  const transport = async (_url, options = {}) => {
    if (options.method === 'PUT') {
      writes++;
      return new Response(JSON.stringify(api.catalog.save(JSON.parse(options.body))));
    }
    return new Response(
      JSON.stringify(hidden ? await visitorCatalog(api) : api.catalog.publicSnapshot()),
    );
  };
  try {
    await initializeCatalog(transport);
    assert.equal(pricesHidden(), true);
    assert.ok(products.length > 0, 'names and photos still load');
    assert.ok(products.every((product) => product.price === null));
    // Saving now would erase every price: refused before anything is sent.
    const refused = await saveMaster('brands', { ...brands[0], name: brands[0].name + ' X' });
    assert.match(refused.storageError, /Harga katalog belum dimuat/);
    assert.equal(writes, 0);

    // After signing in the catalog is reloaded with prices, and saving works again.
    hidden = false;
    await initializeCatalog(transport);
    assert.equal(pricesHidden(), false);
    assert.ok(products.every((product) => product.price > 0));
    assert.equal((await saveMaster('brands', brands[0])).storageError, undefined);
    assert.equal(writes, 1);
  } finally {
    api.db.close();
  }
});
