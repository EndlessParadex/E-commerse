import useCompany from '../../state/useCompany';
import { useEffect, useRef, useState } from 'react';
import { validateAuth } from './authValidation';
import { useDelivery } from '../../state/useDelivery';
import BelitungAddressFields from './BelitungAddressFields';
import { takeReturnRoute } from './guestAccess';
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
  const [autoApprove, setAutoApprove] = useState(null);
  const [showEmail, setShowEmail] = useState(false);
  useEffect(() => {
    if (mode !== 'register') return undefined;
    let live = true;
    fetch('/api/auth/registration-mode', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => live && setAutoApprove(payload?.autoApprove === true))
      .catch(() => live && setAutoApprove(false));
    return () => {
      live = false;
    };
  }, [mode]);
  const isRegister = mode === 'register';
  const { setUser } = useDelivery();
  const formRef = useRef(null);
  const [values, setValues] = useState({
    name: '',
    phone: '',
    jalan: '',
    desa: '',
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

  const update = (event) => setField(event.target.name, event.target.value);
  const setField = (name, value) => {
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
    // Registration shows one password field with a show/hide button, so it confirms itself.
    const nextErrors = validateAuth(
      isRegister ? { ...values, confirmPassword: values.password } : values,
      mode,
    );
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
          ...(isRegister ? { street: values.jalan, villageCode: values.desa } : {}),
          email: values.email.trim(),
          ...(isRegister ? { phone: values.phone } : {}),
          password: values.password,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const { street, villageCode, ...rest } = payload.errors || {};
        setErrors({ ...rest, jalan: street, desa: villageCode });
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
            : takeReturnRoute() || '/';
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
          <h2>
            {isRegister ? 'Daftar sekali, belanja grosir kapan saja.' : 'Selamat datang kembali.'}
          </h2>
          <p>
            Kebutuhan toko dari {companyProfile.legalName || companyProfile.shortName}, diantar
            sopir sendiri.
          </p>
          {isRegister ? (
            <ol className="auth-steps">
              <li>
                <span aria-hidden="true">1</span>
                <div>
                  <strong>Isi data dan alamat toko</strong>
                  <small>Sekitar satu menit</small>
                </div>
              </li>
              <li>
                <span aria-hidden="true">2</span>
                <div>
                  <strong>Konfirmasi nomor WhatsApp</strong>
                  <small>Sebelum pesanan pertama</small>
                </div>
              </li>
              <li>
                <span aria-hidden="true">3</span>
                <div>
                  <strong>Pesan, bayar saat barang tiba</strong>
                  <small>Diantar sopir {companyProfile.shortName} ke toko Anda</small>
                </div>
              </li>
            </ol>
          ) : (
            <ul className="auth-intro-tags">
              <li>Bayar di tempat (COD)</li>
              <li>Harga per renceng, pack, dus</li>
              <li>Status pesanan jelas</li>
            </ul>
          )}
          {companyProfile.phone && (
            <p className="auth-help">
              Butuh bantuan? Hubungi {companyProfile.shortName} di{' '}
              <strong>{companyProfile.phone}</strong>
            </p>
          )}
        </aside>
        <section className="auth-card" aria-labelledby="auth-title">
          <header>
            <h1 id="auth-title">{isRegister ? 'Buat akun' : 'Masuk ke akun'}</h1>
            <p>
              {!isRegister
                ? 'Gunakan email atau nomor HP dengan kata sandi Anda.'
                : autoApprove === null
                  ? 'Daftar sebagai pembeli.'
                  : autoApprove
                    ? 'Daftar sebagai pembeli. Akun langsung aktif setelah daftar.'
                    : 'Daftar sebagai pembeli. Setelah daftar, akun diperiksa Admin sebelum bisa masuk.'}
            </p>
          </header>
          {!registrationSent && !isRegister && (
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
              {isRegister ? (
                <>
                  <fieldset className="auth-group">
                    <legend>
                      <span aria-hidden="true">1</span> Kontak
                    </legend>
                    {field('name', 'Nama lengkap', 'text', 'name', 'Nama lengkap Anda')}
                    {field('phone', 'Nomor HP / WhatsApp', 'tel', 'tel', '081234567890', {
                      help: 'Dipakai untuk masuk dan untuk konfirmasi pesanan lewat WhatsApp.',
                    })}
                    {showEmail || values.email || errors.email ? (
                      field('email', 'Email (opsional)', 'email', 'email', 'nama@contoh.com', {
                        optional: true,
                        help: 'Boleh dikosongkan. Tanpa email, masuk dan pemulihan kata sandi memakai nomor HP.',
                      })
                    ) : (
                      <button
                        type="button"
                        className="auth-add-email"
                        onClick={() => setShowEmail(true)}
                        disabled={busy}
                      >
                        + Tambah email (opsional)
                      </button>
                    )}
                  </fieldset>
                  <fieldset className="auth-group">
                    <legend>
                      <span aria-hidden="true">2</span> Alamat pengiriman
                    </legend>
                    <BelitungAddressFields
                      idPrefix="auth"
                      value={values}
                      errors={errors}
                      disabled={busy}
                      onChange={setField}
                      classes={{
                        field: 'auth-field',
                        error: 'auth-error',
                        hint: 'auth-hint',
                        wrap: 'auth-input-wrap',
                      }}
                    />
                  </fieldset>
                  <fieldset className="auth-group">
                    <legend>
                      <span aria-hidden="true">3</span> Kata sandi
                    </legend>
                    {field(
                      'password',
                      'Kata sandi',
                      'password',
                      'new-password',
                      'Masukkan kata sandi',
                    )}
                  </fieldset>
                </>
              ) : (
                <>
                  {field(
                    'email',
                    'Email atau Nomor HP',
                    'text',
                    'username',
                    'nama@contoh.com atau 081234567890',
                  )}
                  {field(
                    'password',
                    'Kata sandi',
                    'password',
                    'current-password',
                    'Masukkan kata sandi',
                  )}
                </>
              )}
              {notice && (
                <p className="auth-submit-notice" role="status">
                  {notice}
                </p>
              )}
              <button className="shop-primary auth-submit" type="submit" disabled={busy}>
                {busy ? 'Mohon tunggu…' : isRegister ? 'Daftar akun' : 'Masuk'}
              </button>
              {!isRegister && (
                <p className="auth-forgot">
                  <a href="#/forgot-password">Lupa kata sandi?</a>
                </p>
              )}
            </form>
          )}
          {!isRegister && (
            <div className="auth-register-cta">
              <p>Belum punya akun?</p>
              <a className="auth-register-button" href="#/daftar">
                Daftar akun baru
              </a>
            </div>
          )}
          {isRegister && (
            <p className="auth-switch">
              Sudah punya akun? <a href="#/login">Masuk</a>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
