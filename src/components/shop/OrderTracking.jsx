import { useState } from 'react';
import { ORDER_STAGES, trackingSteps } from '../../state/orderTrackingModel.js';
import './OrderTracking.css';

export default function OrderTracking() {
  const [status, setStatus] = useState('processing');
  const steps = trackingSteps(status);
  const current = steps.find((step) => step.state === 'current');

  return <section className="order-tracking confirmation-card" aria-labelledby="order-tracking-title">
    <div className="order-tracking-heading">
      <h2 id="order-tracking-title">Status pesanan</h2>
      <span className="order-tracking-badge">Simulasi</span>
    </div>
    <p className="order-tracking-note">Pratinjau frontend, bukan informasi pengiriman nyata. Belum terhubung ke toko atau kurir.</p>
    <p className="order-tracking-summary" role="status"><strong>{current.label}</strong> — {current.description}</p>
    <ol className="order-tracking-steps" aria-label="Tahapan pesanan simulasi">
      {steps.map((step, index) => <li key={step.id} className={'order-tracking-step is-' + step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
        <span className="order-tracking-marker" aria-hidden="true">{step.state === 'done' ? '✓' : index + 1}</span>
        <div><strong>{step.label}</strong><span>{step.state === 'pending' ? 'Menunggu tahap sebelumnya.' : step.description}</span><small>{step.state === 'done' ? 'Tahap terlewati (simulasi)' : step.state === 'current' ? 'Status saat ini (simulasi)' : 'Belum berlangsung'}</small></div>
      </li>)}
    </ol>
    <div className="order-tracking-preview">
      <label htmlFor="order-status-preview">Pratinjau status</label>
      <select id="order-status-preview" value={status} onChange={(event) => setStatus(event.target.value)}>
        {ORDER_STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
      </select>
      <p>Hanya mengubah tampilan. Pilihan akan kembali ke Diproses saat halaman dimuat ulang. Tidak mengirim WhatsApp atau notifikasi.</p>
    </div>
  </section>;
}
