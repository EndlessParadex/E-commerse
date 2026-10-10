import { PAYMENT_GROUPS, PAYMENT_METHODS, paymentMethod } from '../../state/paymentMethods';
import './PaymentPicker.css';

export default function PaymentPicker({ value, onChange, disabled = false }) {
  const selected = paymentMethod(value) || PAYMENT_METHODS[0];
  const methods = PAYMENT_METHODS.filter((method) => method.groupId === selected.groupId);
  return <div className="payment-picker">
    <div className="payment-group-options" role="group" aria-label="Jenis pembayaran">{PAYMENT_GROUPS.map((group) => <button type="button" key={group.id} disabled={disabled} aria-pressed={selected.groupId === group.id} onClick={() => onChange(PAYMENT_METHODS.find((method) => method.groupId === group.id).id)}><span className="payment-group-icon" aria-hidden="true">{group.icon}</span><span>{group.label}</span></button>)}</div>
    <fieldset className="payment-channel-options" disabled={disabled}><legend>{PAYMENT_GROUPS.find((group) => group.id === selected.groupId).label}</legend>{methods.map((method) => <label className={'payment-channel' + (method.id === selected.id ? ' is-selected' : '')} key={method.id}><input type="radio" name="payment-method" value={method.id} checked={method.id === selected.id} onChange={() => onChange(method.id)} /><span className={'payment-provider provider-' + method.id} aria-hidden="true">{method.provider}</span><span><strong>{method.label}</strong><small>{method.description}</small></span><span className="payment-check" aria-hidden="true">{method.id === selected.id ? '✓' : ''}</span></label>)}</fieldset>
    <p className="payment-preview-note">Pembayaran percobaan. Tidak ada dana yang diproses.</p>
  </div>;
}
