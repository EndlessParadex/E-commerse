import test from 'node:test';
import assert from 'node:assert/strict';
import { waitingLabel } from './approvalWaiting.js';

test('lama menunggu persetujuan ditulis singkat dan ditandai setelah satu hari', () => {
  const now = Date.parse('2026-11-26T10:00:00Z');
  assert.deepEqual(waitingLabel('2026-11-26T09:59:40Z', now), {
    text: 'Baru saja daftar',
    late: false,
  });
  assert.deepEqual(waitingLabel('2026-11-26T09:35:00Z', now), {
    text: 'Menunggu 25 menit',
    late: false,
  });
  assert.deepEqual(waitingLabel('2026-11-26T03:00:00Z', now), {
    text: 'Menunggu 7 jam',
    late: false,
  });
  assert.deepEqual(waitingLabel('2026-11-24T09:00:00Z', now), {
    text: 'Menunggu 2 hari',
    late: true,
  });
  assert.equal(waitingLabel('bukan tanggal', now), null);
});
