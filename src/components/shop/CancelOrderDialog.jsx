import { useRef, useState } from 'react';
import { workflowUsesServer } from '../../data/adminStore';
import { changeServerOrder } from '../../state/serverWorkflow';
import useUnsavedChanges from '../../state/useUnsavedChanges';
import { cancelOrder } from '../../state/orderModel';
import { useShop } from '../../state/useShop';
import ConfirmDialog from './ConfirmDialog';

export default function CancelOrderDialog({ order, onClose, onCancelled }) {
  const shop = useShop();
  const [reason, setReason] = useState('Berubah pikiran');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useUnsavedChanges(false, undefined, busy);
  const confirm = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    const result = workflowUsesServer
      ? await changeServerOrder(order.id, 'cancel', { reason }, order.revision)
      : cancelOrder(order.id, reason, window.sessionStorage);
    pending.current = false;
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    shop.dispatch({ type: 'orderCancelled', order: result.order });
    onCancelled(result.order);
    onClose();
  };
  return (
    <ConfirmDialog
      busy={busy}
      title="Batalkan pesanan ini?"
      confirmLabel="Ya, batalkan pesanan"
      onConfirm={confirm}
      onClose={onClose}
      error={error}
    >
      <p>
        {workflowUsesServer
          ? 'Pesanan akan dibatalkan di server, tetap terlihat pada riwayat, dan stoknya dikembalikan.'
          : 'Pesanan akan ditandai dibatalkan dan tetap terlihat pada riwayat. Tidak ada dana yang diproses dalam simulasi ini.'}
      </p>
      <label>
        Alasan pembatalan
        <select disabled={busy} value={reason} onChange={(event) => setReason(event.target.value)}>
          <option>Berubah pikiran</option>
          <option>Ingin mengganti produk atau ukuran</option>
          <option>Ingin mengganti metode pembayaran</option>
          <option>Alamat pengiriman perlu diubah</option>
          <option>Alasan lainnya</option>
        </select>
      </label>
    </ConfirmDialog>
  );
}
