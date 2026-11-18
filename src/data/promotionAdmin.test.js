import test from 'node:test';
import assert from 'node:assert/strict';
import { promotionErrors, promotionExample, promotionStatus } from './promotionAdmin.js';

const draft = (extra = {}) => ({
  id: 'p-1',
  variantId: 'snack-pedas',
  buy: 2,
  free: 1,
  maxFree: 0,
  startsOn: '',
  endsOn: '',
  active: true,
  note: '',
  ...extra,
});

test('promo form: required numbers, dates, and one running promo per SKU', () => {
  assert.deepEqual(promotionErrors(draft()), {});
  assert.match(promotionErrors(draft({ variantId: '' })).variantId, /Pilih SKU/);
  assert.ok(promotionErrors(draft({ buy: NaN })).buy);
  assert.ok(promotionErrors(draft({ free: 0 })).free);
  assert.ok(promotionErrors(draft({ maxFree: -1 })).maxFree);
  assert.ok(promotionErrors(draft({ startsOn: '2026-12-10', endsOn: '2026-12-01' })).endsOn);
  const other = draft({ id: 'p-2', endsOn: '2026-12-31' });
  assert.match(
    promotionErrors(draft({ startsOn: '2026-12-31' }), [other]).variantId,
    /tanggal yang sama/,
  );
  assert.deepEqual(promotionErrors(draft({ startsOn: '2027-01-01' }), [other]), {});
  assert.deepEqual(promotionErrors(draft({ active: false }), [other]), {});
  assert.deepEqual(promotionErrors(draft({ id: 'p-2' }), [other]), {}, 'editing itself');
});

test('promo status and example text', () => {
  const today = '2026-12-02';
  assert.equal(promotionStatus(draft({ active: false }), today).id, 'hidden');
  assert.equal(promotionStatus(draft({ startsOn: '2026-12-03' }), today).id, 'scheduled');
  assert.equal(promotionStatus(draft({ endsOn: '2026-12-01' }), today).id, 'ended');
  assert.equal(promotionStatus(draft({ endsOn: '2026-12-02' }), today).id, 'live');
  assert.equal(
    promotionExample(draft(), 'dus'),
    'Beli 2 gratis 1: pembeli bayar 2 dus, terima 3 dus.',
  );
});
