import { useState } from 'react';
import { useShop } from '../../state/useShop';
import ConfirmDialog from './ConfirmDialog';

export default function CancelShoppingDialog({ checkout = false, onClose }) {
  const { clearCart } = useShop();
  const [emptyCart, setEmptyCart] = useState(false);
  return <ConfirmDialog title={checkout ? 'Batalkan checkout?' : 'Batalkan belanja?'} confirmLabel="Ya, batalkan" onClose={onClose} onConfirm={() => { if (emptyCart) clearCart(); onClose(); window.location.hash = '/'; }}>
    <p>Belum ada pesanan dibuat atau pembayaran diproses. Anda akan kembali ke beranda. Barang tetap tersimpan di keranjang agar bisa dibeli lagi nanti.</p>
    <label className="bam-cancel-choice"><input type="checkbox" checked={emptyCart} onChange={(event) => setEmptyCart(event.target.checked)} /><span>Kosongkan keranjang juga</span></label>
    {emptyCart && <p>Semua barang akan dikeluarkan dari keranjang.</p>}
  </ConfirmDialog>;
}
