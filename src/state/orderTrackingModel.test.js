import test from 'node:test';
import assert from 'node:assert/strict';
import { trackingSteps } from './orderTrackingModel.js';

test('new orders start at processing with later stages pending', () => {
  assert.deepEqual(
    trackingSteps().map((step) => step.state),
    ['current', 'pending', 'pending'],
  );
});
test('shipped and completed previews have exactly one current stage', () => {
  assert.deepEqual(
    trackingSteps('shipped').map((step) => step.state),
    ['done', 'current', 'pending'],
  );
  assert.deepEqual(
    trackingSteps('completed').map((step) => step.state),
    ['done', 'done', 'current'],
  );
});
test('unknown status safely falls back to processing', () => {
  assert.equal(trackingSteps('unknown')[0].state, 'current');
});

test('stage descriptions name BAM, not "toko", as the one preparing the order', async () => {
  const { ORDER_STAGES } = await import('./orderTrackingModel.js');
  assert.ok(ORDER_STAGES.every((stage) => !/\btoko\b/i.test(stage.description)));
});
