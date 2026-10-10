import { useMemo, useSyncExternalStore } from 'react';
import { readOrders } from './orderModel.js';
import { subscribeWorkflow, workflowRevision } from './workflowEvents.js';

export default function useWorkflow() {
  const revision = useSyncExternalStore(subscribeWorkflow, workflowRevision, workflowRevision);
  return useMemo(() => {
    try { return { orders: readOrders(window.sessionStorage), failed: false, revision }; }
    catch { return { orders: [], failed: true, revision }; }
  }, [revision]);
}
