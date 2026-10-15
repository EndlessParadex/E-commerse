import { useEffect, useRef, useState } from 'react';
import { useDelivery } from '../../state/useDelivery';
import useUnsavedChanges from '../../state/useUnsavedChanges';
import { accountApi } from './accountApi';
import { approveNextRoute } from '../../state/routeGuards';

export default function AccountSecurity() {
  const { user, setUser } = useDelivery();
  const canChangePassword = user.role === 'admin';
  const [ready, setReady] = useState(false),
    [values, setValues] = useState({ currentPassword: '', password: '', confirm: '' }),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const pending = useRef(false),
    active = useRef(true);
  useUnsavedChanges(
    canChangePassword && Boolean(values.currentPassword || values.password || values.confirm),
    undefined,
    busy,
  );
  useEffect(() => {
    active.current = true;
    accountApi('/api/auth/features')
      .then((data) => {
        if (active.current) setReady(data.emailReady === true);
      })
      .catch(() => {});
    return () => {
      active.current = false;
    };
  }, []);
  const resend = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await accountApi('/api/auth/verification/request', {});
      if (active.current) setMessage(data.message);
    } catch (e) {
      if (active.current) setError(e.message);
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!canChangePassword || pending.current) return;
    setError('');
    setMessage('');
    if (
      values.password.length < 8 ||
      values.password.length > 128 ||
      values.password !== values.confirm
    ) {
      setError('Gunakan kata sandi 8–128 karakter dan konfirmasi yang sama.');
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const data = await accountApi('/api/auth/change-password', {
        currentPassword: values.currentPassword,
        password: values.password,
      });
      if (!active.current) return;
      setValues({ currentPassword: '', password: '', confirm: '' });
      setMessage(data.message);
      setUser(null);
      approveNextRoute('/login');
      window.location.hash = '/login';
    } catch (e) {
      if (active.current) setError(e.message);
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };
  return (
    <div className="account-security-settings">
      <div className="account-panel-heading">
        <h2>Keamanan akun</h2>
        <p>
          {canChangePassword
            ? 'Konfirmasi email dan kelola kata sandi akun admin Anda.'
            : 'Lihat status keamanan dan konfirmasi email akun Anda.'}
        </p>
      </div>
      <div className="account-security-email">
        <strong>{user.email}</strong>
        <p className="account-security-email-status">
          {user.emailVerified ? 'Email sudah dikonfirmasi.' : 'Email belum dikonfirmasi.'}
        </p>
        {!user.emailVerified && (
          <button
            type="button"
            className="bam-button-secondary"
            disabled={busy || !ready}
            onClick={resend}
          >
            Kirim tautan konfirmasi email
          </button>
        )}
        {!ready && (
          <p className="account-security-help">
            {canChangePassword
              ? 'Layanan email toko belum diaktifkan. Lengkapi pengaturan email untuk mengaktifkan verifikasi dan pemulihan akun.'
              : 'Konfirmasi email belum tersedia. Hubungi admin toko untuk bantuan.'}
          </p>
        )}
      </div>
      {canChangePassword ? (
        <form onSubmit={submit} className="account-address-form account-security-form">
          <fieldset disabled={busy}>
            <legend>Ubah kata sandi</legend>
            {[
              ['currentPassword', 'Kata sandi saat ini', 'current-password'],
              ['password', 'Kata sandi baru', 'new-password'],
              ['confirm', 'Konfirmasi kata sandi baru', 'new-password'],
            ].map(([field, label, autoComplete]) => (
              <div className="account-field" key={field}>
                <label htmlFor={'security-' + field}>{label}</label>
                <input
                  id={'security-' + field}
                  type="password"
                  value={values[field]}
                  maxLength={128}
                  autoComplete={autoComplete}
                  required
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field]: event.target.value }))
                  }
                />
              </div>
            ))}
            <p className="account-security-help">
              Setelah perubahan berhasil, semua sesi lama diakhiri. Anda perlu masuk kembali.
            </p>
            <button type="submit" className="shop-primary">
              {busy ? 'Menyimpan…' : 'Ubah kata sandi'}
            </button>
          </fieldset>
        </form>
      ) : (
        <section className="account-security-summary" aria-label="Informasi kata sandi">
          <h3>Kata sandi</h3>
          <p>Kata sandi tidak ditampilkan.</p>
          <p className="account-security-help">
            Pengaturan kata sandi di halaman ini hanya tersedia untuk admin. Hubungi admin toko jika
            memerlukan bantuan akun.
          </p>
        </section>
      )}
      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {canChangePassword && (
        <p>
          <a href="#/forgot-password">Lupa kata sandi?</a>
        </p>
      )}
    </div>
  );
}
