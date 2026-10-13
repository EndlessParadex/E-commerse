import { useEffect, useState } from 'react';
import useWorkflow from './useWorkflow';
import { fetchServerOrder } from './serverWorkflow';
export default function useOrderDetail(id) {
  const workflow = useWorkflow(); const [reply, setReply] = useState({ key: '', error: '' });
  const key = workflow.owner + ':' + id;
  const order = workflow.orders.find((entry) => entry.id === id) || workflow.details?.[id];
  useEffect(() => {
    if (!workflow.server || workflow.loading || workflow.owner === 'guest') return;
    let active = true;
    // Fetch detail independently of the newest 50 orders in the history list.
    fetchServerOrder(id).then((result) => { if (active) setReply({ key, error: result.error || '' }); });
    return () => { active = false; };
  }, [id, workflow.server, workflow.loading, workflow.owner, key]);
  return { ...workflow, order, detailError: reply.key === key ? reply.error : '', loading: workflow.loading || (workflow.server && workflow.owner !== 'guest' && !order && reply.key !== key) };
}
