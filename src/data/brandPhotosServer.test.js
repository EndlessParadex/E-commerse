import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../server/app.js';
import { initializeCatalog, saveMaster } from './adminStore.js';
import { brands } from './catalogMasters.js';

test('brand uploads wait for a capable server and reject a success response that loses the photo', async () => {
  const api = createApp({ dbPath: ':memory:' });
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i0AAAAASUVORK5CYII=';
  let legacy = true,
    losePhoto = false,
    writes = 0;
  const transport = async (_url, options = {}) => {
    const payload =
      options.method === 'PUT'
        ? (writes++, api.catalog.save(JSON.parse(options.body)))
        : api.catalog.snapshot();
    if (legacy) delete payload.capabilities.brandPhotos;
    if (losePhoto)
      payload.masters.brands.forEach((brand) => {
        delete brand.logo;
      });
    return new Response(JSON.stringify(payload));
  };
  try {
    await initializeCatalog(transport);
    const draft = { ...brands[0], logo: png };
    assert.match((await saveMaster('brands', draft)).storageError, /belum mendukung foto merek/);
    assert.equal(writes, 0);
    assert.equal(api.catalog.snapshot().revision, 0);
    legacy = false;
    await initializeCatalog(transport);
    losePhoto = true;
    assert.match(
      (await saveMaster('brands', draft)).storageError,
      /Foto merek belum dapat dikonfirmasi/,
    );
    assert.equal(brands.find((brand) => brand.id === draft.id).logo || '', '');
    losePhoto = false;
    await initializeCatalog(transport);
    assert.equal(brands.find((brand) => brand.id === draft.id).logo, png);
    assert.equal((await saveMaster('brands', { ...draft, logo: '' })).id, draft.id);
    assert.equal(
      api.catalog.snapshot().masters.brands.find((brand) => brand.id === draft.id).logo,
      '',
    );
  } finally {
    api.db.close();
  }
});
