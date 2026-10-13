import { useRef, useState } from 'react';
import { workflowUsesServer } from '../data/adminStore';
import useCompany from '../state/useCompany';
import useUnsavedChanges from '../state/useUnsavedChanges';
import { companyProfileErrors } from '../data/companyProfile';
import { saveCompany, refreshCompany } from '../data/companyStore';
import './AdminCompanyPage.css';

export default function AdminCompanyPage() {
  const company = useCompany();
  const [draft, setDraft] = useState(() => ({ ...company.profile }));
  const [baseline, setBaseline] = useState(() => ({ ...company.profile }));
  const [errors, setErrors] = useState({}); const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState(''); const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false); const pending = useRef(false); const form = useRef(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  useUnsavedChanges(dirty, undefined, busy);
  const update = (field, value) => { setDraft((current) => ({ ...current, [field]: value })); setErrors({}); setNotice(''); };
  const submit = async (event) => {
    event.preventDefault(); if (pending.current) return;
    const validation = companyProfileErrors(draft); setErrors(validation); setNotice(''); setFailure('');
    if (Object.keys(validation).length) { form.current?.querySelector(`#company-${Object.keys(validation)[0]}`)?.focus(); return; }
    pending.current = true; setBusy(true);
    try {
      const result = await saveCompany(draft); setConflict(Boolean(result.conflict));
      if (result.error) setFailure(result.error);
      else { const saved = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()])); setDraft(saved); setBaseline(saved); setNotice('Pengaturan perusahaan tersimpan di server. Tampilan toko sudah diperbarui.'); }
    } finally { pending.current = false; setBusy(false); }
  };
  const reload = async () => {
    if (pending.current || (dirty && !window.confirm('Ganti isian dengan pengaturan terbaru dari server?'))) return;
    pending.current = true; setBusy(true);
    try { const profile = await refreshCompany(); setDraft({ ...profile }); setBaseline({ ...profile }); setConflict(false); setFailure(''); setErrors({}); setNotice('Pengaturan terbaru berhasil dimuat.'); }
    catch (error) { setFailure(error.message); }
    finally { pending.current = false; setBusy(false); }
  };
  const upload = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file || pending.current) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1048576 || !file.size) { setErrors({ logo: 'Gunakan JPG, PNG, atau WebP, maksimal 1 MB.' }); return; }
    pending.current = true; setBusy(true); setNotice('');
    try {
      const src = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Logo belum dapat dibaca.')); reader.readAsDataURL(file); });
      update('logo', src);
    } catch (error) { setErrors({ logo: error.message }); }
    finally { pending.current = false; setBusy(false); }
  };
  const field = (key, label, max, multiline = false) => <div className={'admin-field' + (multiline ? ' admin-full' : '')}><label htmlFor={'company-' + key}>{label}</label>{multiline ? <textarea id={'company-' + key} rows={3} maxLength={max} value={draft[key]} onChange={(event) => update(key, event.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? 'company-error-' + key : undefined} /> : <input id={'company-' + key} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} maxLength={max} value={draft[key]} onChange={(event) => update(key, event.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? 'company-error-' + key : undefined} />}{errors[key] && <small className="admin-error" id={'company-error-' + key}>{errors[key]}</small>}</div>;
  return <section className="admin-company-page">
    <div className="company-mode-note"><strong>{company.mode === 'company' ? 'Instalasi perusahaan' : 'Instalasi BAM / demo'}</strong><p>{company.mode === 'company' ? 'Katalog perusahaan ini dimulai kosong. Isi identitas toko, pemasok, kategori, merek, lalu produk Anda.' : 'Data katalog yang sudah ada tetap digunakan. Pengaturan ini mengubah identitas toko.'}</p><p>{workflowUsesServer ? 'Identitas, akun, katalog, pesanan, dan stok tersimpan di server. Pembayaran serta kurir belum terhubung otomatis.' : 'Identitas, akun, dan katalog tersimpan di server. Pesanan, stok, dan pembayaran masih simulasi pada tab browser.'}</p></div>
    {!company.available && <p className="admin-form-alert" role="alert">Server belum mendukung pengaturan perusahaan. Perbarui dan jalankan ulang server.</p>}
    <form ref={form} className="admin-panel company-settings-form" onSubmit={submit} noValidate>
      <fieldset className="admin-submit-lock" disabled={busy || !company.available}>
        <div className="admin-panel-heading"><div><h2>Identitas perusahaan</h2><p>Nama toko dan nama perusahaan wajib diisi. Kontak dan logo dapat dilengkapi nanti.</p></div><span className="admin-result-pill">{dirty ? 'Belum disimpan' : 'Tersimpan'}</span></div>
        <div className="company-settings-layout"><div className="company-logo-settings"><div className="company-logo-preview">{draft.logo ? <img src={draft.logo} alt="Pratinjau logo perusahaan" /> : <strong>{draft.shortName || 'Logo toko'}</strong>}</div><label className="admin-primary company-upload-label" htmlFor="company-logo">Pilih logo</label><input id="company-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} aria-invalid={Boolean(errors.logo)} aria-describedby="company-logo-help" /><small id="company-logo-help">JPG, PNG, atau WebP · Maks. 1 MB. Logo tampil di samping nama toko.</small>{draft.logo && <button type="button" className="admin-text-button" onClick={() => update('logo', '')}>Hapus logo</button>}{errors.logo && <small className="admin-error" role="alert">{errors.logo}</small>}</div>
          <div className="admin-form-grid">{field('shortName', 'Nama toko *', 30)}{field('legalName', 'Nama perusahaan *', 100)}{field('description', 'Deskripsi toko', 300, true)}{field('address', 'Alamat perusahaan', 500, true)}{field('email', 'Email layanan pelanggan', 254)}{field('phone', 'Nomor telepon', 30)}</div></div>
        {failure && <p className="admin-form-alert" role="alert">{failure}</p>}{notice && <p className="admin-save-notice" role="status">✓ {notice}</p>}
        <div className="company-settings-actions"><button type="submit" className="admin-primary" disabled={!dirty || conflict}>{busy ? 'Menyimpan…' : 'Simpan pengaturan'}</button><button type="button" className="admin-text-button" onClick={reload}>Muat pengaturan terbaru</button><a href="#/">Lihat toko →</a></div>
      </fieldset>
    </form>
  </section>;
}
