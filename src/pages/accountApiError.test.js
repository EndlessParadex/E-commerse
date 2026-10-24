import test from 'node:test';
import assert from 'node:assert/strict';
import { accountApi } from '../components/account/accountApi.js';

test('account API shows useful status-specific errors while preserving backend detail', async () => {
  const previous = globalThis.fetch;
  try {
    for (const [status, expected] of [
      [401, /Sesi login/], [403, /tidak memiliki izin/],
      [404, /tidak ditemukan/], [409, /Data telah berubah/],
      [422, /Periksa isian/], [500, /kesalahan server/],
      [503, /sementara tidak tersedia/],
    ]) {
      globalThis.fetch = async () => ({
        ok: false, status, json: async () => ({ error: 'fixture_error' }),
      });
      await assert.rejects(() => accountApi('/api/b2b/accounts'), (error) => {
        assert.match(error.message, expected);
        assert.equal(error.status, status);
        assert.equal(error.code, 'fixture_error');
        return true;
      });
    }
    globalThis.fetch = async () => ({
      ok: false, status: 409,
      json: async () => ({ error: 'store_conflict', errors: { form: 'Pemilik toko sudah ditetapkan.' } }),
    });
    await assert.rejects(() => accountApi('/api/b2b/stores', { storeId: 'test' }), (error) => {
      assert.equal(error.message, 'Pemilik toko sudah ditetapkan.');
      assert.equal(error.status, 409);
      assert.equal(error.code, 'store_conflict');
      return true;
    });
    globalThis.fetch = async () => ({
      ok: false, status: 503, json: async () => { throw new SyntaxError('not JSON'); },
    });
    await assert.rejects(() => accountApi('/api/b2b/accounts'), /Layanan sementara tidak tersedia/);
    globalThis.fetch = async () => ({
      ok: true, status: 200, json: async () => ({ accounts: [] }),
    });
    assert.deepEqual(await accountApi('/api/b2b/accounts'), { accounts: [] });
  } finally {
    globalThis.fetch = previous;
  }
});
