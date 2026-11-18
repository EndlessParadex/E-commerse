import { useEffect, useId, useRef, useState } from 'react';
import { fetchAdminBanners, saveAdminBanners } from '../state/bannersApi';
import {
  BANNER_TARGETS,
  BANNER_THEMES,
  bannerSlide,
  loadBanners,
  targetName,
} from '../data/homeBanners';
import { promoSlides } from '../data/promoSlides';
import { bannerErrors, bannerStatus } from '../data/bannerAdmin';
import { products, groupProducts } from '../data/products';
import { categories } from '../data/catalog';
import { suppliers } from '../data/suppliers';
import { brands } from '../data/catalogMasters';
import { cropPhoto, shrinkProductPhoto, MAX_PHOTO_UPLOAD_BYTES } from '../data/photoCompression';
import PhotoCropDialog from '../components/PhotoCropDialog';
import ConfirmDialog from '../components/shop/ConfirmDialog';
import PromoCarousel from '../components/shop/PromoCarousel';
// The preview uses the home page's own styles, so it looks exactly like the store.
import './Home.css';
import './StorefrontDesign2.css';
import './StorefrontFeatureRail.css';
import './AdminBannersPage.css';

const newId = () => 'b-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const blank = () => ({
  id: newId(),
  active: true,
  startsOn: '',
  endsOn: '',
  label: '',
  title: '',
  description: '',
  cta: 'Lihat produk',
  target: { type: 'category', id: categories[0]?.id || '' },
  theme: 'snack',
  media: 'products',
  productIds: [],
  image: '',
  imageAlt: '',
});
/** The automatic banners, as editable entries (products stay automatic). */
const fromAutomatic = () =>
  promoSlides().map((slide) => ({
    ...blank(),
    id: ('auto-' + slide.id)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .slice(0, 40),
    label: slide.category,
    title: slide.title,
    description: slide.description,
    cta: slide.cta,
    target: slide.id === 'all' ? { type: 'catalog', id: '' } : { type: 'category', id: slide.id },
    theme: slide.theme,
  }));
const groupsByBrand = (items) => {
  const groups = new Map();
  for (const item of items) {
    const key = item.brand || 'Tanpa merek';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'id'));
};

/** Admin/Pemilik: add, edit, hide, schedule, reorder and delete home page banners. */
export default function AdminBannersPage() {
  const [state, setState] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  useEffect(() => {
    let active = true;
    fetchAdminBanners()
      .then((data) => active && (setState(data), setLoadError('')))
      .catch((failure) => active && setLoadError(failure.message));
    return () => {
      active = false;
    };
  }, [reload]);

  /** Every change saves the whole list with its revision. */
  const save = async (banners, done) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const next = await saveAdminBanners(state.revision, banners);
      setState(next);
      setMessage(done);
      loadBanners();
      return true;
    } catch (failure) {
      setError(
        failure.status === 409
          ? failure.message + ' Daftar dimuat ulang; ulangi perubahan Anda.'
          : failure.message,
      );
      if (failure.status === 409) setReload((value) => value + 1);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loadError && !state)
    return (
      <section className="admin-panel">
        <p className="admin-form-alert" role="alert">
          {loadError}
        </p>
        <button className="admin-secondary" type="button" onClick={() => setReload((v) => v + 1)}>
          Coba lagi
        </button>
      </section>
    );
  if (!state)
    return (
      <section className="admin-panel" role="status">
        Memuat banner…
      </section>
    );
  if (editing)
    return (
      <BannerEditor
        initial={editing.banner}
        isNew={editing.isNew}
        busy={busy}
        error={error}
        onCancel={() => {
          setEditing(null);
          setError('');
        }}
        onSave={async (banner) => {
          const list = editing.isNew
            ? [...state.banners, banner]
            : state.banners.map((entry) => (entry.id === banner.id ? banner : entry));
          if (await save(list, editing.isNew ? 'Banner ditambahkan.' : 'Banner disimpan.'))
            setEditing(null);
        }}
      />
    );

  const banners = state.banners;
  const live = banners.filter((banner) => bannerStatus(banner, state.today).id === 'live');
  const move = (index, step) => {
    const list = [...banners];
    const [entry] = list.splice(index, 1);
    list.splice(index + step, 0, entry);
    save(list, 'Urutan banner disimpan.');
  };
  return (
    <section className="admin-panel admin-banners" aria-labelledby="admin-banners-title">
      <div className="admin-panel-heading">
        <div>
          <h2 id="admin-banners-title">Banner beranda</h2>
          <p>
            Banner tampil bergantian di bagian atas beranda, sesuai urutan di bawah. Sembunyikan
            atau jadwalkan banner tanpa menghapusnya.
          </p>
        </div>
        <span className="admin-result-pill">
          {state.configured
            ? `${banners.length} banner · ${live.length} tampil hari ini`
            : 'Banner otomatis'}
        </span>
      </div>
      {message && (
        <p className="admin-save-notice" role="status">
          ✓ {message}
        </p>
      )}
      {error && (
        <p className="admin-form-alert" role="alert">
          {error}
        </p>
      )}
      {(!state.configured || !live.length) && (
        <p className="admin-banners-note">
          {state.configured
            ? 'Tidak ada banner yang tampil hari ini, jadi beranda memakai banner otomatis per kategori.'
            : 'Beranda sekarang memakai banner otomatis: satu banner per kategori, dengan dua produk dari kategori itu. Salin banner otomatis untuk mengubahnya, atau buat banner baru.'}
        </p>
      )}
      <div className="admin-banners-toolbar">
        <button
          className="admin-primary"
          type="button"
          disabled={busy || banners.length >= 12}
          onClick={() => {
            setMessage('');
            setEditing({ banner: blank(), isNew: true });
          }}
        >
          + Tambah banner
        </button>
        {!state.configured && (
          <button
            className="admin-secondary"
            type="button"
            disabled={busy}
            onClick={() => save(fromAutomatic(), 'Banner otomatis disalin dan siap diubah.')}
          >
            Salin banner otomatis
          </button>
        )}
        {banners.length >= 12 && (
          <span className="admin-form-hint">Maksimal 12 banner. Hapus satu untuk menambah.</span>
        )}
      </div>
      {banners.length > 0 && (
        <ol className="admin-banner-list">
          {banners.map((banner, index) => {
            const status = bannerStatus(banner, state.today);
            const title = banner.title.replace(/\n/g, ' ');
            return (
              <li key={banner.id} className={'admin-banner-row is-' + status.id}>
                <div className={'admin-banner-thumb bam-theme-' + banner.theme} aria-hidden="true">
                  {banner.media === 'image' && banner.image ? (
                    <img src={banner.image} alt="" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <div className="admin-banner-info">
                  <strong>{title}</strong>
                  <span>
                    {BANNER_TARGETS.find((entry) => entry.id === banner.target.type)?.label}
                    {banner.target.type !== 'catalog' &&
                      ': ' + (targetName(banner.target) || 'tidak ditemukan')}
                    {' · '}
                    {banner.media === 'image' ? 'Gambar' : 'Kartu produk'}
                  </span>
                  <span className={'admin-banner-status is-' + status.id}>{status.label}</span>
                </div>
                <div className="admin-banner-actions">
                  <button
                    type="button"
                    className="admin-icon-button"
                    disabled={busy || index === 0}
                    aria-label={'Naikkan ' + title}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="admin-icon-button"
                    disabled={busy || index === banners.length - 1}
                    aria-label={'Turunkan ' + title}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="admin-text-button"
                    disabled={busy}
                    onClick={() =>
                      save(
                        banners.map((entry) =>
                          entry.id === banner.id ? { ...entry, active: !entry.active } : entry,
                        ),
                        banner.active ? 'Banner disembunyikan.' : 'Banner ditampilkan lagi.',
                      )
                    }
                  >
                    {banner.active ? 'Sembunyikan' : 'Tampilkan'}
                  </button>
                  <button
                    type="button"
                    className="admin-secondary"
                    disabled={busy}
                    onClick={() => {
                      setMessage('');
                      setEditing({ banner, isNew: false });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="admin-text-button admin-danger-text"
                    disabled={busy}
                    onClick={() => setRemoving(banner)}
                  >
                    Hapus
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {removing && (
        <ConfirmDialog
          title="Hapus banner?"
          confirmLabel="Hapus banner"
          busy={busy}
          error={error}
          onClose={() => {
            setRemoving(null);
            setError('');
          }}
          onConfirm={async () => {
            if (
              await save(
                banners.filter((entry) => entry.id !== removing.id),
                'Banner dihapus.',
              )
            )
              setRemoving(null);
          }}
        >
          <p>
            “{removing.title.replace(/\n/g, ' ')}” dihapus dari beranda dan tidak dapat
            dikembalikan. Pilih Sembunyikan bila hanya ingin menyimpannya untuk nanti.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}

function BannerEditor({ initial, isNew, busy, error, onCancel, onSave }) {
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [errors, setErrors] = useState({});
  const [crop, setCrop] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef(null);
  const base = useId();
  const id = (name) => base + name;
  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const groups = groupProducts(products);

  const choosePhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoError('');
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setPhotoError('Pilih gambar JPG, PNG, atau WebP.');
      return;
    }
    if (file.size > MAX_PHOTO_UPLOAD_BYTES) {
      setPhotoError('Gambar maksimal 5 MB.');
      return;
    }
    const reader = new window.FileReader();
    reader.onload = () => setCrop(reader.result);
    reader.onerror = () => setPhotoError('Gambar tidak dapat dibaca. Pilih file lain.');
    reader.readAsDataURL(file);
  };
  const applyCrop = async (area) => {
    setPhotoBusy(true);
    setPhotoError('');
    try {
      const framed = await cropPhoto(crop, area, {
        maxSide: 1200,
        ImageClass: window.Image,
        documentRef: window.document,
      });
      const src = await shrinkProductPhoto(framed, {
        maxSide: 1200,
        ImageClass: window.Image,
        documentRef: window.document,
      });
      if (!src) {
        setPhotoError('Gambar terlalu besar untuk browser ini. Pilih gambar yang lebih kecil.');
        return;
      }
      set('image', src);
      setCrop(null);
    } catch {
      setPhotoError('Gambar tidak dapat diproses. Pilih file lain.');
    } finally {
      setPhotoBusy(false);
    }
  };
  const submit = (event) => {
    event.preventDefault();
    const found = bannerErrors(draft);
    setErrors(found);
    if (Object.keys(found).length) {
      window.requestAnimationFrame(() =>
        document.getElementById(id(Object.keys(found)[0]))?.focus(),
      );
      return;
    }
    onSave({
      ...draft,
      title: draft.title.trim(),
      label: draft.label.trim(),
      description: draft.description.trim(),
      cta: draft.cta.trim(),
      imageAlt: draft.imageAlt.trim(),
    });
  };
  const fieldError = (name) =>
    errors[name] && (
      <p className="admin-error" id={id(name) + '-error'}>
        {errors[name]}
      </p>
    );
  const targetOptions = {
    category: categories.map((entry) => [entry.id, entry.name]),
    supplier: suppliers.map((entry) => [entry.id, entry.name]),
    brand: brands.map((entry) => [entry.id, entry.name]),
  }[draft.target.type];

  return (
    <section className="admin-panel admin-banner-editor" aria-labelledby={id('heading')}>
      <div className="admin-panel-heading">
        <div>
          <h2 id={id('heading')}>{isNew ? 'Tambah banner' : 'Edit banner'}</h2>
          <p>Perubahan tampil di beranda setelah disimpan.</p>
        </div>
      </div>
      <form onSubmit={submit} noValidate className="admin-banner-form">
        <fieldset disabled={busy} className="admin-banner-fields">
          <legend className="visually-hidden">Isi banner</legend>
          <h3 className="admin-banner-section">Teks banner</h3>
          <div className="admin-field">
            <label htmlFor={id('label')}>Label kecil (opsional)</label>
            <input
              id={id('label')}
              maxLength={60}
              value={draft.label}
              placeholder={targetName(draft.target) || 'Contoh: Promo minggu ini'}
              onChange={(event) => set('label', event.target.value)}
            />
            <p className="admin-form-hint">Kosongkan untuk memakai nama tujuan tombol.</p>
          </div>
          <div className="admin-field">
            <label htmlFor={id('title')}>Judul *</label>
            <textarea
              id={id('title')}
              rows={2}
              maxLength={90}
              value={draft.title}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={id('title') + '-hint'}
              onChange={(event) => set('title', event.target.value)}
            />
            <p className="admin-form-hint" id={id('title') + '-hint'}>
              Paling banyak 2 baris (tekan Enter untuk baris baru). Baris kedua tampil berwarna.
            </p>
            {fieldError('title')}
          </div>
          <div className="admin-field">
            <label htmlFor={id('description')}>Deskripsi</label>
            <textarea
              id={id('description')}
              rows={2}
              maxLength={220}
              value={draft.description}
              onChange={(event) => set('description', event.target.value)}
            />
          </div>

          <h3 className="admin-banner-section">Tombol</h3>
          <div className="admin-banner-grid">
            <div className="admin-field">
              <label htmlFor={id('cta')}>Teks tombol *</label>
              <input
                id={id('cta')}
                maxLength={30}
                value={draft.cta}
                aria-invalid={Boolean(errors.cta)}
                onChange={(event) => set('cta', event.target.value)}
              />
              {fieldError('cta')}
            </div>
            <div className="admin-field">
              <label htmlFor={id('targetType')}>Tombol menuju</label>
              <select
                id={id('targetType')}
                value={draft.target.type}
                onChange={(event) =>
                  set('target', {
                    type: event.target.value,
                    id:
                      event.target.value === 'category'
                        ? categories[0]?.id || ''
                        : event.target.value === 'supplier'
                          ? suppliers[0]?.id || ''
                          : event.target.value === 'brand'
                            ? brands[0]?.id || ''
                            : '',
                  })
                }
              >
                {BANNER_TARGETS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>
            {draft.target.type !== 'catalog' && (
              <div className="admin-field">
                <label htmlFor={id('target')}>
                  {BANNER_TARGETS.find((entry) => entry.id === draft.target.type).label} tujuan
                </label>
                <select
                  id={id('target')}
                  value={draft.target.id}
                  aria-invalid={Boolean(errors.target)}
                  onChange={(event) =>
                    set('target', { type: draft.target.type, id: event.target.value })
                  }
                >
                  <option value="">Pilih…</option>
                  {draft.target.type === 'product'
                    ? groupsByBrand(groups).map(([brand, items]) => (
                        <optgroup key={brand} label={brand}>
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.baseName || item.name}
                            </option>
                          ))}
                        </optgroup>
                      ))
                    : targetOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                </select>
                {fieldError('target')}
              </div>
            )}
          </div>

          <h3 className="admin-banner-section">Tampilan</h3>
          <div className="admin-field">
            <span className="admin-field-label" id={id('theme-label')}>
              Warna latar
            </span>
            <div
              className="admin-banner-choices"
              role="radiogroup"
              aria-labelledby={id('theme-label')}
            >
              {BANNER_THEMES.map((theme) => (
                <label key={theme.id} className={'admin-banner-choice bam-theme-' + theme.id}>
                  <input
                    type="radio"
                    name={id('theme')}
                    checked={draft.theme === theme.id}
                    onChange={() => set('theme', theme.id)}
                  />
                  <span>{theme.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="admin-field">
            <span className="admin-field-label" id={id('media-label')}>
              Sisi kanan banner
            </span>
            <div
              className="admin-banner-choices"
              role="radiogroup"
              aria-labelledby={id('media-label')}
            >
              {[
                ['products', 'Kartu produk'],
                ['image', 'Gambar / poster'],
              ].map(([value, label]) => (
                <label key={value} className="admin-banner-choice">
                  <input
                    type="radio"
                    name={id('media')}
                    checked={draft.media === value}
                    onChange={() => set('media', value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
          {draft.media === 'products' ? (
            <div className="admin-banner-grid">
              {[0, 1].map((slot) => (
                <div className="admin-field" key={slot}>
                  <label htmlFor={id('product' + slot)}>Produk {slot + 1}</label>
                  <select
                    id={id('product' + slot)}
                    value={draft.productIds[slot] || ''}
                    disabled={slot === 1 && !draft.productIds[0]}
                    onChange={(event) => {
                      const next = [...draft.productIds];
                      next[slot] = event.target.value;
                      set('productIds', next.filter(Boolean));
                    }}
                  >
                    <option value="">
                      {slot === 0 ? 'Otomatis dari tujuan tombol' : 'Tidak ada'}
                    </option>
                    {groupsByBrand(products).map(([brand, items]) => (
                      <optgroup key={brand} label={brand}>
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              ))}
              <p className="admin-form-hint admin-full">
                Otomatis: dua produk dari tujuan tombol, ukuran termurah.
              </p>
            </div>
          ) : (
            <div className="admin-field">
              <span className="admin-field-label">Gambar banner *</span>
              <div className="admin-banner-photo">
                {draft.image ? (
                  <img src={draft.image} alt="" />
                ) : (
                  <span className="admin-banner-photo-empty">Belum ada gambar</span>
                )}
                <div className="admin-banner-photo-actions">
                  <button
                    type="button"
                    className="admin-secondary"
                    disabled={photoBusy}
                    aria-describedby={id('image') + '-hint'}
                    id={id('image')}
                    onClick={() => fileRef.current?.click()}
                  >
                    {draft.image ? 'Ganti gambar' : 'Unggah gambar'}
                  </button>
                  {draft.image && (
                    <button
                      type="button"
                      className="admin-text-button"
                      onClick={() => setCrop(draft.image)}
                    >
                      Atur posisi
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={choosePhoto}
                  aria-label="Pilih gambar banner"
                />
              </div>
              <p className="admin-form-hint" id={id('image') + '-hint'}>
                JPG, PNG, atau WebP, maksimal 5 MB. Gambar dipotong persegi; atur posisinya setelah
                memilih.
              </p>
              {photoError && (
                <p className="admin-error" role="alert">
                  {photoError}
                </p>
              )}
              {fieldError('image')}
              <label htmlFor={id('imageAlt')}>Keterangan gambar (untuk pembaca layar)</label>
              <input
                id={id('imageAlt')}
                maxLength={150}
                value={draft.imageAlt}
                placeholder="Contoh: Poster promo snack akhir tahun"
                onChange={(event) => set('imageAlt', event.target.value)}
              />
            </div>
          )}

          <h3 className="admin-banner-section">Jadwal</h3>
          <label className="admin-banner-check">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => set('active', event.target.checked)}
            />
            <span>Tampilkan di beranda</span>
          </label>
          <div className="admin-banner-grid">
            <div className="admin-field">
              <label htmlFor={id('startsOn')}>Mulai tanggal</label>
              <input
                id={id('startsOn')}
                type="date"
                value={draft.startsOn}
                onChange={(event) => set('startsOn', event.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor={id('endsOn')}>Sampai tanggal</label>
              <input
                id={id('endsOn')}
                type="date"
                value={draft.endsOn}
                min={draft.startsOn || undefined}
                aria-invalid={Boolean(errors.endsOn)}
                onChange={(event) => set('endsOn', event.target.value)}
              />
              {fieldError('endsOn')}
            </div>
            <p className="admin-form-hint admin-full">
              Kosongkan untuk tampil tanpa batas. Tanggal mengikuti WIB; banner tampil sepanjang
              hari mulai dan selesai.
            </p>
          </div>
        </fieldset>

        <div className="admin-banner-preview">
          <h3 className="admin-banner-section">Pratinjau</h3>
          {/* Inert: a click in the preview must not leave the unsaved form. */}
          <div inert className="admin-banner-stage home-landing">
            <div className="home-feature-rail">
              <PromoCarousel
                preview={[
                  bannerSlide({
                    ...draft,
                    title: draft.title.trim() || 'Judul banner',
                    cta: draft.cta.trim() || 'Lihat produk',
                  }),
                ]}
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="admin-form-alert" role="alert">
            {error}
          </p>
        )}
        <div className="admin-banner-submit">
          <button type="button" className="admin-secondary" disabled={busy} onClick={onCancel}>
            Batal
          </button>
          <button type="submit" className="admin-primary" disabled={busy || photoBusy}>
            {busy ? 'Menyimpan…' : isNew ? 'Tambah banner' : 'Simpan banner'}
          </button>
        </div>
      </form>
      {crop && (
        <PhotoCropDialog
          src={crop}
          title="Atur gambar banner"
          fit="cover"
          busy={photoBusy}
          error={photoError}
          onApply={applyCrop}
          onCancel={() => {
            setCrop(null);
            setPhotoError('');
          }}
        />
      )}
    </section>
  );
}
