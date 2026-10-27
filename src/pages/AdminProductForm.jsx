import { useEffect, useRef, useState } from 'react';
import { suppliers } from '../data/suppliers';
import { categories } from '../data/catalog';
import { products } from '../data/products';
import { productDraft, emptyVariant } from '../data/adminEditor';
import { saveProduct, catalogUsesServer } from '../data/adminStore';
import ProductImage from '../components/shop/ProductImage';
import { rupiah } from '../components/shop/shopPresentation';
import { brandsForSupplier } from '../data/catalogMasters';
import useUnsavedChanges from '../state/useUnsavedChanges';
import { productColorStyle } from '../data/catalogColors';
import AdminColorPicker from '../components/admin/AdminColorPicker';
import { packagingTypes, packagingLabel, packagingContents } from '../data/productPackaging';
import { MAX_PRODUCT_PHOTOS, MAX_PRODUCT_PHOTO_BYTES } from '../data/productPhotos';

export default function AdminProductForm({ groupId, onClose, onSaved, onNavigate }) {
  const [initial] = useState(() => productDraft(groupId));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState({});
  const [storageError, setStorageError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [pendingInvalidFocus, setPendingInvalidFocus] = useState(false);
  const savePending = useRef(false);
  const heading = useRef(null);
  const form = useRef(null);
  const variantDialog = useRef(null);
  const photoRequest = useRef(0);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const category = categories.find((entry) => entry.id === draft.categoryId);
  const fixedIds = new Set(
    initial.variants
      .filter((entry) => products.some((product) => product.id === entry.id))
      .map((entry) => entry.id),
  );
  useEffect(() => {
    heading.current?.focus();
    return () => {
      photoRequest.current += 1;
    };
  }, []);
  useUnsavedChanges(dirty, onNavigate, saving);
  useEffect(() => {
    if (editingVariant === null) return undefined;
    const dialog = variantDialog.current;
    if (!dialog) return undefined;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    dialog.querySelector('input, select')?.focus();
    return () => {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
    };
  }, [editingVariant]);
  useEffect(() => {
    if (!pendingInvalidFocus) return;
    const invalid = form.current?.querySelector('[aria-invalid="true"]');
    invalid?.closest('details.admin-section-card')?.setAttribute('open', '');
    invalid?.focus();
    setPendingInvalidFocus(false);
  }, [pendingInvalidFocus, editingVariant, errors]);
  useEffect(() => {
    if (photoError || errors.gallery || errors.image)
      form.current?.querySelector('details.admin-photo-card')?.setAttribute('open', '');
  }, [photoError, errors.gallery, errors.image]);
  const closeVariantEditor = () => {
    const index = editingVariant;
    setEditingVariant(null);
    requestAnimationFrame(() => {
      form.current?.querySelector(`[data-variant-index="${index}"]`)?.focus();
    });
  };
  const update = (name, value) => {
    setDraft((current) => ({ ...current, [name]: value }));
    setErrors({});
    setStorageError('');
  };
  const updateVariant = (index, name, value) => {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((entry, row) =>
        row === index ? { ...entry, [name]: value } : entry,
      ),
    }));
    setErrors({});
    setStorageError('');
  };
  const updatePackaging = (index, value) => {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((entry, row) =>
        row === index
          ? {
              ...entry,
              packagingType: value,
              unitsPerPackage:
                value === 'satuan'
                  ? '1'
                  : entry.packagingType === 'satuan'
                    ? ''
                    : entry.unitsPerPackage,
              packsPerBox: value === 'dus' ? entry.packsPerBox : '',
            }
          : entry,
      ),
    }));
    setErrors({});
    setStorageError('');
  };
  const packagingInput = (variant, index, name, label, optional = false) => {
    const id = `variant-${index}-${name}`;
    const error = errors[`variants.${index}.${name}`];
    return (
      <div className="admin-field">
        <label htmlFor={id}>{label}</label>
        <input
          id={id}
          type="number"
          step="1"
          min="2"
          max="1000000"
          value={variant[name]}
          onChange={(event) => updateVariant(index, name, event.target.value)}
          placeholder={optional ? 'Opsional' : 'Contoh: 6'}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error && (
          <small className="admin-error" id={`${id}-error`}>
            {error}
          </small>
        )}
      </div>
    );
  };
  const cancel = () => {
    if (!dirty || window.confirm('Buang perubahan yang belum disimpan?')) onClose();
  };
  const updatePhotos = (gallery) => {
    setDraft((current) => ({
      ...current,
      gallery,
      image: gallery[0]?.src || '',
      imageAlt: gallery[0]?.alt || '',
      // Photos edited here apply to all sizes and packaging of this product.
      variants: current.variants.map((variant) => ({ ...variant, gallery: null })),
    }));
    setErrors({});
    setStorageError('');
    setPhotoError('');
  };
  const upload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || uploading) return;
    setPhotoError('');
    if (draft.gallery.length + files.length > MAX_PRODUCT_PHOTOS) {
      setPhotoError(
        `Maksimal ${MAX_PRODUCT_PHOTOS} foto per produk. Hapus foto yang tidak diperlukan sebelum menambahkan lagi.`,
      );
      return;
    }
    if (
      files.some(
        (file) =>
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
          file.size > MAX_PRODUCT_PHOTO_BYTES,
      )
    ) {
      setPhotoError('Pilih JPG, PNG, atau WebP dengan ukuran maksimal 1 MB per foto.');
      return;
    }
    const request = ++photoRequest.current;
    setUploading(true);
    try {
      const photos = [];
      for (const file of files) {
        const src = await new Promise((resolve, reject) => {
          const reader = new window.FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.onabort = reject;
          reader.readAsDataURL(file);
        });
        await new Promise((resolve, reject) => {
          const photo = new window.Image();
          photo.onload = resolve;
          photo.onerror = reject;
          photo.src = src;
        });
        if (request !== photoRequest.current) return;
        photos.push({ src, alt: '' });
      }
      if (request === photoRequest.current) updatePhotos([...draft.gallery, ...photos]);
    } catch {
      if (request === photoRequest.current)
        setPhotoError('Foto tidak dapat dibaca. Pilih file gambar lain.');
    } finally {
      if (request === photoRequest.current) setUploading(false);
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (savePending.current || uploading) return;
    savePending.current = true;
    setSaving(true);
    setStorageError('');
    const result = await saveProduct(draft);
    savePending.current = false;
    setSaving(false);
    if (result.errors) {
      setErrors(result.errors);
      const firstVariantError = Object.keys(result.errors)
        .find((key) => /^variants\.\d+\./.test(key));
      if (firstVariantError) setEditingVariant(Number(firstVariantError.split('.')[1]));
      setPendingInvalidFocus(true);
    } else if (result.storageError) setStorageError(result.storageError);
    else onSaved(result.groupId);
  };
  const field = (name, label, options = {}) => (
    <div className="admin-field">
      <label htmlFor={`product-${name}`}>{label}</label>
      <input
        id={`product-${name}`}
        name={name}
        value={draft[name]}
        onChange={(event) => update(name, event.target.value)}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `error-${name}` : undefined}
        {...options}
      />
      {errors[name] && (
        <small id={`error-${name}`} className="admin-error">
          {errors[name]}
        </small>
      )}
    </div>
  );
  const select = (name, label, choices, change) => (
    <div className="admin-field">
      <label htmlFor={`product-${name}`}>{label}</label>
      <select
        id={`product-${name}`}
        value={draft[name]}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `error-${name}` : undefined}
        onChange={(event) =>
          change ? change(event.target.value) : update(name, event.target.value)
        }
      >
        <option value="">Pilih {label.toLowerCase()}</option>
        {choices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.name}
          </option>
        ))}
      </select>
      {errors[name] && (
        <small id={`error-${name}`} className="admin-error">
          {errors[name]}
        </small>
      )}
    </div>
  );
  const renderVariantFields = (variant, index) => (
    <fieldset className="admin-variant-row">
      <legend>Rincian varian {index + 1}</legend>
    <div className="admin-variant-heading">
      <span>
        {variant.sizeValue
          ? `${variant.sizeValue} ${variant.sizeUnit} · ${packagingLabel(variant)}`
          : 'Varian baru'}
      </span>
      <button
        type="button"
        className="admin-text-button"
        disabled={
          draft.variants.length === 1 || fixedIds.has(initial.variants[index]?.id)
        }
        onClick={() => {
          setDraft((current) => ({
            ...current,
            variants: current.variants.filter((_, row) => row !== index),
          }));
          setEditingVariant(null);
          setErrors({});
        }}
        aria-label={`Hapus varian ${index + 1}`}
      >
        Hapus varian
      </button>
    </div>
    <div className="admin-variant-fields">
      {['id', 'sizeValue', 'price', 'oldPrice'].map((name) => {
        const key = `variants.${index}.${name}`;
        const id = `variant-${index}-${name}`;
        return (
          <div
            className={'admin-field ' + (name === 'id' ? 'admin-sku' : '')}
            key={name}
          >
            <label htmlFor={id}>
              {
                {
                  id: 'SKU *',
                  sizeValue: 'Ukuran per satuan *',
                  price: 'Harga per kemasan (Rp) *',
                  oldPrice: 'Sebelum diskon (Rp)',
                }[name]
              }
            </label>
            <input
              id={id}
              value={variant[name]}
              readOnly={name === 'id' && fixedIds.has(initial.variants[index]?.id)}
              type={name === 'id' ? 'text' : 'number'}
              step={name === 'sizeValue' ? 'any' : '1'}
              min={name === 'id' ? undefined : '0'}
              maxLength={name === 'id' ? 64 : undefined}
              onChange={(event) => updateVariant(index, name, event.target.value)}
              aria-invalid={Boolean(errors[key])}
              aria-describedby={errors[key] ? `${id}-error` : undefined}
              placeholder={
                name === 'id'
                  ? 'Contoh: KRP-180G'
                  : name === 'oldPrice'
                    ? 'Opsional'
                    : '0'
              }
            />
            {errors[key] && (
              <small className="admin-error" id={`${id}-error`}>
                {errors[key]}
              </small>
            )}
          </div>
        );
      })}
      <div className="admin-field">
        <label htmlFor={`variant-${index}-unit`}>Satuan *</label>
        <select
          id={`variant-${index}-unit`}
          value={variant.sizeUnit}
          onChange={(event) => updateVariant(index, 'sizeUnit', event.target.value)}
        >
          <option value="g">Gram (g)</option>
          <option value="ml">Mililiter (ml)</option>
          <option value="pcs">Buah (pcs)</option>
        </select>
      </div>
      <div className="admin-field">
        <label htmlFor={`variant-${index}-packagingType`}>Jenis kemasan *</label>
        <select
          id={`variant-${index}-packagingType`}
          value={variant.packagingType}
          onChange={(event) => updatePackaging(index, event.target.value)}
          aria-invalid={Boolean(errors[`variants.${index}.packagingType`])}
        >
          {packagingTypes.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </div>
      {variant.packagingType !== 'satuan' &&
        packagingInput(
          variant,
          index,
          'unitsPerPackage',
          `Isi ${variant.packagingType} (jumlah satuan) *`,
        )}
      {variant.packagingType === 'dus' &&
        packagingInput(variant, index, 'packsPerBox', 'Jumlah pack dalam dus', true)}
    </div>
    <p className="admin-form-hint">
      {Number(variant.unitsPerPackage) > 0
        ? packagingContents({
            ...variant,
            sizeLabel: variant.sizeValue
              ? `${variant.sizeValue}${variant.sizeUnit}`
              : '',
          })
        : 'Isi jumlah satuan dalam kemasan.'}{' '}
      Harga jual berlaku untuk 1 {variant.packagingType}.
    </p>
    {variant.packagingType === 'dus' && (
      <p className="admin-form-hint">
        Isi dus adalah total satuan. Jumlah pack opsional; contoh: 24 satuan dalam 4
        pack, masing-masing berisi 6 satuan.
      </p>
    )}
    {fixedIds.has(initial.variants[index]?.id) && (
      <p className="admin-form-hint">
        SKU yang sudah ada dipertahankan agar tautan produk tetap tersedia.
      </p>
    )}
    </fieldset>
  );
  return (
    <form ref={form} className="admin-editor" onSubmit={submit} noValidate>
      <fieldset className="admin-submit-lock" disabled={saving}>
        <div className="admin-editor-heading">
          <div>
            <button type="button" className="admin-text-button" onClick={cancel}>
              ← Kembali ke daftar produk
            </button>
            <h2 ref={heading} tabIndex={-1}>
              {groupId ? 'Edit produk' : 'Tambah produk'}
            </h2>
            <p>Lengkapi informasi produk dan harga setiap varian. Kolom bertanda * wajib diisi.</p>
          </div>
          <span className="admin-result-pill">{dirty ? 'Belum disimpan' : 'Siap diedit'}</span>
        </div>
        {(Object.keys(errors).length > 0 || storageError) && (
          <div className="admin-form-alert" role="alert">
            {storageError || 'Periksa kolom yang ditandai sebelum menyimpan.'}
          </div>
        )}
        <div className="admin-editor-grid">
          <div className="admin-editor-sections">
            <details className="admin-form-section admin-section-card admin-info-card"
              open={!groupId}>
              <summary className="admin-compact-section-heading">
                <strong>01 · Informasi produk</strong>
                <small>{draft.baseName || 'Nama belum diisi'} · {draft.brand || 'Merek belum dipilih'}</small>
              </summary>
              <div className="admin-form-grid">
                {field('baseName', 'Nama produk *', {
                  maxLength: 120,
                  placeholder: 'Contoh: Keripik Singkong Balado',
                })}
                {select('supplierId', 'PT pemasok *', suppliers, (value) => {
                  setDraft((current) => ({
                    ...current,
                    supplierId: value,
                    brandId: '',
                    brand: '',
                  }));
                  setErrors({});
                })}
                {select('brandId', 'Merek *', brandsForSupplier(draft.supplierId), (value) => {
                  const brand = brandsForSupplier(draft.supplierId).find(
                    (entry) => entry.id === value,
                  );
                  setDraft((current) => ({ ...current, brandId: value, brand: brand?.name || '' }));
                  setErrors({});
                })}
                {!brandsForSupplier(draft.supplierId).length && (
                  <p className="admin-form-hint admin-full">
                    {draft.supplierId ? (
                      <>
                        Belum ada merek untuk PT ini.{' '}
                        <a href="#/admin/merek">Tambah merek dan hubungkan ke PT pemasok</a> sebelum
                        mengisi produk.
                      </>
                    ) : (
                      'Pilih PT pemasok terlebih dahulu untuk melihat mereknya.'
                    )}
                  </p>
                )}
                {select('categoryId', 'Kategori *', categories, (value) => {
                  setDraft((current) => ({ ...current, categoryId: value, subcategoryId: '' }));
                  setErrors({});
                })}
                {select('subcategoryId', 'Subkategori *', category?.children || [])}
                <AdminColorPicker
                  value={draft.color}
                  onChange={(color) => update('color', color)}
                  error={errors.color}
                />
                <div className="admin-field admin-full">
                  <label htmlFor="product-description">Deskripsi *</label>
                  <textarea
                    id="product-description"
                    rows={3}
                    maxLength={3000}
                    value={draft.description}
                    onChange={(event) => update('description', event.target.value)}
                    aria-invalid={Boolean(errors.description)}
                    aria-describedby={errors.description ? 'error-description' : undefined}
                    placeholder="Jelaskan produk, isi kemasan, dan informasi penggunaannya."
                  />
                  {errors.description && (
                    <small id="error-description" className="admin-error">
                      {errors.description}
                    </small>
                  )}
                  <small>{draft.description.length}/3.000 karakter</small>
                </div>
              </div>
            </details>
            <details className="admin-form-section admin-product-photos admin-section-card admin-photo-card"
              aria-busy={uploading} open={Boolean(draft.gallery.length)}>
              <summary className="admin-compact-section-heading">
                <strong>02 · Foto produk</strong>
                <small>{draft.gallery.length}/{MAX_PRODUCT_PHOTOS} foto · Klik untuk mengatur</small>
              </summary>
              <p>
                Tambahkan hingga {MAX_PRODUCT_PHOTOS} foto. JPG, PNG, atau WebP, maksimal 1 MB per
                foto. Foto digunakan pada semua ukuran dan kemasan.
              </p>
              <div className="admin-photo-controls">
                <label
                  className={
                    'admin-secondary admin-upload' +
                    (uploading || draft.gallery.length >= MAX_PRODUCT_PHOTOS ? ' is-disabled' : '')
                  }
                >
                  {uploading ? 'Membaca foto…' : 'Tambah foto'}
                  <input
                    aria-label="Tambah foto produk"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={upload}
                    disabled={uploading || draft.gallery.length >= MAX_PRODUCT_PHOTOS}
                  />
                </label>
                <span className="admin-photo-count" role="status">
                  {draft.gallery.length}/{MAX_PRODUCT_PHOTOS} foto
                </span>
              </div>
              {(photoError || errors.gallery || errors.image) && (
                <p className="admin-error" role="alert">
                  {photoError || errors.gallery || errors.image}
                </p>
              )}
              {!!draft.gallery.length && (
                <ul className="admin-photo-list" aria-label="Foto produk">
                  {draft.gallery.map((photo, index) => (
                    <li key={index} className="admin-photo-item">
                      <div className="admin-photo-image">
                        <ProductImage
                          product={{
                            name: draft.baseName || 'Produk',
                            image: photo.src,
                            imageAlt: photo.alt || `Foto ${index + 1}`,
                          }}
                          variant="thumbnail"
                        />
                        {index === 0 && <span className="admin-photo-primary">Foto utama</span>}
                      </div>
                      <div className="admin-photo-actions">
                        {index > 0 && (
                          <button
                            type="button"
                            className="admin-text-button"
                            disabled={uploading}
                            aria-label={`Jadikan foto ${index + 1} sebagai foto utama`}
                            onClick={() =>
                              updatePhotos([
                                photo,
                                ...draft.gallery.filter((_, row) => row !== index),
                              ])
                            }
                          >
                            Jadikan utama
                          </button>
                        )}
                        <button
                          type="button"
                          className="admin-text-button admin-photo-remove"
                          disabled={uploading}
                          aria-label={`Hapus foto ${index + 1}`}
                          onClick={() =>
                            updatePhotos(draft.gallery.filter((_, row) => row !== index))
                          }
                        >
                          Hapus
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!!draft.gallery.length && (
                <p className="admin-form-hint">
                  Foto pertama menjadi foto utama; ubah urutan untuk mengganti foto utama.
                </p>
              )}
            </details>
            <section className="admin-form-section admin-variants-section">
              <div className="admin-section-heading">
                <div>
                  <h3>03 · Ukuran, kemasan, dan harga</h3>
                  <p>
                    Klik varian untuk mengedit SKU, gramasi, kemasan (Satuan/Pack/Box/Dus/Renceng),
                    dan harga masing-masing.
                  </p>
                </div>
                <button
                  className="admin-secondary"
                  type="button"
                  disabled={draft.variants.length >= 20}
                  onClick={() => {
                    const index = draft.variants.length;
                    setDraft((current) => ({
                      ...current,
                      variants: [...current.variants, emptyVariant()],
                    }));
                    setEditingVariant(index);
                    setErrors({});
                  }}
                >
                  + Tambah varian
                </button>
              </div>
              {errors.variants && (
                <p className="admin-error" role="alert">
                  {errors.variants}
                </p>
              )}
              <ul className="admin-variant-cards" aria-label="Daftar varian produk">
                {draft.variants.map((variant, index) => (
                  <li key={index}>
                    <button
                      type="button"
                      className="admin-variant-card"
                      data-variant-index={index}
                      aria-haspopup="dialog"
                      aria-controls={editingVariant === index ? 'admin-variant-editor' : undefined}
                      onClick={() => setEditingVariant(index)}
                    >
                      <span className="admin-variant-card-header">
                        <strong>{variant.sizeValue || '…'}{variant.sizeUnit} · {packagingLabel(variant)}</strong>
                        <small>Varian {index + 1}</small>
                      </span>
                      <span className="admin-variant-card-price">
                        {Number(variant.price) > 0 ? rupiah(Number(variant.price)) : 'Harga belum diisi'}
                      </span>
                      <small className="admin-variant-card-sku">SKU: {variant.id || 'Belum diisi'}</small>
                      <span className="admin-variant-card-edit">Edit varian</span>
                    </button>
                  </li>
                ))}
              </ul>
              {editingVariant !== null && draft.variants[editingVariant] && (
                <dialog
                  id="admin-variant-editor"
                  ref={variantDialog}
                  className="admin-variant-dialog"
                  aria-labelledby="admin-variant-dialog-title"
                  onCancel={(event) => {
                    event.preventDefault();
                    closeVariantEditor();
                  }}
                >
                  <div className="admin-variant-dialog-heading">
                    <div>
                      <h3 id="admin-variant-dialog-title">Edit varian {editingVariant + 1}</h3>
                      <p>Ubah rincian, lalu klik Selesai. Simpan produk untuk menyimpan ke database.</p>
                    </div>
                    <button type="button" className="admin-secondary" onClick={closeVariantEditor}>
                      Selesai mengedit
                    </button>
                  </div>
                  {renderVariantFields(draft.variants[editingVariant], editingVariant)}
                </dialog>
              )}
              <p className="admin-form-hint">
                Maksimal 20 varian. Harga sebelum diskon boleh dikosongkan.
              </p>
            </section>
          </div>
          <aside className="admin-form-preview admin-form-preview-side" aria-label="Pratinjau produk">
            <h3>Pratinjau produk</h3>
            <div className="admin-preview-image" style={productColorStyle(draft.color)}>
              <ProductImage
                product={{
                  name: draft.baseName || 'Produk baru',
                  image: draft.image,
                  imageAlt: draft.imageAlt,
                  icon: '📦',
                }}
              />
            </div>
            <div className="admin-preview-meta">
              <span className="admin-eyebrow">{draft.brand || 'Merek produk'}</span>
              <h4>{draft.baseName || 'Nama produk'}</h4>
              <p>{suppliers.find((entry) => entry.id === draft.supplierId)?.name || 'PT pemasok'}</p>
              <strong>
                {Number(draft.variants[0]?.price) > 0
                  ? rupiah(Number(draft.variants[0].price))
                  : 'Harga belum diisi'}
              </strong>
              <div className="admin-preview-sizes">
                {draft.variants.map((variant, index) => (
                  <span key={index} className="admin-size">
                    {variant.sizeValue || '…'}
                    {variant.sizeUnit} · {packagingLabel(variant)}
                  </span>
                ))}
              </div>
              <p className="admin-preview-description">
                {draft.description || 'Deskripsi produk akan tampil di sini.'}
              </p>
            </div>
          </aside>
        </div>
        <div className="admin-form-footer">
          <p>
            {catalogUsesServer
              ? 'Perubahan disimpan ke database dan tersedia di toko setelah disimpan.'
              : 'Perubahan tersimpan pada browser ini dan muncul di pratinjau toko.'}
          </p>
          <div>
            <button type="button" className="admin-secondary" onClick={cancel}>
              Batal
            </button>
            <button type="submit" className="admin-primary" disabled={uploading}>
              {saving ? 'Menyimpan…' : uploading ? 'Menunggu foto…' : 'Simpan produk'}
            </button>
          </div>
        </div>
      </fieldset>
    </form>
  );
}
