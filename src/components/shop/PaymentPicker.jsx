import useCompany from '../../state/useCompany';
import { workflowUsesServer } from '../../data/adminStore';
import { PAYMENT_GROUPS, PAYMENT_METHODS, livePaymentMethods } from '../../state/paymentMethods';
import './PaymentPicker.css';

export default function PaymentPicker({ value, onChange, disabled = false }) {
  const company = useCompany();
  const available =
    workflowUsesServer && company.commerce?.codOnly ? PAYMENT_METHODS.filter((m) => m.id === 'cod') :
    workflowUsesServer && company.commerce?.version === 31
      ? livePaymentMethods(company.profile)
      : PAYMENT_METHODS.filter((m) => m.id !== 'manual-transfer');
  const selected = available.find((m) => m.id === value) || available[0];
  if (!selected)
    return <p role="status">Toko belum mengaktifkan metode pembayaran. Hubungi pengelola toko.</p>;
  const groups = PAYMENT_GROUPS.filter((g) => available.some((m) => m.groupId === g.id));
  const methods = available.filter((method) => method.groupId === selected.groupId);
  return (
    <div className="payment-picker">
      <div className="payment-group-options" role="group" aria-label="Jenis pembayaran">
        {groups.map((group) => (
          <button
            type="button"
            key={group.id}
            disabled={disabled}
            aria-pressed={selected.groupId === group.id}
            onClick={() => onChange(available.find((method) => method.groupId === group.id).id)}
          >
            <span className="payment-group-icon" aria-hidden="true">
              {group.icon}
            </span>
            <span>{group.label}</span>
          </button>
        ))}
      </div>
      <fieldset className="payment-channel-options" disabled={disabled}>
        <legend>{PAYMENT_GROUPS.find((group) => group.id === selected.groupId).label}</legend>
        {methods.map((method) => (
          <label
            className={'payment-channel' + (method.id === selected.id ? ' is-selected' : '')}
            key={method.id}
          >
            <input
              type="radio"
              name="payment-method"
              value={method.id}
              checked={method.id === selected.id}
              onChange={() => onChange(method.id)}
            />
            <span className={'payment-provider provider-' + method.id} aria-hidden="true">
              {method.provider}
            </span>
            <span>
              <strong>{method.label}</strong>
              <small>{method.description}</small>
            </span>
            <span className="payment-check" aria-hidden="true">
              {method.id === selected.id ? '✓' : ''}
            </span>
          </label>
        ))}
      </fieldset>
      <p className="payment-preview-note">
        {workflowUsesServer
          ? company.commerce?.codOnly ? 'Gratis ongkir. Bayar COD saat diterima.' : 'COD dibayar saat diterima. Transfer memakai rekening resmi toko setelah total akhir disetujui.'
          : 'Pembayaran percobaan. Tidak ada dana yang diproses.'}
      </p>
    </div>
  );
}
