import useCompany from '../state/useCompany';
import { useEffect, useRef, useState } from 'react';
import { validateDelivery } from '../state/deliveryModel';
import { useDelivery } from '../state/useDelivery';
import AccountMenu from '../components/account/AccountMenu';
import AppearanceSettings from '../components/account/AppearanceSettings';
import AccountSecurity from '../components/account/AccountSecurity';
import AccountAvatar from '../components/account/AccountAvatar';
import AccountPhone from '../components/account/AccountPhone';
import AccountEmailStatus from '../components/account/AccountEmailStatus';
import PhotoUpload from '../components/PhotoUpload';
import { ActionIcon } from '../components/shop/ShopIcon';
import useUnsavedChanges from '../state/useUnsavedChanges';
import './AccountPage.css';

const tabs = [
  { id: 'profile', label: 'Profil' },
  { id: 'address', label: 'Alamat' },
  { id: 'appearance', label: 'Tampilan' },
  { id: 'security', label: 'Keamanan' },
];

export default function AccountPage() {
  const { profile: companyProfile } = useCompany();
  const { user, savedLocation, saveLocation, saveAvatar, authLoading, authError } = useDelivery();
  const [photoNotice, setPhotoNotice] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [values, setValues] = useState(() =>
    user
      ? { namaToko: user.name, namaJalan: user.address, storeName: user.storeName || '' }
      : { namaToko: '', namaJalan: '', storeName: '' },
  );
  const [edited, setEdited] = useState(false);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const tabButtons = useRef([]);
  useUnsavedChanges(edited, undefined, saving || photoBusy);

  useEffect(() => {
    if (user && !edited) {
      // oxlint-disable-next-line react/set-state-in-effect
      setValues({ namaToko: user.name, namaJalan: user.address, storeName: user.storeName || '' });
    }
  }, [user, edited]);

  const selectTab = (id, focus = false) => {
    setActiveTab(id);
    if (focus) tabButtons.current[tabs.findIndex((tab) => tab.id === id)]?.focus();
  };
  const navigateTab = (event, index) => {
    const next = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectTab(tabs[next].id, true);
  };
  const update = (field, value) => {
    setEdited(true);
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice('');
  };

  const save = async (event) => {
    event.preventDefault();
    if (pending.current || photoBusy) return;
    const nextErrors = validateDelivery(values);
    const storeName = values.storeName.trim();
    if (storeName.length > 100 || (storeName.length > 0 && storeName.length < 2))
      nextErrors.storeName = 'Nama toko harus kosong atau berisi 2–100 karakter.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      selectTab('address');
      document
        .getElementById(
          nextErrors.storeName
            ? 'account-store-name'
            : nextErrors.namaToko
              ? 'account-name'
              : 'account-address',
        )
        ?.focus();
      return;
    }
    pending.current = true;
    setSaving(true);
    let result;
    try {
      result = await saveLocation(values);
    } catch {
      result = { ok: false };
    } finally {
      pending.current = false;
      setSaving(false);
    }
    if (!result.ok) {
      setNotice(
        'Perubahan belum dapat dikonfirmasi. Periksa koneksi server lalu muat ulang untuk memeriksa hasilnya; isian tetap tersedia.',
      );
      return;
    }
    setEdited(false);
    setNotice('Informasi akun, nama toko, dan alamat berhasil diperbarui.');
  };

  if (authLoading)
    return (
      <div className="account-page" role="status">
        <h1>Memuat akun…</h1>
      </div>
    );

  return (
    <div className="account-page">
      <nav className="shop-breadcrumb" aria-label="Breadcrumb">
        <a href="#/">Beranda</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Akun saya</span>
      </nav>
      {authError && (
        <p className="shop-warning" role="alert">
          {authError}
        </p>
      )}
      {!user ? (
        <>
          <section className="account-navigation-card" aria-label="Navigasi akun">
            <AccountMenu />
          </section>
          <section className="account-guest-card">
            <div className="account-page-icon" aria-hidden="true">
              <ActionIcon account />
            </div>
            <h1>Masuk untuk mengelola akun</h1>
            <p>
              Setelah masuk, Anda dapat mengatur nama, alamat pengiriman, dan tampilan{' '}
              {companyProfile.shortName}.
            </p>
            <div className="account-page-actions">
              <a className="shop-primary" href="#/login">
                Masuk
              </a>
              <a className="account-page-secondary" href="#/daftar">
                Daftar akun baru
              </a>
            </div>
          </section>
        </>
      ) : (
        <>
          <header className="account-page-heading">
            <span className="section-eyebrow">Ruang pribadi Anda</span>
            <h1>Akun saya</h1>
            <p>Kelola profil, alamat pengiriman, dan kenyamanan tampilan.</p>
          </header>
          <div className="account-workspace">
            <aside className="account-sidebar" aria-label="Navigasi akun">
              <div className="account-sidebar-identity">
                <AccountAvatar user={user} className="account-page-avatar" />
                <div>
                  <strong>{user.name}</strong>
                  <span>
                    {user.role === 'admin'
                      ? `Admin ${companyProfile.shortName}`
                      : `Pelanggan ${companyProfile.shortName}`}
                  </span>
                </div>
              </div>
              <AccountMenu profileActive />
            </aside>
            <div className="account-content">
              <div className="account-tabs" role="tablist" aria-label="Pengaturan akun">
                {tabs.map((tab, index) => (
                  <button
                    key={tab.id}
                    ref={(element) => {
                      tabButtons.current[index] = element;
                    }}
                    id={`account-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls={`account-panel-${tab.id}`}
                    tabIndex={activeTab === tab.id ? 0 : -1}
                    onClick={() => selectTab(tab.id)}
                    onKeyDown={(event) => navigateTab(event, index)}
                  >
                    {tab.label}
                    {tab.id === 'address' && edited && (
                      <span className="account-draft-dot" aria-label="Perubahan belum disimpan" />
                    )}
                  </button>
                ))}
              </div>
              <section
                id="account-panel-profile"
                className="account-tab-panel"
                role="tabpanel"
                aria-labelledby="account-tab-profile"
                tabIndex={0}
                hidden={activeTab !== 'profile'}
              >
                <div className="account-panel-heading">
                  <h2>Profil pengguna</h2>
                  <p>Informasi akun yang Anda gunakan untuk berbelanja.</p>
                </div>
                <div className="account-profile-layout">
                  <div className="account-avatar-card">
                    <AccountAvatar user={user} className="account-avatar-large" />
                    <PhotoUpload
                      id="account-photo"
                      label="Foto profil"
                      value={user.avatar || ''}
                      disabled={saving}
                      onBusyChange={setPhotoBusy}
                      onChange={async (avatar) => {
                        setPhotoNotice('');
                        const result = await saveAvatar(avatar);
                        if (!result.ok) throw new Error(result.error);
                        setPhotoNotice(
                          avatar
                            ? 'Foto profil berhasil disimpan.'
                            : 'Foto profil berhasil dihapus.',
                        );
                      }}
                    />
                    {photoNotice && <p role="status">{photoNotice}</p>}
                  </div>
                  <div className="account-profile-details">
                    <dl className="account-biodata">
                      <div>
                        <dt>Nama</dt>
                        <dd>{user.name}</dd>
                      </div>
                      <div>
                        <dt>Email</dt>
                        <dd>
                          {user.email}
                          <AccountEmailStatus key={user.id} />
                        </dd>
                      </div>
                      <div>
                        <dt>Jenis akun</dt>
                        <dd>
                          {user.role === 'admin'
                            ? `Admin ${companyProfile.shortName}`
                            : `Pelanggan ${companyProfile.shortName}`}
                        </dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      className="account-page-secondary"
                      onClick={() => selectTab('address', true)}
                    >
                      Ubah nama dan alamat <span aria-hidden="true">→</span>
                    </button>
                    <p className="account-profile-help">
                      Email digunakan untuk masuk ke akun Anda.
                    </p>
                    <AccountPhone key={user.id} />
                  </div>
                </div>
                <div className="account-address-preview">
                  <div>
                    <span>Alamat pengiriman utama</span>
                    <p>{savedLocation?.namaJalan || user.address || 'Alamat belum ditambahkan.'}</p>
                  </div>
                  <button type="button" onClick={() => selectTab('address', true)}>
                    Kelola alamat <span aria-hidden="true">→</span>
                  </button>
                </div>
              </section>
              <section
                id="account-panel-address"
                className="account-tab-panel account-profile-card"
                role="tabpanel"
                aria-labelledby="account-tab-address"
                tabIndex={0}
                hidden={activeTab !== 'address'}
              >
                <form onSubmit={save} noValidate>
                  <div className="account-panel-heading">
                    <h2>Alamat pengiriman</h2>
                    <p>
                      Nama toko tampil pada “Kirim ke”; nama penerima dan alamat tetap digunakan
                      untuk checkout.
                    </p>
                  </div>
                  <div className="account-field">
                    <label htmlFor="account-store-name">Nama toko (opsional)</label>
                    <input
                      id="account-store-name"
                      disabled={saving}
                      type="text"
                      maxLength={100}
                      value={values.storeName}
                      onChange={(event) => update('storeName', event.target.value)}
                      placeholder="Contoh: Toko Endless"
                      aria-invalid={Boolean(errors.storeName)}
                      aria-describedby={errors.storeName ? 'account-store-name-error' : undefined}
                    />
                    {errors.storeName && (
                      <p className="account-error" id="account-store-name-error">
                        {errors.storeName}
                      </p>
                    )}
                    <p className="account-profile-help">
                      Kosongkan jika tidak memiliki toko. Nama pribadi tetap terpisah.
                    </p>
                  </div>
                  <div className="account-field">
                    <label htmlFor="account-name">Nama penerima</label>
                    <input
                      id="account-name"
                      disabled={saving}
                      type="text"
                      autoComplete="name"
                      maxLength={100}
                      value={values.namaToko}
                      onChange={(event) => update('namaToko', event.target.value)}
                      aria-invalid={Boolean(errors.namaToko)}
                      aria-describedby={errors.namaToko ? 'account-name-error' : undefined}
                    />
                    {errors.namaToko && (
                      <p className="account-error" id="account-name-error">
                        {errors.namaToko}
                      </p>
                    )}
                  </div>
                  <div className="account-field">
                    <label htmlFor="account-address">Alamat lengkap</label>
                    <textarea
                      id="account-address"
                      disabled={saving}
                      rows={4}
                      maxLength={500}
                      autoComplete="street-address"
                      value={values.namaJalan}
                      onChange={(event) => update('namaJalan', event.target.value)}
                      aria-invalid={Boolean(errors.namaJalan)}
                      aria-describedby={errors.namaJalan ? 'account-address-error' : undefined}
                    />
                    {errors.namaJalan && (
                      <p className="account-error" id="account-address-error">
                        {errors.namaJalan}
                      </p>
                    )}
                  </div>
                  {notice && (
                    <p
                      className={
                        'account-notice' + (notice.startsWith('Perubahan') ? ' is-error' : '')
                      }
                      role="status"
                    >
                      {notice}
                    </p>
                  )}
                  <div className="account-form-footer">
                    <span>
                      {edited
                        ? 'Ada perubahan yang belum disimpan.'
                        : 'Perubahan alamat hanya berlaku untuk akun Anda.'}
                    </span>
                    <button
                      className="shop-primary account-save"
                      type="submit"
                      disabled={saving || photoBusy}
                    >
                      {saving ? 'Menyimpan…' : 'Simpan perubahan'}
                    </button>
                  </div>
                </form>
              </section>
              <section
                id="account-panel-appearance"
                className="account-tab-panel"
                role="tabpanel"
                aria-labelledby="account-tab-appearance"
                tabIndex={0}
                hidden={activeTab !== 'appearance'}
              >
                <AppearanceSettings />
              </section>
              <section
                id="account-panel-security"
                className="account-tab-panel"
                role="tabpanel"
                aria-labelledby="account-tab-security"
                tabIndex={0}
                hidden={activeTab !== 'security'}
              >
                <AccountSecurity key={user.id} />
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
