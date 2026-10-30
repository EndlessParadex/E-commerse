import test from 'node:test';
import assert from 'node:assert/strict';
import {
  orderCardStages,
  orderPrimaryFilters,
  orderExtraFilters,
} from './orderListPresentation.js';

test('order list keeps every supported status accessible', () => {
  const ids = [...orderPrimaryFilters, ...orderExtraFilters].map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, [
    'all', 'active', 'processing', 'shipped', 'completed',
    'awaiting_acceptance', 'awaiting_payment', 'awaiting_confirmation',
    'awaiting_review', 'cancelled', 'expired',
  ]);
});

test('order cards only indicate milestones supported by the saved order status', () => {
  const processing = orderCardStages('processing');
  assert.deepEqual(processing.map((step) => step.state), ['done', 'current', 'pending', 'pending']);
  assert.deepEqual(orderCardStages('shipped').map((step) => step.state), [
    'done', 'done', 'current', 'pending',
  ]);
  assert.deepEqual(orderCardStages('completed').map((step) => step.state), [
    'done', 'done', 'done', 'current',
  ]);
  for (const status of [
    'awaiting_acceptance', 'awaiting_payment', 'awaiting_confirmation',
    'awaiting_review', 'cancelled', 'expired',
  ]) {
    assert.deepEqual(orderCardStages(status), [], status);
  }
});
