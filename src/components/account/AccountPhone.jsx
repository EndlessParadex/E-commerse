import { useEffect, useRef, useState } from 'react';
import { useDelivery } from '../../state/useDelivery';
import useUnsavedChanges from '../../state/useUnsavedChanges';
import { normalizeWhatsApp } from '../../state/whatsappModel';

export default function AccountPhone() {
  const { user, savePhone } = useDelivery();
  const [value, setValue] = useState(user.phone || '');
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const active = useRef(true),
    pending = useRef(false),
    input = useRef(null);
  useUnsavedChanges(edited, undefined, busy);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    // Keep an unsaved draft when another profile field is updated.
    if (!edited) {
      // oxlint-disable-next-line react/set-state-in-effect
      setValue(user.phone || '');
    }
  }, [user.phone, edited]);
  const submit = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    setError('');
    setMessage('');
    if (value.trim() && !normalizeWhatsApp(value)) {
      setError('Isi nomor HP Indonesia yang valid, misalnya 081234567890.');
      input.current?.focus();
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const result = await savePhone(value);
      if (!active.current) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setValue(result.phone);
      setEdited(false);
      setMessage(
        result.phone
          ? 'Nomor HP berhasil disimpan sebagai kontak akun.'
          : 'Nomor HP berhasil dihapus dari kontak akun.',
      );
    } catch {
      if (active.current) setError('Nomor HP belum dapat disimpan. Isian Anda tetap tersedia.');
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };
  return (
    <form className="account-phone-form" onSubmit={submit} noValidate aria-label="Nomor HP akun">
      <div className="account-field">
        <label htmlFor="account-phone">Nomor HP / WhatsApp (opsional)</label>
        <input
          id="account-phone"
          ref={input}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={value}
          maxLength={40}
          disabled={busy}
          placeholder="Contoh: 081234567890"
          onChange={(event) => {
            setValue(event.target.value);
            setEdited(true);
            setError('');
            setMessage('');
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={'account-phone-help' + (error ? ' account-phone-error' : '')}
        />
        <p className="account-profile-help" id="account-phone-help">
          Nomor ini disimpan sebagai kontak akun dan belum diverifikasi. Login tetap menggunakan
          email dan kata sandi. Kosongkan lalu simpan untuk menghapus nomor.
        </p>
        {error && (
          <p id="account-phone-error" className="account-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <button className="account-page-secondary" type="submit" disabled={busy || !edited}>
        {busy ? 'Menyimpan…' : 'Simpan nomor HP'}
      </button>
      {message && (
        <p className="account-phone-notice" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
