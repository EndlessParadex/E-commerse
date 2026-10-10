import { useEffect, useRef, useState } from 'react';
import { validateDelivery } from '../state/deliveryModel';
import { useDelivery } from '../state/useDelivery';
import AccountMenu from '../components/account/AccountMenu';
import { ActionIcon } from '../components/shop/ShopIcon';
import './AccountPage.css';
import useUnsavedChanges from '../state/useUnsavedChanges';

export default function AccountPage() {
  const { user, savedLocation, saveLocation, authLoading, authError } = useDelivery();
  const [values, setValues] = useState(() => user ? { namaToko: user.name, namaJalan: user.address } : { namaToko: '', namaJalan: '' });
  const [edited, setEdited] = useState(false);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  useUnsavedChanges(edited, undefined, saving);

  useEffect(() => {
    if (user && !edited) {
      // oxlint-disable-next-line react/set-state-in-effect
      setValues({ namaToko: user.name, namaJalan: user.address });
    }
  }, [user, edited]);

  const update = (field, value) => {
    setEdited(true);
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice('');
  };

  const save = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    const nextErrors = validateDelivery(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { document.getElementById(nextErrors.namaToko ? 'account-name' : 'account-address')?.focus(); return; }
    pending.current = true;
    setSaving(true);
    let result;
    try { result = await saveLocation(values); }
    catch { result = { ok: false }; }
    finally { pending.current = false; setSaving(false); }
    if (!result.ok) {
      setNotice('Perubahan belum dapat dikonfirmasi. Periksa koneksi server lalu muat ulang untuk memeriksa hasilnya; isian tetap tersedia.');
      return;
    }
    setEdited(false);
    setNotice('Nama dan alamat berhasil diperbarui.');
  };

  if (authLoading) return <div className="account-page" role="status"><h1>Memuat akun…</h1></div>;

  return <div className="account-page">
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><span aria-current="page">Akun saya</span></nav>
    <section className="account-navigation-card" aria-label="Navigasi akun"><AccountMenu profileActive /></section>
    {authError && <p className="shop-warning" role="alert">{authError}</p>}
    {!user ? <section className="account-guest-card"><div className="account-page-icon" aria-hidden="true"><ActionIcon account /></div><h1>Masuk untuk mengelola akun</h1><p>Setelah masuk, Anda dapat mengatur nama dan alamat yang digunakan pada “Kirim ke”. Pesanan simulasi dan favorit browser tetap bisa dibuka melalui menu di atas.</p><div className="account-page-actions"><a className="shop-primary" href="#/login">Masuk</a><a className="account-page-secondary" href="#/daftar">Daftar akun baru</a></div></section> : <div className="account-page-layout">
      <section className="account-profile-card" aria-labelledby="account-title"><div className="account-profile-heading"><div className="account-page-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</div><div><span className="section-eyebrow">Profil pengguna</span><h1 id="account-title">{user.name}</h1><p>{user.email}</p></div></div><div className="account-divider" /><form onSubmit={save} noValidate><h2>Alamat pengiriman</h2><p className="account-form-copy">Alamat ini akan digunakan sebagai alamat utama pada popup “Kirim ke” dan checkout.</p><div className="account-field"><label htmlFor="account-name">Nama penerima</label><input id="account-name" disabled={saving} type="text" autoComplete="name" maxLength={100} value={values.namaToko} onChange={(event) => update('namaToko', event.target.value)} aria-invalid={Boolean(errors.namaToko)} aria-describedby={errors.namaToko ? 'account-name-error' : undefined} />{errors.namaToko && <p className="account-error" id="account-name-error">{errors.namaToko}</p>}</div><div className="account-field"><label htmlFor="account-address">Alamat lengkap</label><textarea id="account-address" disabled={saving} rows={4} maxLength={500} autoComplete="street-address" value={values.namaJalan} onChange={(event) => update('namaJalan', event.target.value)} aria-invalid={Boolean(errors.namaJalan)} aria-describedby={errors.namaJalan ? 'account-address-error' : undefined} />{errors.namaJalan && <p className="account-error" id="account-address-error">{errors.namaJalan}</p>}</div>{notice && <p className={'account-notice' + (notice.startsWith('Perubahan') ? ' is-error' : '')} role="status">{notice}</p>}<button className="shop-primary account-save" type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan perubahan'}</button></form></section>
      <aside className="account-info-card"><h2>Keamanan akun</h2><p>Email digunakan untuk masuk ke akun Anda. Perubahan alamat hanya berlaku untuk akun Anda sendiri.</p><div className="account-info-row"><span>Status</span><strong>Aktif</strong></div><div className="account-info-row"><span>Alamat tersimpan</span><strong>{savedLocation ? 'Siap digunakan' : 'Belum ada'}</strong></div></aside>
    </div>}
  </div>;
}
