import { useEffect, useRef, useState } from 'react';
import { accountApi } from './accountApi';
import { normalizeWhatsApp } from '../../state/whatsappModel.js';

const RESEND_WAIT = 60;

/**
 * "Lupa kata sandi" by WhatsApp: a 6-digit code goes to the account's confirmed number, then the
 * buyer chooses a new password. The server answers the same way whether or not the number is
 * registered, so this form never says that a number is unknown.
 */
export default function WhatsAppRecovery() {
  const [ready, setReady] = useState(null),
    [step, setStep] = useState('phone'),
    [phone, setPhone] = useState(''),
    [code, setCode] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [wait, setWait] = useState(0);
  const active = useRef(true),
    pending = useRef(false);
  useEffect(() => {
    active.current = true;
    accountApi('/api/auth/features')
      .then((data) => active.current && setReady(data.phoneVerificationReady === true))
      .catch(() => active.current && setReady(false));
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  const run = async (work) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (e) {
      if (active.current) setError(e.message);
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };
  const requestCode = (event) => {
    event?.preventDefault();
    if (!normalizeWhatsApp(phone)) {
      setError('Isi nomor HP Indonesia yang valid, misalnya 081234567890.');
      return;
    }
    return run(async () => {
      const data = await accountApi('/api/auth/forgot-phone', { phone });
      if (!active.current) return;
      setMessage(data.message);
      setStep('code');
      setWait(RESEND_WAIT);
    });
  };
  const resetPassword = (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Masukkan kode 6 angka dari WhatsApp.');
      return;
    }
    if (password.length < 8 || password.length > 128 || password !== confirm) {
      setError('Gunakan kata sandi 8–128 karakter dan konfirmasi yang sama.');
      return;
    }
    return run(async () => {
      const data = await accountApi('/api/auth/reset-phone', {
        phone,
        code: code.trim(),
        password,
      });
      if (!active.current) return;
      setMessage(data.message);
      setPassword('');
      setConfirm('');
      setCode('');
      setStep('done');
    });
  };

  if (ready === false)
    return (
      <p className="shop-warning" role="status">
        Pemulihan lewat WhatsApp belum diaktifkan. Hubungi Admin atau Pemilik toko; mereka dapat
        membuatkan kata sandi sementara.
      </p>
    );
  return (
    <div className="whatsapp-recovery">
      {step === 'phone' && (
        <form onSubmit={requestCode} noValidate>
          <fieldset disabled={busy || ready !== true}>
            <div className="auth-field">
              <label htmlFor="recovery-phone">Nomor HP / WhatsApp akun</label>
              <div className="auth-input-wrap">
                <input
                  id="recovery-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={40}
                  placeholder="081234567890"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  aria-describedby="recovery-phone-help"
                  required
                />
              </div>
              <p className="auth-hint" id="recovery-phone-help">
                Kode hanya dikirim ke nomor yang sudah dikonfirmasi di Akun saya → Profil. Belum
                pernah konfirmasi? Hubungi Admin atau Pemilik toko.
              </p>
            </div>
            <button className="shop-primary auth-submit" type="submit">
              {busy ? 'Mengirim…' : 'Kirim kode ke WhatsApp'}
            </button>
          </fieldset>
        </form>
      )}
      {step === 'code' && (
        <form onSubmit={resetPassword} noValidate>
          <fieldset disabled={busy}>
            <div className="auth-field">
              <label htmlFor="recovery-code">Kode dari WhatsApp</label>
              <div className="auth-input-wrap">
                <input
                  id="recovery-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="\d{6}"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
            </div>
            {[
              ['recovery-new-password', 'Kata sandi baru', password, setPassword],
              ['recovery-new-confirm', 'Konfirmasi kata sandi baru', confirm, setConfirm],
            ].map(([id, label, value, setValue]) => (
              <div className="auth-field" key={id}>
                <label htmlFor={id}>{label}</label>
                <div className="auth-input-wrap">
                  <input
                    id={id}
                    type="password"
                    maxLength={128}
                    autoComplete="new-password"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    required
                  />
                </div>
              </div>
            ))}
            <button className="shop-primary auth-submit" type="submit">
              {busy ? 'Memproses…' : 'Simpan kata sandi baru'}
            </button>
            <div className="whatsapp-recovery-actions">
              <button
                type="button"
                className="auth-register-again"
                disabled={wait > 0}
                onClick={() => requestCode()}
              >
                {wait > 0 ? `Kirim ulang kode (${wait} dtk)` : 'Kirim ulang kode'}
              </button>
              <button
                type="button"
                className="auth-register-again"
                onClick={() => {
                  setStep('phone');
                  setCode('');
                  setMessage('');
                  setError('');
                }}
              >
                Ganti nomor
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {step === 'done' && (
        <a className="shop-primary auth-submit" href="#/login">
          Masuk dengan kata sandi baru
        </a>
      )}
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="auth-submit-notice" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
