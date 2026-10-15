import CommerceReadiness from './CommerceReadiness';
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
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const form = useRef(null);
  const logoInput = useRef(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  useUnsavedChanges(dirty, undefined, busy);
  const update = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors({});
    setNotice('');
  };
  const submit = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    const validation = companyProfileErrors(draft);
    setErrors(validation);
    setNotice('');
    setFailure('');
    if (Object.keys(validation).length) {
      const firstError = Object.keys(validation)[0];
      form.current
        ?.querySelector(firstError === 'logo' ? '.company-upload-button' : `#company-${firstError}`)
        ?.focus();
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const result = await saveCompany(draft);
      setConflict(Boolean(result.conflict));
      if (result.error) setFailure(result.error);
      else {
        const saved = Object.fromEntries(
          Object.entries(draft).map(([key, value]) => [
            key,
            typeof value === 'string' ? value.trim() : value,
          ]),
        );
        setDraft(saved);
        setBaseline(saved);
        setNotice('Pengaturan perusahaan tersimpan di server. Tampilan toko sudah diperbarui.');
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const reload = async () => {
    if (
      pending.current ||
      (dirty && !window.confirm('Ganti isian dengan pengaturan terbaru dari server?'))
    )
      return;
    pending.current = true;
    setBusy(true);
    try {
      const profile = await refreshCompany();
      setDraft({ ...profile });
      setBaseline({ ...profile });
      setConflict(false);
      setFailure('');
      setErrors({});
      setNotice('Pengaturan terbaru berhasil dimuat.');
    } catch (error) {
      setFailure(error.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || pending.current) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 1048576 ||
      !file.size
    ) {
      setErrors({ logo: 'Gunakan JPG, PNG, atau WebP, maksimal 1 MB.' });
      return;
    }
    pending.current = true;
    setBusy(true);
    setNotice('');
    try {
      const src = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Logo belum dapat dibaca.'));
        reader.readAsDataURL(file);
      });
      update('logo', src);
    } catch (error) {
      setErrors({ logo: error.message });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const field = (key, label, max, multiline = false, full = false) => (
    <div className={'admin-field' + (multiline || full ? ' admin-full' : '')}>
      <label htmlFor={'company-' + key}>{label}</label>
      {multiline ? (
        <textarea
          id={'company-' + key}
          rows={2}
          maxLength={max}
          value={draft[key]}
          onChange={(event) => update(key, event.target.value)}
          aria-invalid={Boolean(errors[key])}
          aria-describedby={errors[key] ? 'company-error-' + key : undefined}
        />
      ) : (
        <input
          id={'company-' + key}
          type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
          maxLength={max}
          value={draft[key]}
          onChange={(event) => update(key, event.target.value)}
          aria-invalid={Boolean(errors[key])}
          aria-describedby={errors[key] ? 'company-error-' + key : undefined}
        />
      )}
      {errors[key] && (
        <small className="admin-error" id={'company-error-' + key}>
          {errors[key]}
        </small>
      )}
    </div>
  );
  return (
    <section className="admin-company-page">
      {company.commerce?.version === 31 && <CommerceReadiness />}
      <div className="company-mode-note">
        <strong>
          {company.mode === 'company' ? 'Instalasi perusahaan' : 'Instalasi BAM / demo'}
        </strong>
        <p>
          {company.mode === 'company'
            ? 'Katalog perusahaan ini dimulai kosong. Isi identitas toko, pemasok, kategori, merek, lalu produk Anda.'
            : 'Data katalog yang sudah ada tetap digunakan. Pengaturan ini mengubah identitas toko.'}
        </p>
        <p>
          {workflowUsesServer
            ? 'Identitas, akun, katalog, pesanan, dan stok tersimpan di server. Pembayaran serta kurir belum terhubung otomatis.'
            : 'Identitas, akun, dan katalog tersimpan di server. Pesanan, stok, dan pembayaran masih simulasi pada tab browser.'}
        </p>
      </div>
      {!company.available && (
        <p className="admin-form-alert" role="alert">
          Server belum mendukung pengaturan perusahaan. Perbarui dan jalankan ulang server.
        </p>
      )}
      <form
        ref={form}
        className="admin-panel company-settings-form"
        onSubmit={submit}
        noValidate
        aria-busy={busy}
      >
        <fieldset className="admin-submit-lock" disabled={busy || !company.available}>
          <div className="admin-panel-heading">
            <div>
              <h2>Identitas perusahaan</h2>
              <p>
                Nama toko dan nama perusahaan wajib diisi. Kontak dan logo dapat dilengkapi nanti.
              </p>
            </div>
            <span className="admin-result-pill">{dirty ? 'Belum disimpan' : 'Tersimpan'}</span>
          </div>
          <div className="company-settings-body">
            <div className="company-settings-layout">
              <section className="company-logo-settings" aria-labelledby="company-logo-title">
                <div className="company-section-heading">
                  <h3 id="company-logo-title">Logo toko</h3>
                  <p>Identitas yang tampil di samping nama toko.</p>
                </div>
                <div className="company-logo-preview">
                  {draft.logo ? (
                    <img src={draft.logo} alt="Pratinjau logo perusahaan" />
                  ) : (
                    <strong>{draft.shortName || 'Logo toko'}</strong>
                  )}
                </div>
                <button
                  type="button"
                  className="admin-primary company-upload-button"
                  onClick={() => logoInput.current?.click()}
                  aria-describedby={
                    'company-logo-help' + (errors.logo ? ' company-error-logo' : '')
                  }
                >
                  {draft.logo ? 'Ganti logo' : 'Pilih logo'}
                </button>
                <input
                  ref={logoInput}
                  id="company-logo"
                  type="file"
                  hidden
                  aria-label="Logo perusahaan"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={upload}
                  aria-invalid={Boolean(errors.logo)}
                  aria-describedby={
                    'company-logo-help' + (errors.logo ? ' company-error-logo' : '')
                  }
                />
                <small id="company-logo-help">JPG, PNG, atau WebP · Maks. 1 MB.</small>
                {draft.logo && (
                  <button
                    type="button"
                    className="admin-text-button"
                    onClick={() => update('logo', '')}
                  >
                    Hapus logo
                  </button>
                )}
                {errors.logo && (
                  <small className="admin-error" role="alert" id="company-error-logo">
                    {errors.logo}
                  </small>
                )}
              </section>
              <div className="company-profile-sections">
                <section
                  className="company-settings-section"
                  aria-labelledby="company-profile-title"
                >
                  <div className="company-section-heading">
                    <h3 id="company-profile-title">Profil toko</h3>
                    <p>Nama dan deskripsi yang akan dilihat pelanggan.</p>
                  </div>
                  <div className="admin-form-grid">
                    {field('shortName', 'Nama toko *', 30)}
                    {field('legalName', 'Nama perusahaan *', 100)}
                    {field('description', 'Deskripsi toko', 300, true)}
                  </div>
                </section>
                <section
                  className="company-settings-section"
                  aria-labelledby="company-contact-title"
                >
                  <div className="company-section-heading">
                    <h3 id="company-contact-title">Alamat & kontak</h3>
                    <p>Lengkapi informasi agar pelanggan mudah menghubungi toko.</p>
                  </div>
                  <div className="admin-form-grid">
                    {field('address', 'Alamat perusahaan', 500, true)}
                    {field('email', 'Email layanan pelanggan', 254)}
                    {field('phone', 'Nomor telepon', 30)}
                  </div>
                </section>
              </div>
            </div>
            <section
              className="company-settings-section company-settings-divider"
              aria-labelledby="company-payment-title"
            >
              <div className="company-section-heading">
                <h3 id="company-payment-title">Pembayaran toko</h3>
                <p>Pilih cara pembayaran yang tersedia untuk pelanggan.</p>
              </div>
              <div className="company-payment-layout">
                <label className="company-toggle" htmlFor="company-codEnabled">
                  <input
                    id="company-codEnabled"
                    type="checkbox"
                    checked={draft.codEnabled !== false}
                    onChange={(event) => update('codEnabled', event.target.checked)}
                    aria-describedby="company-cod-help"
                  />
                  <span className="company-toggle-copy">
                    <strong>Aktifkan COD</strong>
                    <span id="company-cod-help">Pelanggan membayar saat pesanan diterima.</span>
                  </span>
                </label>
                <div className="company-bank-settings">
                  <div className="company-bank-heading">
                    <h4>Transfer bank</h4>
                    <p>
                      Lengkapi nama bank, nomor rekening, dan pemilik rekening untuk mengaktifkan
                      transfer. Rekening ditampilkan setelah penawaran disetujui toko.
                    </p>
                  </div>
                  <div className="admin-form-grid">
                    {field('bankName', 'Nama bank tujuan', 80)}
                    {field('bankAccount', 'Nomor rekening', 40)}
                    {field('bankHolder', 'Nama pemilik rekening', 100, false, true)}
                    {field('bankInstructions', 'Petunjuk transfer', 500, true)}
                  </div>
                </div>
              </div>
            </section>
            <section
              className="company-settings-section company-settings-divider"
              aria-labelledby="company-visibility-title"
            >
              <div className="company-section-heading">
                <h3 id="company-visibility-title">Informasi produk untuk pengunjung</h3>
                <p>Atur informasi stok dan penjualan yang terlihat di halaman produk.</p>
              </div>
              <div className="company-visibility-options">
                <label className="company-toggle" htmlFor="company-showSoldCount">
                  <input
                    id="company-showSoldCount"
                    type="checkbox"
                    checked={draft.showSoldCount === true}
                    onChange={(event) => update('showSoldCount', event.target.checked)}
                    aria-describedby="company-sold-help"
                  />
                  <span className="company-toggle-copy">
                    <strong>Tampilkan angka terjual yang dibulatkan</strong>
                    <span id="company-sold-help">
                      Penjualan per ukuran dan stok yang sedang ditahan tetap hanya untuk admin.
                    </span>
                  </span>
                </label>
                <label className="company-toggle" htmlFor="company-showExactStock">
                  <input
                    id="company-showExactStock"
                    type="checkbox"
                    checked={draft.showExactStock !== false}
                    onChange={(event) => update('showExactStock', event.target.checked)}
                    aria-describedby="company-stock-help"
                  />
                  <span className="company-toggle-copy">
                    <strong>Tampilkan jumlah sisa stok</strong>
                    <span id="company-stock-help">
                      Jika dimatikan, pembeli melihat Tersedia atau Habis. Jumlah pesanan tetap
                      diperiksa oleh toko.
                    </span>
                  </span>
                </label>
              </div>
            </section>
            {failure && (
              <p className="admin-form-alert" role="alert">
                {failure}
              </p>
            )}
            {notice && (
              <p className="admin-save-notice" role="status">
                ✓ {notice}
              </p>
            )}
          </div>
          <div className="company-settings-actions">
            <button type="submit" className="admin-primary" disabled={!dirty || conflict}>
              {busy ? 'Menyimpan…' : 'Simpan pengaturan'}
            </button>
            <button type="button" className="admin-text-button" onClick={reload}>
              Muat pengaturan terbaru
            </button>
            <a href="#/">Lihat toko →</a>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
