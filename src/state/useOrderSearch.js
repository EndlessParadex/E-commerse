import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import useWorkflow from './useWorkflow';
import { searchServerOrders } from './serverWorkflow';
import { orderStatus } from './orderModel';

const activeStatuses = [
  'awaiting_payment',
  'awaiting_confirmation',
  'awaiting_review',
  'awaiting_acceptance',
  'processing',
  'shipped',
];

// Search results stay separate from the notification/order-detail cache.
export default function useOrderSearch(scope, query, status) {
  const workflow = useWorkflow(scope);
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [moreBusy, setMoreBusy] = useState(false);
  const [pageError, setPageError] = useState('');
  const requestId = useRef(0);
  const paging = useRef(false);
  const previousQuery = useRef(query.trim());
  const q = query.trim();
  const key = JSON.stringify([workflow.owner, scope, q, status, attempt]);
  const currentKey = useRef(key);
  const latestResult = useRef(null);
  useLayoutEffect(() => {
    latestResult.current = result;
  }, [result]);
  useLayoutEffect(() => {
    currentKey.current = key;
    return () => {
      currentKey.current = null;
    };
  }, [key]);
  const ready =
    workflow.server && workflow.owner && workflow.owner !== 'guest' && !workflow.loading;
  useEffect(() => {
    const id = ++requestId.current;
    let active = true;
    const delay = previousQuery.current === q ? 0 : 250;
    previousQuery.current = q;
    if (!ready) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPageError('');
      try {
        const previousCount =
          latestResult.current?.key === key ? latestResult.current.orders.length : 0;
        let data = await searchServerOrders({
          admin: scope === 'admin',
          q,
          status,
          signal: controller.signal,
        });
        while (data.nextCursor && data.orders.length < previousCount && active) {
          const next = await searchServerOrders({
            admin: scope === 'admin',
            q,
            status,
            before: data.nextCursor,
            signal: controller.signal,
          });
          data = { ...next, orders: [...data.orders, ...next.orders] };
        }
        if (active && id === requestId.current) setResult({ key, ...data });
      } catch (error) {
        if (active && id === requestId.current && !controller.signal.aborted)
          setResult({ key, orders: [], error: error.message });
      }
    }, delay);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [ready, key, q, status, scope, workflow.revision]);
  const current = result?.key === key ? result : null;
  const loadMore = async () => {
    if (!current?.nextCursor || paging.current) return;
    paging.current = true;
    setMoreBusy(true);
    setPageError('');
    const id = requestId.current;
    try {
      const data = await searchServerOrders({
        admin: scope === 'admin',
        q,
        status,
        before: current.nextCursor,
      });
      if (id === requestId.current && currentKey.current === key)
        setResult({
          key,
          ...data,
          orders: [
            ...new Map(
              [...current.orders, ...data.orders].map((order) => [order.id, order]),
            ).values(),
          ],
        });
    } catch (error) {
      if (id === requestId.current && currentKey.current === key) setPageError(error.message);
    } finally {
      paging.current = false;
      setMoreBusy(false);
    }
  };
  if (!workflow.server) {
    const orders = workflow.orders.filter(
      (order) =>
        (status === 'all' ||
          (status === 'active'
            ? activeStatuses.includes(orderStatus(order))
            : orderStatus(order) === status)) &&
        `${order.id} ${order.recipient} ${order.items.map((item) => `${item.name} ${item.id}`).join(' ')}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    );
    return { ...workflow, orders, total: orders.length };
  }
  return {
    ...workflow,
    orders: current?.orders || [],
    total: current?.total,
    loading: workflow.loading || (ready && !current),
    failed: Boolean(current?.error),
    error: current?.error || '',
    nextCursor: current?.nextCursor,
    loadMore,
    moreBusy,
    pageError: current ? pageError : '',
    retry: () => setAttempt((value) => value + 1),
  };
}
