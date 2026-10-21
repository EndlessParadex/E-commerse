import test from 'node:test';
import assert from 'node:assert/strict';
import { nextStoreDelivery } from './b2bDeliverySchedule.js';

test('BAM weekly delivery respects the fixed weekday and anchor', () => {
  const schedule = { weekday: 1, intervalWeeks: 1, anchorDate: '2026-10-26' };
  assert.equal(nextStoreDelivery(schedule, '2026-10-21'), '2026-10-26');
  assert.equal(nextStoreDelivery(schedule, '2026-10-26'), '2026-10-26');
  assert.equal(nextStoreDelivery(schedule, '2026-10-27'), '2026-11-02');
});

test('BAM fortnightly delivery preserves the correct alternating week', () => {
  const schedule = { weekday: 1, intervalWeeks: 2, anchorDate: '2026-10-26' };
  assert.equal(nextStoreDelivery(schedule, '2026-10-27'), '2026-11-09');
  assert.equal(nextStoreDelivery(schedule, '2026-11-09'), '2026-11-09');
  assert.equal(nextStoreDelivery(schedule, '2026-11-10'), '2026-11-23');
  assert.equal(nextStoreDelivery(null, '2026-10-21'), null);
  assert.equal(nextStoreDelivery(schedule, 'not-a-date'), null);
});
