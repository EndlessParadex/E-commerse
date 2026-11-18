import { useEffect, useId, useState } from 'react';
import { fetchAdminPromotions, saveAdminPromotions } from '../state/promotionsApi';
import { loadPromotions } from '../data/promotionStore';
import { promotionLabel, promotionTerms } from '../data/promotions';
import {
  promotionErrors,
  promotionExample,
  promotionStatus,
  skuById,
  skuGroups,
  skuLabel,
  skuUnit,
} from '../data/promotionAdmin';
import ConfirmDialog from '../components/shop/ConfirmDialog';
import './AdminBannersPage.css';
import './AdminPromotionsPage.css';

const newId = () => 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const blank = () => ({
  id: newId(),
  variantId: '',
  buy: 2,
  free: 1,
  maxFree: 0,
  startsOn: '',
  endsOn: '',
  active: true,
  note: '',
});
const MAX = 100;

/** Admin/Pemilik: "beli X gratis Y" per SKU — add, edit, schedule, hide, delete. */
export default function AdminPromotionsPage() {
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
    fetchAdminPromotions()
      .then((data) => active && (setState(data), setLoadError('')))
      .catch((failure) => active && setLoadError(failure.message));
    return () => {
      active = false;
    };
  }, [reload]);

  /** Every change saves the whole list with its revision. */
  const save = async (promotions, done) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const next = await saveAdminPromotions(state.revision, promotions);
      setState(next);
      setMessage(done);
      loadPromotions();
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
        Memuat promo…
      </section>
    );
  if (editing)
    return (
      <PromotionEditor
        initial={editing.promotion}
        isNew={editing.isNew}
        others={state.promotions}
        busy={busy}
        error={error}
        onCancel={() => {
          setEditing(null);
          setError('');
        }}
        onSave={async (promotion) => {
          const list = editing.isNew
            ? [...state.promotions, promotion]
            : state.promotions.map((entry) => (entry.id === promotion.id ? promotion : entry));
          if (await save(list, editing.isNew ? 'Promo ditambahkan.' : 'Promo disimpan.'))
            setEditing(null);
        }}
      />
    );

  const promotions = state.promotions;
  const live = promotions.filter((entry) => promotionStatus(entry, state.today).id === 'live');
  return (
    <section className="admin-panel admin-banners" aria-labelledby="admin-promotions-title">
      <div className="admin-panel-heading">
        <div>
          <h2 id="admin-promotions-title">Promo beli gratis</h2>
          <p>
            Promo dihitung per SKU dan per kemasan SKU itu. Pembeli membayar barang di keranjang dan
            menerima barang gratis di atasnya, selama stok tersedia. Berlaku untuk semua pembeli.
          </p>
        </div>
        <span className="admin-result-pill">
          {promotions.length} promo · {live.length} berjalan hari ini
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
      <div className="admin-banners-toolbar">
        <button
          className="admin-primary"
          type="button"
          disabled={busy || promotions.length >= MAX}
          onClick={() => {
            setMessage('');
            setEditing({ promotion: blank(), isNew: true });
          }}
        >
          + Tambah promo
        </button>
      </div>
      {!promotions.length ? (
        <p className="admin-banners-note">
          Belum ada promo. Contoh: pilih SKU “Dus”, isi beli 2 gratis 1 — pembeli yang memesan 2 dus
          menerima 3 dus dan membayar 2.
        </p>
      ) : (
        <ol className="admin-banner-list">
          {promotions.map((promotion) => {
            const status = promotionStatus(promotion, state.today);
            const sku = skuById(promotion.variantId);
            const unit = skuUnit(sku);
            const given = state.given?.[promotion.id];
            const name = sku ? skuLabel(sku) : promotion.variantId + ' (SKU tidak ditemukan)';
            return (
              <li key={promotion.id} className={'admin-banner-row is-' + status.id}>
                <div className="admin-promo-thumb" aria-hidden="true">
                  <strong>
                    {promotion.buy}+{promotion.free}
                  </strong>
                </div>
                <div className="admin-banner-info">
                  <strong>{name}</strong>
                  <span>
                    {promotionLabel(promotion)} · {promotionTerms(promotion)}
                  </span>
                  <span className="admin-promo-given">
                    Sudah diberikan:{' '}
                    {given ? `${given.units} ${unit} di ${given.orders} pesanan` : '—'}
                  </span>
                  {promotion.note && <span>Catatan: {promotion.note}</span>}
                  <span className={'admin-banner-status is-' + status.id}>{status.label}</span>
                </div>
                <div className="admin-banner-actions">
                  <button
                    type="button"
                    className="admin-text-button"
                    disabled={busy}
                    onClick={() =>
                      save(
                        promotions.map((entry) =>
                          entry.id === promotion.id ? { ...entry, active: !entry.active } : entry,
                        ),
                        promotion.active ? 'Promo disembunyikan.' : 'Promo diaktifkan lagi.',
                      )
                    }
                  >
                    {promotion.active ? 'Sembunyikan' : 'Aktifkan'}
                  </button>
                  <button
                    type="button"
                    className="admin-secondary"
                    disabled={busy}
                    onClick={() => {
                      setMessage('');
                      setEditing({ promotion, isNew: false });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="admin-text-button admin-danger-text"
                    disabled={busy}
                    onClick={() => setRemoving(promotion)}
                  >
                    Hapus
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="admin-banners-note admin-promo-footnote">
        “Sudah diberikan” menjumlahkan barang gratis di pesanan yang tidak dibatalkan atau
        kedaluwarsa — dipakai untuk klaim ke pemasok. Pesanan yang sudah dibuat tidak berubah bila
        promo diedit atau dihapus.
      </p>
      {removing && (
        <ConfirmDialog
          title="Hapus promo?"
          confirmLabel="Hapus promo"
          busy={busy}
          error={error}
          onClose={() => {
            setRemoving(null);
            setError('');
          }}
          onConfirm={async () => {
            if (
              await save(
                promotions.filter((entry) => entry.id !== removing.id),
                'Promo dihapus.',
              )
            )
              setRemoving(null);
          }}
        >
          <p>
            Promo “{promotionLabel(removing)}” untuk{' '}
            {skuById(removing.variantId)?.name || 'SKU ini'} dihapus dan laporan barang gratisnya
            tidak tampil lagi di sini. Pilih Sembunyikan bila masih perlu laporannya.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}

function PromotionEditor({ initial, isNew, others, busy, error, onCancel, onSave }) {
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [errors, setErrors] = useState({});
  const base = useId();
  const id = (name) => base + name;
  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const number = (key) => (event) =>
    set(key, event.target.value === '' ? NaN : Number(event.target.value));
  const sku = skuById(draft.variantId);
  const unit = skuUnit(sku);
  const submit = (event) => {
    event.preventDefault();
    const found = promotionErrors(draft, others);
    setErrors(found);
    if (Object.keys(found).length) {
      window.requestAnimationFrame(() =>
        document.getElementById(id(Object.keys(found)[0]))?.focus(),
      );
      return;
    }
    onSave({ ...draft, note: draft.note.trim() });
  };
  const fieldError = (name) =>
    errors[name] && (
      <p className="admin-error" id={id(name) + '-error'}>
        {errors[name]}
      </p>
    );
  const numberField = (key, label, hint, min, max) => (
    <div className="admin-field">
      <label htmlFor={id(key)}>{label}</label>
      <input
        id={id(key)}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={Number.isNaN(draft[key]) ? '' : draft[key]}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={hint ? id(key) + '-hint' : undefined}
        onChange={number(key)}
      />
      {hint && (
        <p className="admin-form-hint" id={id(key) + '-hint'}>
          {hint}
        </p>
      )}
      {fieldError(key)}
    </div>
  );
  const ready =
    Number.isSafeInteger(draft.buy) &&
    draft.buy > 0 &&
    Number.isSafeInteger(draft.free) &&
    draft.free > 0;

  return (
    <section className="admin-panel admin-banner-editor" aria-labelledby={id('heading')}>
      <div className="admin-panel-heading">
        <div>
          <h2 id={id('heading')}>{isNew ? 'Tambah promo' : 'Edit promo'}</h2>
          <p>Berlaku untuk pesanan baru setelah disimpan. Pesanan lama tidak berubah.</p>
        </div>
      </div>
      <form onSubmit={submit} noValidate className="admin-banner-form">
        <fieldset disabled={busy} className="admin-banner-fields">
          <legend className="visually-hidden">Isi promo</legend>
          <h3 className="admin-banner-section">Barang</h3>
          <div className="admin-field">
            <label htmlFor={id('variantId')}>SKU produk *</label>
            <select
              id={id('variantId')}
              value={draft.variantId}
              aria-invalid={Boolean(errors.variantId)}
              aria-describedby={id('variantId') + '-hint'}
              onChange={(event) => set('variantId', event.target.value)}
            >
              <option value="">Pilih SKU…</option>
              {skuGroups().map(([brand, items]) => (
                <optgroup key={brand} label={brand}>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {skuLabel(item)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="admin-form-hint" id={id('variantId') + '-hint'}>
              Satu SKU = satu ukuran dan satu kemasan. Promo pada SKU “Dus” dihitung per dus.
            </p>
            {fieldError('variantId')}
          </div>

          <h3 className="admin-banner-section">Aturan</h3>
          <div className="admin-banner-grid">
            {numberField('buy', `Beli (${unit}) *`, '', 1, 100)}
            {numberField('free', `Gratis (${unit}) *`, '', 1, 100)}
            {numberField('maxFree', 'Batas gratis per pesanan', '0 = tanpa batas.', 0, 10000)}
          </div>
          {ready && (
            <p className="admin-banners-note admin-promo-example">
              {promotionExample(draft, unit)}{' '}
              {draft.maxFree > 0 && `Paling banyak ${draft.maxFree} ${unit} gratis per pesanan.`}
            </p>
          )}

          <h3 className="admin-banner-section">Jadwal</h3>
          <div className="admin-banner-grid">
            <div className="admin-field">
              <label htmlFor={id('startsOn')}>Mulai (opsional)</label>
              <input
                id={id('startsOn')}
                type="date"
                value={draft.startsOn}
                onChange={(event) => set('startsOn', event.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor={id('endsOn')}>Selesai (opsional)</label>
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
          </div>
          <label className="admin-banner-check">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => set('active', event.target.checked)}
            />
            <span>Aktif (hilangkan centang untuk menyembunyikan sementara)</span>
          </label>
          <div className="admin-field">
            <label htmlFor={id('note')}>Catatan internal (opsional)</label>
            <input
              id={id('note')}
              maxLength={200}
              value={draft.note}
              placeholder="Contoh: Program pemasok, klaim per akhir bulan"
              onChange={(event) => set('note', event.target.value)}
            />
          </div>
        </fieldset>
        {error && (
          <p className="admin-form-alert" role="alert">
            {error}
          </p>
        )}
        <div className="admin-banner-submit">
          <button className="admin-secondary" type="button" onClick={onCancel} disabled={busy}>
            Batal
          </button>
          <button className="admin-primary" type="submit" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan promo'}
          </button>
        </div>
      </form>
    </section>
  );
}
