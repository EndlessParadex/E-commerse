import useCompany from '../../state/useCompany';
import { useRef, useState } from 'react';
import { ActionIcon } from '../shop/ShopIcon';
import { validateAuth } from './authValidation';
import { useDelivery } from '../../state/useDelivery';
import './AuthPage.css';

function EyeIcon({ visible }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {visible && <path d="m3 3 18 18" />}
    </svg>
  );
}

export default function AuthPage({ mode }) {
  const { profile: companyProfile } = useCompany();
  const isRegister = mode === 'register';
  const { setUser } = useDelivery();
  const formRef = useRef(null);
  const [values, setValues] = useState({
    name: '',
    phone: '',
    address: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [visible, setVisible] = useState({ password: false, confirmPassword: false });
  const [notice, setNotice] = useState('');
  const [registrationSent, setRegistrationSent] = useState(false);
  const [registrationEmailReady, setRegistrationEmailReady] = useState(false);
  const [registeredWithEmail, setRegisteredWithEmail] = useState(false);
  const [resendNotice, setResendNotice] = useState('');
  const [resending, setResending] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  const update = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({
      ...current,
      [name]: undefined,
      ...(name === 'password' ? { confirmPassword: undefined } : {}),
    }));
    setNotice('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    const nextErrors = validateAuth(values, mode);
    setErrors(nextErrors);
    setNotice('');
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      formRef.current.elements.namedItem(firstError)?.focus();
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const response = await fetch(isRegister ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        signal: AbortSignal.timeout(15000),
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          address: values.address,
          email: values.email.trim(),
          ...(isRegister ? { phone: values.phone } : {}),
          password: values.password,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setErrors(payload.errors || {});
        setNotice(
          payload.errors?.form ||
            (response.status === 429
              ? 'Terlalu banyak percobaan masuk. Tunggu sebentar lalu coba lagi.'
              : 'Permintaan belum berhasil. Periksa kembali isian Anda.'),
        );
        return;
      }
      if (isRegister && !payload.user) {
        setValues((current) => ({ ...current, password: '', confirmPassword: '' }));
        setNotice(
          payload.message || 'Pendaftaran diterima. Tunggu persetujuan Admin atau Pemilik.',
        );
        setRegistrationEmailReady(payload.emailReady === true);
        setRegisteredWithEmail(payload.withEmail !== false && Boolean(values.email.trim()));
        setResendNotice('');
        setRegistrationSent(true);
        return;
      }
      setUser(payload.user);
      // Login must not overwrite the optional store name or recipient profile.
      setNotice(isRegister ? 'Akun berhasil dibuat.' : 'Berhasil masuk.');
      window.location.hash =
        payload.user.role === 'admin'
          ? '/admin'
          : payload.user.canViewCustomers
            ? '/pelanggan'
            : '/';
    } catch {
      setNotice('Belum dapat terhubung ke layanan akun. Periksa koneksi lalu coba lagi.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resending || !values.email) return;
    setResending(true);
    setResendNotice('');
    try {
      const response = await fetch('/api/auth/verification/resend', {
        method: 'POST',
        credentials: 'include',
        signal: AbortSignal.timeout(15000),
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: values.email }),
      });
      const payload = await response.json();
      setResendNotice(
        response.ok
          ? 'Permintaan diterima. Jika email masih perlu diverifikasi, periksa kotak masuk dan spam. Tunggu beberapa menit.'
          : payload.errors?.form || 'Belum berhasil meminta tautan. Coba kembali nanti.',
      );
    } catch {
      setResendNotice('Koneksi ke layanan email belum tersedia. Coba kembali nanti.');
    } finally {
      setResending(false);
    }
  };

  const field = (name, label, type, autoComplete, placeholder, { optional = false, help } = {}) => {
    const isPassword = type === 'password';
    const hint = isRegister && name === 'password';
    const describedBy =
      [hint ? 'password-hint' : '', help ? `${name}-help` : '', errors[name] ? `${name}-error` : '']
        .filter(Boolean)
        .join(' ') || undefined;
    return (
      <div className="auth-field">
        <label htmlFor={`auth-${name}`}>{label}</label>
        <div className={`auth-input-wrap${errors[name] ? ' has-error' : ''}`}>
          <input
            id={`auth-${name}`}
            name={name}
            type={isPassword && visible[name] ? 'text' : type}
            value={values[name]}
            disabled={busy}
            onChange={update}
            autoComplete={autoComplete}
            placeholder={placeholder}
            required={!optional}
            aria-invalid={Boolean(errors[name])}
            aria-describedby={describedBy}
            maxLength={isPassword ? 128 : name === 'name' ? 100 : name === 'phone' ? 40 : 254}
            inputMode={name === 'phone' ? 'tel' : undefined}
            autoCapitalize={name === 'email' || isPassword ? 'none' : undefined}
            spellCheck={name === 'email' || isPassword ? false : undefined}
          />
          {isPassword && (
            <button
              type="button"
              className="auth-eye"
              aria-label={`${visible[name] ? 'Sembunyikan' : 'Tampilkan'} ${label.toLowerCase()}`}
              aria-pressed={Boolean(visible[name])}
              onClick={() => setVisible((current) => ({ ...current, [name]: !current[name] }))}
            >
              <EyeIcon visible={visible[name]} />
            </button>
          )}
        </div>
        {hint && (
          <p className="auth-hint" id="password-hint">
            Minimal 8 karakter.
          </p>
        )}
        {help && (
          <p className="auth-hint" id={`${name}-help`}>
            {help}
          </p>
        )}
        {errors[name] && (
          <p className="auth-error" id={`${name}-error`}>
            {errors[name]}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="auth-page">
      <nav className="shop-breadcrumb" aria-label="Breadcrumb">
        <a href="#/">Beranda</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{isRegister ? 'Daftar akun' : 'Masuk'}</span>
      </nav>
      <div className="auth-layout">
        <aside className="auth-intro">
          <span className="auth-brand">{companyProfile.shortName}.</span>
          <div className="auth-intro-icon">
            <ActionIcon account />
          </div>
          <h2>{isRegister ? 'Mulai dari satu akun.' : 'Selamat datang kembali.'}</h2>
          <p>Temukan kosmetik, snack, dan kebutuhan harian pilihan dalam satu tempat.</p>
          <div className="auth-intro-tags">
            <span>Kosmetik</span>
            <span>Snack</span>
            <span>Kebutuhan harian</span>
          </div>
        </aside>
        <section className="auth-card" aria-labelledby="auth-title">
          <header>
            <h1 id="auth-title">{isRegister ? 'Buat akun' : 'Masuk ke akun'}</h1>
            <p>
              {isRegister
                ? 'Daftar sebagai pembeli. Akun harus disetujui Admin atau Pemilik sebelum dapat masuk.'
                : 'Gunakan email atau nomor HP dengan kata sandi Anda.'}
            </p>
          </header>
          {!registrationSent && (
            <p className="auth-preview-note">
              {isRegister
                ? 'Nama penerima dan alamat digunakan untuk checkout. Nama toko dapat diatur melalui Akun Saya → Alamat.'
                : 'Masuk untuk menggunakan alamat akun pada “Kirim ke” dan checkout.'}
            </p>
          )}
          {registrationSent ? (
            <div className="auth-registration-result">
              <h2>Langkah berikutnya</h2>
              <p className="auth-submit-notice" role="status">
                {notice}
              </p>
              {registeredWithEmail ? (
                <ol>
                  <li>
                    {registrationEmailReady
                      ? 'Periksa kotak masuk atau spam. Tautan verifikasi dikirim otomatis jika akun baru berhasil dibuat.'
                      : 'Pengiriman email belum tersedia. Anda tetap dapat memakai nomor WhatsApp.'}
                  </li>
                  <li>Admin atau Pemilik akan memeriksa pendaftaran Anda.</li>
                  <li>
                    Setelah disetujui, masuk dengan email atau nomor HP. Sebelum memesan, konfirmasi
                    email atau nomor WhatsApp.
                  </li>
                </ol>
              ) : (
                <ol>
                  <li>Admin atau Pemilik akan memeriksa pendaftaran Anda.</li>
                  <li>Setelah disetujui, masuk dengan nomor HP dan kata sandi.</li>
                  <li>
                    Buka Akun saya → Profil, lalu konfirmasi nomor WhatsApp dengan kode yang
                    dikirim. Setelah itu Anda dapat memesan.
                  </li>
                </ol>
              )}
              {registrationEmailReady && registeredWithEmail && (
                <div className="auth-registration-help">
                  <p>
                    Belum ada email? Tunggu beberapa menit, periksa spam, lalu gunakan tombol
                    berikut bila diperlukan.
                  </p>
                  <button
                    className="auth-register-again"
                    type="button"
                    onClick={resend}
                    disabled={resending}
                  >
                    {resending ? 'Mengirim permintaan…' : 'Kirim ulang tautan verifikasi'}
                  </button>
                  {resendNotice && <p role="status">{resendNotice}</p>}
                </div>
              )}
              <a className="shop-primary auth-submit" href="#/login">
                Lanjut ke halaman masuk
              </a>
              <button
                className="auth-register-again"
                type="button"
                onClick={() => {
                  setRegistrationSent(false);
                  setNotice('');
                  setResendNotice('');
                }}
              >
                Ubah data pendaftaran
              </button>
            </div>
          ) : (
            <form ref={formRef} onSubmit={submit} noValidate aria-busy={busy}>
              {isRegister && field('name', 'Nama lengkap', 'text', 'name', 'Nama lengkap Anda')}
              {isRegister &&
                field('phone', 'Nomor HP / WhatsApp', 'tel', 'tel', '081234567890', {
                  help: 'Dipakai untuk masuk dan untuk konfirmasi pesanan lewat WhatsApp.',
                })}
              {isRegister && (
                <div className="auth-field">
                  <label htmlFor="auth-address">Alamat lengkap</label>
                  <div className={`auth-input-wrap${errors.address ? ' has-error' : ''}`}>
                    <textarea
                      id="auth-address"
                      name="address"
                      value={values.address}
                      disabled={busy}
                      onChange={update}
                      rows={3}
                      maxLength={500}
                      autoComplete="street-address"
                      required
                      placeholder="Nama jalan, nomor rumah, kelurahan, kecamatan, kota, provinsi, dan kode pos"
                      aria-invalid={Boolean(errors.address)}
                      aria-describedby={`address-hint${errors.address ? ' address-error' : ''}`}
                    />
                  </div>
                  <p id="address-hint" className="auth-hint">
                    Nama lengkap digunakan sebagai nama penerima pada “Kirim ke”.
                  </p>
                  {errors.address && (
                    <p id="address-error" className="auth-error">
                      {errors.address}
                    </p>
                  )}
                </div>
              )}
              {field(
                'email',
                isRegister ? 'Email (opsional)' : 'Email atau Nomor HP',
                isRegister ? 'email' : 'text',
                isRegister ? 'email' : 'username',
                isRegister ? 'nama@contoh.com' : 'nama@contoh.com atau 081234567890',
                isRegister
                  ? {
                      optional: true,
                      help: 'Boleh dikosongkan. Tanpa email, masuk dan pemulihan kata sandi memakai nomor HP.',
                    }
                  : {},
              )}
              {field(
                'password',
                'Kata sandi',
                'password',
                isRegister ? 'new-password' : 'current-password',
                'Masukkan kata sandi',
              )}
              {isRegister &&
                field(
                  'confirmPassword',
                  'Konfirmasi kata sandi',
                  'password',
                  'new-password',
                  'Ulangi kata sandi',
                )}
              {notice && (
                <p className="auth-submit-notice" role="status">
                  {notice}
                </p>
              )}
              <button className="shop-primary auth-submit" type="submit" disabled={busy}>
                {busy ? 'Mohon tunggu…' : isRegister ? 'Daftar akun' : 'Masuk'}
              </button>
            </form>
          )}
          <p className="auth-switch">
            {!isRegister && (
              <>
                <a href="#/forgot-password">Lupa kata sandi?</a>
                <br />
              </>
            )}
            {isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}
            <a href={isRegister ? '#/login' : '#/daftar'}>
              {isRegister ? 'Masuk' : 'Daftar sekarang'}
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
