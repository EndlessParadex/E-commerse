import { useContext, useMemo, useSyncExternalStore } from 'react';
import { readOrders } from './orderModel.js';
import { subscribeWorkflow, workflowRevision } from './workflowEvents.js';
import { subscribeServerWorkflow, serverWorkflowSnapshot } from './serverWorkflow';
import { workflowUsesServer } from '../data/adminStore';
import { DeliveryContext } from './useDelivery';

export default function useWorkflow(scope = 'own') {
  const revision = useSyncExternalStore(subscribeWorkflow, workflowRevision, workflowRevision);
  const snapshot = useSyncExternalStore(subscribeServerWorkflow, serverWorkflowSnapshot, serverWorkflowSnapshot);
  const delivery = useContext(DeliveryContext);
  return useMemo(() => {
    if (workflowUsesServer) {
      const matching = snapshot.owner === (delivery?.user?.id || 'guest');
      return { ...snapshot, orders: matching ? scope === 'admin' ? snapshot.adminOrders : snapshot.orders : [], details: matching ? snapshot.details : {}, server: true, loading: !matching || snapshot.loading || delivery?.authLoading, failed: matching && snapshot.failed, revision: snapshot, nextCursor: scope === 'admin' ? snapshot.adminCursor : snapshot.nextCursor };
    }
    try { return { orders: readOrders(window.sessionStorage), failed: false, revision }; }
    catch { return { orders: [], failed: true, revision }; }
  }, [revision, snapshot, delivery?.user?.id, delivery?.authLoading, scope]);
}
