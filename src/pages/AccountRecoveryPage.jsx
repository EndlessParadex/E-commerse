import { useEffect, useRef, useState } from 'react';
import { accountApi } from '../components/account/accountApi';
import { useDelivery } from '../state/useDelivery';
import '../components/account/AuthPage.css';

export default function AccountRecoveryPage({ mode, route }) {
  const { authLoading } = useDelivery();
  // WorkflowProvider replaces its children when the initial account session resolves.
  // Do not consume/scrub the email token before that replacement is finished.
  if (authLoading)
    return (
      <div className="auth-page" role="status">
        Memuat akun…
      </div>
    );
  return <AccountRecoveryForm mode={mode} route={route} />;
}

function AccountRecoveryForm({ mode, route }) {
  const { user, authLoading } = useDelivery();
  const [token, setToken] = useState(
    () => new URLSearchParams(route.split('?')[1] || '').get('token') || '',
  );
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [ready, setReady] = useState(null);
  const pending = useRef(false),
    active = useRef(true),
    generation = useRef(0);
  useEffect(() => {
    active.current = true;
    const current = ++generation.current;
    const incoming = new URLSearchParams(route.split('?')[1] || '').get('token') || '';
    if (incoming) {
      // Synchronize a new email link while retaining its token after URL cleanup.
      // oxlint-disable-next-line react/set-state-in-effect
      setToken(incoming);
      setDone(false);
      setError('');
      setMessage('');
      setPassword('');
      setConfirm('');
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search + '#/' + mode,
      );
    }
    accountApi('/api/auth/features')
      .then((data) => {
        if (active.current && generation.current === current) setReady(data.emailReady === true);
      })
      .catch(() => {
        if (active.current && generation.current === current) setReady(false);
      });
    return () => {
      active.current = false;
    };
  }, [mode, route]);
  const forgot = mode === 'forgot-password',
    verify = mode === 'verifikasi-email';
  const requestVerification = async (event) => {
    event.preventDefault();
    if (pending.current || ready !== true || authLoading) return;
    pending.current = true;
    const current = generation.current;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await accountApi(
        user ? '/api/auth/verification/request' : '/api/auth/verification/resend',
        user ? {} : { email },
      );
      if (active.current && generation.current === current) setMessage(data.message);
    } catch (e) {
      if (active.current && generation.current === current) setError(e.message);
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (pending.current || (!forgot && !token) || (forgot && ready !== true)) return;
    setError('');
    setMessage('');
    if (
      !forgot &&
      (password.length < 8 || password.length > 128 || (!verify && password !== confirm))
    ) {
      setError(
        verify
          ? 'Masukkan kata sandi akun Anda (8–128 karakter).'
          : 'Gunakan kata sandi 8–128 karakter dan konfirmasi yang sama.',
      );
      return;
    }
    pending.current = true;
    const current = generation.current;
    setBusy(true);
    try {
      const data = await accountApi(
        forgot
          ? '/api/auth/forgot-password'
          : verify
            ? '/api/auth/verify-email'
            : '/api/auth/reset-password',
        forgot ? { email } : { token: token, password },
      );
      if (!active.current || generation.current !== current) return;
      setMessage(data.message);
      setPassword('');
      setConfirm('');
      if (!forgot) {
        setDone(true);
        setToken('');
      }
    } catch (e) {
      if (active.current && generation.current === current) setError(e.message);
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <section className="auth-card auth-recovery-card">
        <h1>
          {forgot
            ? 'Lupa kata sandi'
            : verify
              ? 'Konfirmasi alamat email'
              : 'Atur ulang kata sandi'}
        </h1>
        <p>
          {forgot
            ? 'Masukkan email akun untuk meminta petunjuk pemulihan.'
            : verify
              ? token
                ? 'Masukkan kata sandi akun untuk memastikan tautan ini milik Anda. Verifikasi email dilakukan sekali; persetujuan Admin atau Pemilik adalah langkah terpisah.'
                : 'Konfirmasi email melalui tautan yang dikirim ke kotak masuk Anda. Persetujuan Admin atau Pemilik adalah langkah terpisah.'
              : 'Tentukan kata sandi baru. Tautan hanya dapat digunakan sekali.'}
        </p>
        {ready === false && (
          <p className="shop-warning" role="status">
            Layanan email toko belum diaktifkan. Hubungi pengelola toko untuk bantuan.
          </p>
        )}
        {!forgot && !token && !done && (
          <div className="auth-recovery-help">
            <div className="auth-preview-note" role="status">
              <strong>Tautan {verify ? 'verifikasi' : 'pemulihan'} belum lengkap</strong>
              <p>
                Buka kembali tautan lengkap dari email. Jika halaman ini dimuat ulang atau tautannya
                tidak tersedia, minta tautan baru melalui pilihan di bawah.
              </p>
            </div>
            {verify ? (
              authLoading ? (
                <p role="status">Memuat akun…</p>
              ) : user?.emailVerified ? (
                <p>
                  Email akun Anda sudah dikonfirmasi. <a href="#/akun">Kembali ke akun saya</a>.
                </p>
              ) : (
                <form onSubmit={requestVerification} className="auth-recovery-request">
                  {user ? (
                    <p>
                      Kirim tautan baru ke <strong>{user.email}</strong>.
                    </p>
                  ) : (
                    <div className="auth-field">
                      <label htmlFor="verification-email">
                        Email yang digunakan saat mendaftar
                      </label>
                      <div className="auth-input-wrap">
                        <input
                          id="verification-email"
                          type="email"
                          autoComplete="email"
                          maxLength={254}
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          required
                          disabled={busy}
                        />
                      </div>
                      <p className="auth-hint">
                        Sudah bisa masuk? Anda juga dapat meminta tautan dari Akun saya → Keamanan.
                      </p>
                    </div>
                  )}
                  <button
                    className="shop-primary auth-submit"
                    type="submit"
                    disabled={busy || ready !== true || authLoading}
                  >
                    {busy ? 'Mengirim permintaan…' : 'Kirim tautan verifikasi baru'}
                  </button>
                  {ready === null && (
                    <p className="auth-hint" role="status">
                      Memeriksa layanan email…
                    </p>
                  )}
                </form>
              )
            ) : (
              <a className="shop-primary auth-submit" href="#/forgot-password">
                Minta tautan pemulihan baru
              </a>
            )}
          </div>
        )}
        {!done && (forgot || token) && (
          <form onSubmit={submit}>
            <fieldset disabled={busy || (forgot && ready !== true)}>
              {forgot ? (
                <div className="auth-field">
                  <label htmlFor="recovery-email">Email</label>
                  <div className="auth-input-wrap">
                    <input
                      id="recovery-email"
                      type="email"
                      maxLength={254}
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>
                </div>
              ) : (
                <>
                  {[
                    [
                      'recovery-password',
                      verify ? 'Kata sandi akun' : 'Kata sandi baru',
                      password,
                      setPassword,
                    ],
                    ['recovery-confirm', 'Konfirmasi kata sandi', confirm, setConfirm],
                  ]
                    .filter(([id]) => !verify || id !== 'recovery-confirm')
                    .map(([id, label, value, setValue]) => (
                      <div className="auth-field" key={id}>
                        <label htmlFor={id}>{label}</label>
                        <div className="auth-input-wrap">
                          <input
                            id={id}
                            type="password"
                            maxLength={128}
                            autoComplete={verify ? 'current-password' : 'new-password'}
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                            required
                          />
                        </div>
                      </div>
                    ))}
                </>
              )}
              <button className="shop-primary auth-submit" type="submit">
                {busy
                  ? 'Memproses…'
                  : forgot
                    ? 'Kirim instruksi reset'
                    : verify
                      ? 'Konfirmasi email'
                      : 'Simpan kata sandi baru'}
              </button>
            </fieldset>
          </form>
        )}
        {error && (
          <>
            <p className="auth-error" role="alert">
              {error}
            </p>
            {!forgot && token && (
              <button
                type="button"
                className="auth-register-again"
                onClick={() => {
                  setToken('');
                  setError('');
                  setPassword('');
                  setConfirm('');
                }}
              >
                Minta tautan baru
              </button>
            )}
          </>
        )}
        {message && (
          <p className="auth-submit-notice" role="status">
            {message}
          </p>
        )}
        <p>
          <a href="#/login">Kembali ke halaman masuk</a>
        </p>
      </section>
    </div>
  );
}
