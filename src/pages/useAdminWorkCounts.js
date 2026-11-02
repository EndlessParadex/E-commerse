import { useEffect, useState } from 'react';
import useWorkflow from '../state/useWorkflow';
import { serverStock } from '../state/serverWorkflow';
import { stockKey } from '../state/frontendWorkflow';
import { workflowUsesServer } from '../data/adminStore';
import { products } from '../data/products';
import { accountApi } from '../components/account/accountApi';

// Null means the value is not known yet; never present an unknown count as zero.
export function useStockCounts() {
  const inventory = useWorkflow('inventory');
  if (inventory.loading || inventory.failed || !inventory.server)
    return { inventory, counts: null };
  try {
    const rows = [...new Map(products.map((product) => [stockKey(product), product])).values()].map(
      (product) => serverStock(product),
    );
    return {
      inventory,
      counts: {
        available: rows.filter((row) => row.available !== null && row.available > 0).length,
        empty: rows.filter((row) => row.available === 0).length,
        unknown: rows.filter((row) => row.available === null).length,
        total: rows.length,
      },
    };
  } catch {
    return { inventory, counts: null };
  }
}

export default function useAdminWorkCounts(view) {
  const { orders } = useWorkflow('admin');
  const { counts: stock } = useStockCounts();
  const [work, setWork] = useState(null);
  useEffect(() => {
    if (!workflowUsesServer) return undefined;
    let active = true;
    accountApi('/api/admin/readiness')
      .then((value) => {
        if (active) setWork(value);
      })
      .catch(() => {
        if (active) setWork(null);
      });
    return () => {
      active = false;
    };
  }, [view, orders]);
  return {
    orders: work ? work.pendingOrders + work.processingOrders : null,
    proofs: work?.proofPending ?? null,
    approvals: work?.approvalsPending ?? null,
    stockEmpty: stock ? stock.empty : null,
  };
}
