import test from 'node:test';
import assert from 'node:assert/strict';
import { requestLogout } from './accountSession.js';

test('logout memakai sesi cookie dan hanya sukses saat API mengonfirmasi', async () => {
  let call;
  const ok = await requestLogout(async (...args) => { call = args; return { ok: true, json: async () => ({ ok: true }) }; });
  assert.equal(ok, true);
  assert.deepEqual(call, ['/api/auth/logout', { method: 'POST', credentials: 'include' }]);
});

test('HTTP gagal, balasan tidak sesuai, dan masalah jaringan tidak dianggap logout sukses', async () => {
  for (const response of [{ ok: false }, { ok: true, json: async () => ({ ok: false }) }, { ok: true, json: async () => { throw new Error('not json'); } }]) {
    assert.equal(await requestLogout(async () => response), false);
  }
  assert.equal(await requestLogout(async () => { throw new Error('offline'); }), false);
});
