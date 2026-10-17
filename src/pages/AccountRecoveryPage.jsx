import { useEffect, useRef, useState } from 'react';
import { accountApi } from '../components/account/accountApi';
import '../components/account/AuthPage.css';

export default function AccountRecoveryPage({ mode, route }) {
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
  const submit = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    setError('');
    setMessage('');
    if (
      !forgot &&
      (password.length < 8 || password.length > 128 || (!verify && password !== confirm))
    ) {
      setError('Gunakan kata sandi 8–128 karakter dan konfirmasi yang sama.');
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
      <section className="auth-card">
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
              ? 'Masukkan kata sandi akun untuk memastikan tautan ini milik Anda. Verifikasi email dilakukan sekali; persetujuan Admin atau Pemilik adalah langkah terpisah.'
              : 'Tentukan kata sandi baru. Tautan hanya dapat digunakan sekali.'}
        </p>
        {ready === false && (
          <p className="shop-warning" role="status">
            Layanan email toko belum diaktifkan. Hubungi pengelola toko untuk bantuan.
          </p>
        )}
        {!forgot && !token && !done && (
          <p role="alert">Buka kembali tautan dari email untuk melanjutkan.</p>
        )}
        {!done && (
          <form onSubmit={submit}>
            <fieldset disabled={busy || (forgot && ready !== true) || (!forgot && !token)}>
              {forgot ? (
                <div className="auth-field">
                  <label htmlFor="recovery-email">Email</label>
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
                    ))}
                </>
              )}
              <button className="shop-primary" type="submit">
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
          <p className="auth-error" role="alert">
            {error}
          </p>
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
