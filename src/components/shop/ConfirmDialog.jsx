import { useEffect, useId, useRef } from 'react';
import './ConfirmDialog.css';

export default function ConfirmDialog({ title, children, confirmLabel, onConfirm, onClose, error, busy = false, danger = true }) {
  const dialogRef = useRef(null);
  const id = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={dialogRef} className="bam-confirm-dialog" aria-labelledby={id} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="bam-dialog-content"><span className="section-eyebrow">Periksa pilihan Anda</span><h2 id={id}>{title}</h2>{children}
      {error && <p className="shop-warning" role="alert">{error}</p>}
      <div className="bam-dialog-actions"><button type="button" className="bam-button-secondary" disabled={busy} onClick={onClose} autoFocus>Kembali</button><button type="button" className={danger ? 'bam-button-danger' : 'shop-primary'} disabled={busy} onClick={onConfirm}>{busy ? 'Menyimpan…' : confirmLabel}</button></div>
    </div>
  </dialog>;
}
