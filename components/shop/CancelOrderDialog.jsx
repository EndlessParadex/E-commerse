import { useState } from 'react';
import { cancelOrder } from '../../state/orderModel';
import { useShop } from '../../state/useShop';
import ConfirmDialog from './ConfirmDialog';

export default function CancelOrderDialog({ order, onClose, onCancelled }) {
  const shop = useShop();
  const [reason, setReason] = useState('Berubah pikiran');
  const [error, setError] = useState('');
  const confirm = () => {
    const result = cancelOrder(order.id, reason, window.sessionStorage);
    if (result.error) { setError(result.error); return; }
    shop.dispatch({ type: 'orderCancelled', order: result.order });
    onCancelled(result.order);
    onClose();
  };
  return <ConfirmDialog title="Batalkan pesanan ini?" confirmLabel="Ya, batalkan pesanan" onConfirm={confirm} onClose={onClose} error={error}>
    <p>Pesanan akan ditandai dibatalkan dan tetap terlihat pada riwayat. Tidak ada dana yang diproses dalam simulasi ini.</p>
    <label>Alasan pembatalan<select value={reason} onChange={(event) => setReason(event.target.value)}><option>Berubah pikiran</option><option>Ingin mengganti produk atau ukuran</option><option>Ingin mengganti metode pembayaran</option><option>Alamat pengiriman perlu diubah</option><option>Alasan lainnya</option></select></label>
  </ConfirmDialog>;
}
