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
import { catalogColors, productColorStyle } from '../data/catalogColors';
import { packagingTypes, packagingLabel, packagingContents } from '../data/productPackaging';

export default function AdminProductForm({ groupId, onClose, onSaved, onNavigate }) {
  const [initial] = useState(() => productDraft(groupId));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState({});
  const [storageError, setStorageError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savePending = useRef(false);
  const heading = useRef(null); const form = useRef(null); const photoRequest = useRef(0);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const category = categories.find((entry) => entry.id === draft.categoryId);
  const fixedIds = new Set(initial.variants.filter((entry) => products.some((product) => product.id === entry.id)).map((entry) => entry.id));
  useEffect(() => { heading.current?.focus(); return () => { photoRequest.current += 1; }; }, []);
  useUnsavedChanges(dirty, onNavigate, saving);
  const update = (name, value) => { setDraft((current) => ({ ...current, [name]: value })); setErrors({}); setStorageError(''); };
  const updateVariant = (index, name, value) => { setDraft((current) => ({ ...current, variants: current.variants.map((entry, row) => row === index ? { ...entry, [name]: value } : entry) })); setErrors({}); setStorageError(''); };
  const updatePackaging = (index, value) => {
    setDraft((current) => ({ ...current, variants: current.variants.map((entry, row) => row === index ? {
      ...entry, packagingType: value, unitsPerPackage: value === 'satuan' ? '1' : entry.packagingType === 'satuan' ? '' : entry.unitsPerPackage,
      packsPerBox: value === 'dus' ? entry.packsPerBox : '',
    } : entry) })); setErrors({}); setStorageError('');
  };
  const packagingInput = (variant, index, name, label, optional = false) => {
    const id = `variant-${index}-${name}`; const error = errors[`variants.${index}.${name}`];
    return <div className="admin-field"><label htmlFor={id}>{label}</label><input id={id} type="number" step="1" min="2" max="1000000" value={variant[name]} onChange={(event) => updateVariant(index, name, event.target.value)} placeholder={optional ? 'Opsional' : 'Contoh: 6'} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />{error && <small className="admin-error" id={`${id}-error`}>{error}</small>}</div>;
  };
  const cancel = () => { if (!dirty || window.confirm('Buang perubahan yang belum disimpan?')) onClose(); };
  const upload = async (event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setPhotoError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) { setPhotoError('Pilih JPG, PNG, atau WebP dengan ukuran maksimal 1 MB.'); return; }
    const request = ++photoRequest.current; setUploading(true);
    try {
      const image = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      await new Promise((resolve, reject) => { const photo = new Image(); photo.onload = resolve; photo.onerror = reject; photo.src = image; });
      if (request === photoRequest.current) update('image', image);
    } catch { if (request === photoRequest.current) setPhotoError('Foto tidak dapat dibaca. Pilih file gambar lain.'); }
    finally { if (request === photoRequest.current) setUploading(false); }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (savePending.current || uploading) return;
    savePending.current = true; setSaving(true); setStorageError('');
    const result = await saveProduct(draft);
    savePending.current = false; setSaving(false);
    if (result.errors) { setErrors(result.errors); requestAnimationFrame(() => form.current?.querySelector('[aria-invalid="true"]')?.focus()); }
    else if (result.storageError) setStorageError(result.storageError);
    else onSaved(result.groupId);
  };
  const field = (name, label, options = {}) => <div className="admin-field"><label htmlFor={`product-${name}`}>{label}</label><input id={`product-${name}`} name={name} value={draft[name]} onChange={(event) => update(name, event.target.value)} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `error-${name}` : undefined} {...options} />{errors[name] && <small id={`error-${name}`} className="admin-error">{errors[name]}</small>}</div>;
  const select = (name, label, choices, change) => <div className="admin-field"><label htmlFor={`product-${name}`}>{label}</label><select id={`product-${name}`} value={draft[name]} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `error-${name}` : undefined} onChange={(event) => change ? change(event.target.value) : update(name, event.target.value)}><option value="">Pilih {label.toLowerCase()}</option>{choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.name}</option>)}</select>{errors[name] && <small id={`error-${name}`} className="admin-error">{errors[name]}</small>}</div>;
  return <form ref={form} className="admin-editor" onSubmit={submit} noValidate><fieldset className="admin-submit-lock" disabled={saving}>
    <div className="admin-editor-heading"><div><button type="button" className="admin-text-button" onClick={cancel}>← Kembali ke daftar produk</button><h2 ref={heading} tabIndex={-1}>{groupId ? 'Edit produk' : 'Tambah produk'}</h2><p>Lengkapi informasi produk dan harga setiap varian. Kolom bertanda * wajib diisi.</p></div><span className="admin-result-pill">{dirty ? 'Belum disimpan' : 'Siap diedit'}</span></div>
    {(Object.keys(errors).length > 0 || storageError) && <div className="admin-form-alert" role="alert">{storageError || 'Periksa kolom yang ditandai sebelum menyimpan.'}</div>}
    <div className="admin-editor-grid"><div className="admin-editor-sections">
      <section className="admin-form-section"><h3>01 · Informasi produk</h3><div className="admin-form-grid">
        {field('baseName', 'Nama produk *', { maxLength: 120, placeholder: 'Contoh: Keripik Singkong Balado' })}
        {select('supplierId', 'PT pemasok *', suppliers, (value) => { setDraft((current) => ({ ...current, supplierId: value, brandId: '', brand: '' })); setErrors({}); })}
        {select('brandId', 'Merek *', brandsForSupplier(draft.supplierId), (value) => { const brand = brandsForSupplier(draft.supplierId).find((entry) => entry.id === value); setDraft((current) => ({ ...current, brandId: value, brand: brand?.name || '' })); setErrors({}); })}
        {!brandsForSupplier(draft.supplierId).length && <p className="admin-form-hint admin-full">{draft.supplierId ? <>Belum ada merek untuk PT ini. <a href="#/admin/merek">Tambah merek dan hubungkan ke PT pemasok</a> sebelum mengisi produk.</> : 'Pilih PT pemasok terlebih dahulu untuk melihat mereknya.'}</p>}
        {select('categoryId', 'Kategori *', categories, (value) => { setDraft((current) => ({ ...current, categoryId: value, subcategoryId: '' })); setErrors({}); })}
        {select('subcategoryId', 'Subkategori *', category?.children || [])}
        {select('color', 'Warna kartu *', catalogColors)}
        <div className="admin-field admin-full"><label htmlFor="product-description">Deskripsi *</label><textarea id="product-description" rows={5} maxLength={3000} value={draft.description} onChange={(event) => update('description', event.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'error-description' : undefined} placeholder="Jelaskan produk, isi kemasan, dan informasi penggunaannya." />{errors.description && <small id="error-description" className="admin-error">{errors.description}</small>}<small>{draft.description.length}/3.000 karakter</small></div>
      </div></section>
      <section className="admin-form-section"><h3>02 · Foto produk</h3><p>Foto utama digunakan pada semua ukuran produk. JPG, PNG, atau WebP, maksimal 1 MB.</p><div className="admin-photo-controls"><label className="admin-secondary admin-upload">{uploading ? 'Membaca foto…' : draft.image ? 'Ganti foto' : 'Pilih foto'}<input aria-label="Pilih foto produk" type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={uploading} /></label>{draft.image && <button type="button" className="admin-text-button" onClick={() => { update('image', ''); setPhotoError(''); }}>Hapus foto</button>}</div>{(photoError || errors.image) && <p className="admin-error" role="alert">{photoError || errors.image}</p>}{field('imageAlt', 'Keterangan foto', { maxLength: 160, placeholder: 'Contoh: Kemasan tampak depan' })}<p className="admin-form-hint">Tanpa foto, ilustrasi produk akan ditampilkan.</p></section>
      <section className="admin-form-section"><div className="admin-section-heading"><div><h3>03 · Ukuran, kemasan, dan harga</h3><p>Setiap kombinasi ukuran dan kemasan memiliki SKU serta harga sendiri. Ukuran diisi per satuan, harga diisi per kemasan yang dijual.</p></div><button className="admin-secondary" type="button" disabled={draft.variants.length >= 20} onClick={() => { setDraft((current) => ({ ...current, variants: [...current.variants, emptyVariant()] })); setErrors({}); }}>+ Tambah varian</button></div>
        {errors.variants && <p className="admin-error" role="alert">{errors.variants}</p>}
        {draft.variants.map((variant, index) => <fieldset className="admin-variant-row" key={index}><legend>Varian {index + 1}</legend><div className="admin-variant-heading"><span>{variant.sizeValue ? `${variant.sizeValue} ${variant.sizeUnit} · ${packagingLabel(variant)}` : 'Varian baru'}</span><button type="button" className="admin-text-button" disabled={draft.variants.length === 1 || fixedIds.has(initial.variants[index]?.id)} onClick={() => { setDraft((current) => ({ ...current, variants: current.variants.filter((_, row) => row !== index) })); setErrors({}); }} aria-label={`Hapus varian ${index + 1}`}>Hapus varian</button></div><div className="admin-variant-fields">
          {['id', 'sizeValue', 'price', 'oldPrice'].map((name) => { const key = `variants.${index}.${name}`; const id = `variant-${index}-${name}`; return <div className={'admin-field ' + (name === 'id' ? 'admin-sku' : '')} key={name}><label htmlFor={id}>{({ id: 'SKU *', sizeValue: 'Ukuran per satuan *', price: 'Harga per kemasan (Rp) *', oldPrice: 'Sebelum diskon (Rp)' })[name]}</label><input id={id} value={variant[name]} readOnly={name === 'id' && fixedIds.has(initial.variants[index]?.id)} type={name === 'id' ? 'text' : 'number'} step={name === 'sizeValue' ? 'any' : '1'} min={name === 'id' ? undefined : '0'} maxLength={name === 'id' ? 64 : undefined} onChange={(event) => updateVariant(index, name, event.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${id}-error` : undefined} placeholder={name === 'id' ? 'Contoh: KRP-180G' : name === 'oldPrice' ? 'Opsional' : '0'} />{errors[key] && <small className="admin-error" id={`${id}-error`}>{errors[key]}</small>}</div>; })}
          <div className="admin-field"><label htmlFor={`variant-${index}-unit`}>Satuan *</label><select id={`variant-${index}-unit`} value={variant.sizeUnit} onChange={(event) => updateVariant(index, 'sizeUnit', event.target.value)}><option value="g">Gram (g)</option><option value="ml">Mililiter (ml)</option><option value="pcs">Buah (pcs)</option></select></div>
          <div className="admin-field"><label htmlFor={`variant-${index}-packagingType`}>Jenis kemasan *</label><select id={`variant-${index}-packagingType`} value={variant.packagingType} onChange={(event) => updatePackaging(index, event.target.value)} aria-invalid={Boolean(errors[`variants.${index}.packagingType`])}>{packagingTypes.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></div>
          {variant.packagingType !== 'satuan' && packagingInput(variant, index, 'unitsPerPackage', `Isi ${variant.packagingType} (jumlah satuan) *`)}
          {variant.packagingType === 'dus' && packagingInput(variant, index, 'packsPerBox', 'Jumlah pack dalam dus', true)}
        </div><p className="admin-form-hint">{Number(variant.unitsPerPackage) > 0 ? packagingContents({ ...variant, sizeLabel: variant.sizeValue ? `${variant.sizeValue}${variant.sizeUnit}` : '' }) : 'Isi jumlah satuan dalam kemasan.'} Harga jual berlaku untuk 1 {variant.packagingType}.</p>{variant.packagingType === 'dus' && <p className="admin-form-hint">Isi dus adalah total satuan. Jumlah pack opsional; contoh: 24 satuan dalam 4 pack, masing-masing berisi 6 satuan.</p>}{fixedIds.has(initial.variants[index]?.id) && <p className="admin-form-hint">SKU yang sudah ada dipertahankan agar tautan produk tetap tersedia.</p>}</fieldset>)}
        <p className="admin-form-hint">Maksimal 20 varian. Harga sebelum diskon boleh dikosongkan.</p>
      </section>
    </div><aside className="admin-form-preview"><h3>Pratinjau produk</h3><div className="admin-preview-image" style={productColorStyle(draft.color)}><ProductImage product={{ name: draft.baseName || 'Produk baru', image: draft.image, imageAlt: draft.imageAlt, icon: '📦' }} /></div><span className="admin-eyebrow">{draft.brand || 'Merek produk'}</span><h4>{draft.baseName || 'Nama produk'}</h4><p>{suppliers.find((entry) => entry.id === draft.supplierId)?.name || 'PT pemasok'}</p><strong>{Number(draft.variants[0]?.price) > 0 ? rupiah(Number(draft.variants[0].price)) : 'Harga belum diisi'}</strong><div className="admin-preview-sizes">{draft.variants.map((variant, index) => <span key={index} className="admin-size">{variant.sizeValue || '…'}{variant.sizeUnit} · {packagingLabel(variant)}</span>)}</div><p className="admin-preview-description">{draft.description || 'Deskripsi produk akan tampil di sini.'}</p></aside></div>
    <div className="admin-form-footer"><p>{catalogUsesServer ? 'Perubahan disimpan ke database dan tersedia di toko setelah disimpan.' : 'Perubahan tersimpan pada browser ini dan muncul di pratinjau toko.'}</p><div><button type="button" className="admin-secondary" onClick={cancel}>Batal</button><button type="submit" className="admin-primary" disabled={uploading}>{saving ? 'Menyimpan…' : uploading ? 'Menunggu foto…' : 'Simpan produk'}</button></div></div>
  </fieldset></form>;
}
