import { trackingSteps } from '../../state/orderTrackingModel.js';
import './OrderTracking.css';

export default function OrderTracking({ status = 'processing' }) {
  const ended = status === 'cancelled' || status === 'expired';
  const steps = status === 'awaiting_payment' ? [{ id: 'awaiting_payment', label: 'Menunggu pembayaran', description: 'Metode pembayaran tercatat pada pesanan percobaan.', state: 'current' }, ...trackingSteps().map((step) => ({ ...step, state: 'pending' }))] : trackingSteps(status);
  const current = steps.find((step) => step.state === 'current');

  return <section className="order-tracking confirmation-card" aria-labelledby="order-tracking-title">
    <div className="order-tracking-heading">
      <h2 id="order-tracking-title">Status pesanan</h2>
      <span className="order-tracking-badge">Simulasi</span>
    </div>
    <p className="order-tracking-note">Pratinjau frontend, bukan informasi pengiriman nyata. Belum terhubung ke toko atau kurir.</p>
    <p className="order-tracking-summary" role="status"><strong>{ended ? status === 'expired' ? 'Kedaluwarsa' : 'Dibatalkan' : status === 'awaiting_payment' ? 'Menunggu pembayaran' : current.label}</strong> — {ended ? 'Pesanan tidak akan dilanjutkan. Stok simulasi telah dilepas.' : status === 'awaiting_payment' ? 'Metode pembayaran sudah dipilih. Belum ada dana yang diproses dalam simulasi ini.' : current.description}</p>
    {!ended && <ol className="order-tracking-steps" aria-label="Tahapan pesanan simulasi">
      {steps.map((step, index) => <li key={step.id} className={'order-tracking-step is-' + step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
        <span className="order-tracking-marker" aria-hidden="true">{step.state === 'done' ? '✓' : index + 1}</span>
        <div><strong>{step.label}</strong><span>{step.state === 'pending' ? 'Menunggu tahap sebelumnya.' : step.description}</span><small>{step.state === 'done' ? 'Tahap terlewati (simulasi)' : step.state === 'current' ? 'Status saat ini (simulasi)' : 'Belum berlangsung'}</small></div>
      </li>)}
    </ol>}
  </section>;
}
