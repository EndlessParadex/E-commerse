import { useRef, useState } from 'react';
import { ActionIcon } from '../shop/ShopIcon';
import { validateAuth } from './authValidation';
import { useDelivery } from '../../state/useDelivery';
import './AuthPage.css';

function EyeIcon({ visible }) {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{visible && <path d="m3 3 18 18" />}</svg>;
}

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { saveLocation, setUser } = useDelivery();
  const formRef = useRef(null);
  const [values, setValues] = useState({ name: '', address: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [visible, setVisible] = useState({ password: false, confirmPassword: false });
  const [notice, setNotice] = useState('');

  const update = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined, ...(name === 'password' ? { confirmPassword: undefined } : {}) }));
    setNotice('');
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validateAuth(values, mode);
    setErrors(nextErrors);
    setNotice('');
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      formRef.current.elements.namedItem(firstError)?.focus();
      return;
    }
    try {
      const response = await fetch(isRegister ? '/api/auth/register' : '/api/auth/login', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: values.name, address: values.address, email: values.email, password: values.password }) });
      const payload = await response.json();
      if (!response.ok) { setErrors(payload.errors || { form: payload.error || 'Permintaan gagal.' }); setNotice(payload.errors?.form || 'Periksa kembali isian Anda.'); return; }
      setUser(payload.user);
      await saveLocation({ namaToko: payload.user.name, namaJalan: payload.user.address });
      setNotice(isRegister ? 'Akun berhasil dibuat dan alamat sudah terhubung ke “Kirim ke”.' : 'Berhasil masuk. Alamat akun sudah terhubung ke “Kirim ke”.');
      window.location.hash = '/';
    } catch { setNotice('Server belum berjalan. Jalankan npm run dev:full lalu coba lagi.'); }
  };

  const field = (name, label, type, autoComplete, placeholder) => {
    const isPassword = type === 'password';
    const hint = isRegister && name === 'password';
    const describedBy = [hint ? 'password-hint' : '', errors[name] ? `${name}-error` : ''].filter(Boolean).join(' ') || undefined;
    return <div className="auth-field">
      <label htmlFor={`auth-${name}`}>{label}</label>
      <div className={`auth-input-wrap${errors[name] ? ' has-error' : ''}`}>
        <input id={`auth-${name}`} name={name} type={isPassword && visible[name] ? 'text' : type} value={values[name]} onChange={update} autoComplete={autoComplete} placeholder={placeholder} required aria-invalid={Boolean(errors[name])} aria-describedby={describedBy} maxLength={isPassword ? 128 : name === 'name' ? 100 : 254} autoCapitalize={type === 'email' || isPassword ? 'none' : undefined} spellCheck={type === 'email' || isPassword ? false : undefined} />
        {isPassword && <button type="button" className="auth-eye" aria-label={`${visible[name] ? 'Sembunyikan' : 'Tampilkan'} ${label.toLowerCase()}`} aria-pressed={Boolean(visible[name])} onClick={() => setVisible((current) => ({ ...current, [name]: !current[name] }))}><EyeIcon visible={visible[name]} /></button>}
      </div>
      {hint && <p className="auth-hint" id="password-hint">Minimal 8 karakter.</p>}
      {errors[name] && <p className="auth-error" id={`${name}-error`}>{errors[name]}</p>}
    </div>;
  };

  return <div className="auth-page">
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><span aria-current="page">{isRegister ? 'Daftar akun' : 'Masuk'}</span></nav>
    <div className="auth-layout">
      <aside className="auth-intro">
        <span className="auth-brand">BAM.</span>
        <div className="auth-intro-icon"><ActionIcon account /></div>
        <h2>{isRegister ? 'Mulai dari satu akun.' : 'Selamat datang kembali.'}</h2>
        <p>Temukan kosmetik, snack, dan kebutuhan harian pilihan dalam satu tempat.</p>
        <div className="auth-intro-tags"><span>Kosmetik</span><span>Snack</span><span>Kebutuhan harian</span></div>
      </aside>
      <section className="auth-card" aria-labelledby="auth-title">
        <header><h1 id="auth-title">{isRegister ? 'Buat akun' : 'Masuk ke akun'}</h1><p>{isRegister ? 'Isi informasi berikut untuk mendaftar.' : 'Gunakan email dan kata sandi Anda.'}</p></header>
        <p className="auth-preview-note">Pratinjau form — login dan pendaftaran belum aktif. Gunakan data contoh untuk mencoba.{isRegister && ' Nama dan alamat contoh akan disimpan di browser ini untuk mengisi “Kirim ke”.'}</p>
        <form ref={formRef} onSubmit={submit} noValidate>
          {isRegister && field('name', 'Nama lengkap', 'text', 'name', 'Nama lengkap Anda')}
          {isRegister && <div className="auth-field">
            <label htmlFor="auth-address">Alamat lengkap</label>
            <div className={`auth-input-wrap${errors.address ? ' has-error' : ''}`}>
              <textarea id="auth-address" name="address" value={values.address} onChange={update} rows={3} maxLength={500} autoComplete="street-address" required placeholder="Nama jalan, nomor rumah, kelurahan, kecamatan, kota, provinsi, dan kode pos" aria-invalid={Boolean(errors.address)} aria-describedby={`address-hint${errors.address ? ' address-error' : ''}`} />
            </div>
            <p id="address-hint" className="auth-hint">Nama lengkap digunakan sebagai nama penerima pada “Kirim ke”.</p>
            {errors.address && <p id="address-error" className="auth-error">{errors.address}</p>}
          </div>}
          {field('email', 'Email', 'email', isRegister ? 'email' : 'username', 'nama@contoh.com')}
          {field('password', 'Kata sandi', 'password', isRegister ? 'new-password' : 'current-password', 'Masukkan kata sandi')}
          {isRegister && field('confirmPassword', 'Konfirmasi kata sandi', 'password', 'new-password', 'Ulangi kata sandi')}
          {notice && <p className="auth-submit-notice" role="status">{notice}</p>}
          <button className="shop-primary auth-submit" type="submit">{isRegister ? 'Daftar akun' : 'Masuk'}</button>
        </form>
        <p className="auth-switch">{isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'} <a href={isRegister ? '#/login' : '#/daftar'}>{isRegister ? 'Masuk' : 'Daftar sekarang'}</a></p>
      </section>
    </div>
  </div>;
}
