import test from 'node:test';
import assert from 'node:assert/strict';
import { nextStoreDelivery, isStoreDeliveryDate } from '../data/b2bDeliverySchedule.js';

test('scheduled cart calendar allows only the configured weekly or biweekly dates', () => {
  const weekly = { weekday: 1, anchorDate: '2026-10-26', intervalWeeks: 1 };
  const fortnightly = { weekday: 1, anchorDate: '2026-10-26', intervalWeeks: 2 };
  assert.equal(nextStoreDelivery(weekly, '2026-10-27'), '2026-11-02');
  assert.equal(isStoreDeliveryDate(weekly, '2026-10-26'), true);
  assert.equal(isStoreDeliveryDate(weekly, '2026-11-02'), true);
  assert.equal(isStoreDeliveryDate(weekly, '2026-10-27'), false);
  assert.equal(isStoreDeliveryDate(fortnightly, '2026-11-02'), false);
  assert.equal(isStoreDeliveryDate(fortnightly, '2026-11-09'), true);
  assert.equal(isStoreDeliveryDate(fortnightly, '2026-10-19'), false);
  assert.equal(isStoreDeliveryDate(null, '2026-11-03'), true);
  assert.equal(isStoreDeliveryDate(null, '2026-02-31'), false);
});
