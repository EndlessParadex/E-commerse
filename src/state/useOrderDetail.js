import { useEffect, useState } from 'react';
import useWorkflow from './useWorkflow';
import { fetchServerOrder } from './serverWorkflow';
export default function useOrderDetail(id) {
  const workflow = useWorkflow();
  const [reply, setReply] = useState({ key: '', error: '' });
  const key = workflow.owner + ':' + id;
  const order = workflow.orders.find((entry) => entry.id === id) || workflow.details?.[id];
  useEffect(() => {
    if (!workflow.server || workflow.loading || workflow.owner === 'guest') return;
    let active = true;
    // Fetch detail independently of the newest 50 orders in the history list.
    const refresh = () => {
      if (document.hidden) return;
      return fetchServerOrder(id).then((result) => {
        if (active) setReply({ key, error: result.error || '' });
      });
    };
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [id, workflow.server, workflow.loading, workflow.owner, key]);
  return {
    ...workflow,
    order,
    detailError: reply.key === key ? reply.error : '',
    loading:
      workflow.loading ||
      (workflow.server && workflow.owner !== 'guest' && !order && reply.key !== key),
  };
}
