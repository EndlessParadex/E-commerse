import { useEffect, useRef, useState } from 'react';
import { suppliers } from '../data/suppliers';
import { categories } from '../data/catalog';
import { brands } from '../data/catalogMasters';
import { products } from '../data/products';
import { saveMaster, catalogUsesServer, deleteMaster, masterDeleteReason } from '../data/adminStore';
import useUnsavedChanges from '../state/useUnsavedChanges';
import { catalogColors, supplierColorStyle, avatarColorStyle } from '../data/catalogColors';

const labels = { suppliers: 'PT pemasok', brands: 'merek', categories: 'kategori' };
const entriesFor = (type) => ({ suppliers, brands, categories })[type];
const newDraft = (type) => type === 'suppliers' ? { id: '', name: '', initials: '', color: 'sky', logo: '' } : type === 'brands' ? { id: '', name: '', supplierIds: [] } : { id: '', name: '', icon: '📦', children: [{ id: '', name: '' }] };
const copy = (entry) => JSON.parse(JSON.stringify(entry));

function MasterForm({ type, initial, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => copy(initial));
  const [errors, setErrors] = useState({}); const [storageError, setStorageError] = useState('');
  const [saving, setSaving] = useState(false); const savePending = useRef(false);
  const heading = useRef(null); const form = useRef(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useUnsavedChanges(dirty, onClose, saving);
  useEffect(() => { heading.current?.focus(); }, []);
  const update = (key, value) => { setDraft((current) => ({ ...current, [key]: value })); setErrors({}); setStorageError(''); };
  const cancel = () => { if (!dirty || window.confirm('Buang perubahan yang belum disimpan?')) onClose(); };
  const input = (key, label, limit) => <div className="admin-field"><label htmlFor={`master-${key}`}>{label}</label><input id={`master-${key}`} value={draft[key]} maxLength={limit} onChange={(event) => update(key, event.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `master-error-${key}` : undefined} />{errors[key] && <small className="admin-error" id={`master-error-${key}`}>{errors[key]}</small>}</div>;
  const submit = async (event) => {
    event.preventDefault(); if (savePending.current) return;
    savePending.current = true; setSaving(true); setStorageError('');
    const result = await saveMaster(type, draft);
    savePending.current = false; setSaving(false);
    if (result.errors) { setErrors(result.errors); requestAnimationFrame(() => form.current?.querySelector('[aria-invalid="true"]')?.focus()); }
    else if (result.storageError) setStorageError(result.storageError);
    else onSaved(result.id);
  };
  return <form ref={form} className="admin-master-form" onSubmit={submit} noValidate><fieldset className="admin-submit-lock" disabled={saving}><div className="admin-editor-heading"><div><button className="admin-text-button" type="button" onClick={cancel}>← Kembali ke daftar {labels[type]}</button><h2 ref={heading} tabIndex={-1}>{initial.id ? 'Edit' : 'Tambah'} {labels[type]}</h2><p>Kolom bertanda * wajib diisi. {catalogUsesServer ? 'Perubahan disimpan ke database.' : 'Perubahan tersimpan pada browser ini.'}</p></div><span className="admin-result-pill">{dirty ? 'Belum disimpan' : 'Siap diedit'}</span></div>
    {(storageError || Object.keys(errors).length > 0) && <p className="admin-form-alert" role="alert">{storageError || 'Periksa kolom yang ditandai sebelum menyimpan.'}</p>}
    <section className="admin-form-section"><div className="admin-form-grid">
      {input('name', `Nama ${labels[type]} *`, type === 'brands' ? 80 : 100)}
      {type === 'suppliers' && <>{input('initials', 'Singkatan *', 4)}<div className="admin-field"><label htmlFor="master-color">Warna kartu *</label><select id="master-color" value={draft.color} onChange={(event) => update('color', event.target.value)}>{catalogColors.map((color) => <option key={color.id} value={color.id}>{color.name}</option>)}</select></div><div className="admin-master-sample" style={supplierColorStyle(draft.color)}><span className="admin-supplier-avatar" style={avatarColorStyle(draft.color)}>{draft.initials || 'PT'}</span><div><strong>{draft.name || 'Nama PT pemasok'}</strong><p>Siap dipilih saat menambahkan produk.</p></div></div></>}
      {type === 'brands' && <fieldset className="admin-master-choices admin-full" aria-invalid={Boolean(errors.supplierIds)} tabIndex={errors.supplierIds ? -1 : undefined}><legend>PT pemasok *</legend><p>Pilih PT yang memasok merek ini. Satu merek dapat terhubung ke beberapa PT.</p>{suppliers.map((supplier) => <label key={supplier.id}><input type="checkbox" checked={draft.supplierIds.includes(supplier.id)} onChange={(event) => update('supplierIds', event.target.checked ? [...draft.supplierIds, supplier.id] : draft.supplierIds.filter((id) => id !== supplier.id))} /><span>{supplier.name}</span></label>)}{errors.supplierIds && <small className="admin-error">{errors.supplierIds}</small>}</fieldset>}
      {type === 'categories' && <><div className="admin-field"><label htmlFor="master-icon">Ikon *</label><select id="master-icon" value={draft.icon} onChange={(event) => update('icon', event.target.value)}>{['📦', '🍫', '✨', '🍛', '🧼', '💻', '👕'].map((icon) => <option key={icon} value={icon}>{icon}</option>)}</select></div><div className="admin-full"><div className="admin-section-heading"><h3>Subkategori *</h3><button type="button" className="admin-secondary" disabled={draft.children.length >= 30} onClick={() => update('children', [...draft.children, { id: '', name: '' }])}>+ Tambah subkategori</button></div>{errors.children && <p className="admin-error" role="alert">{errors.children}</p>}<div className="admin-subcategory-list">{draft.children.map((child, index) => <div className="admin-subcategory-row" key={index}><div className="admin-field"><label htmlFor={`child-${index}`}>Subkategori {index + 1} *</label><input id={`child-${index}`} value={child.name} maxLength={80} aria-invalid={Boolean(errors[`children.${index}`])} onChange={(event) => update('children', draft.children.map((entry, row) => row === index ? { ...entry, name: event.target.value } : entry))} />{errors[`children.${index}`] && <small className="admin-error">{errors[`children.${index}`]}</small>}</div><button type="button" className="admin-text-button" disabled={draft.children.length === 1 || Boolean(child.id)} onClick={() => update('children', draft.children.filter((_, row) => row !== index))} aria-label={`Hapus subkategori ${index + 1}`}>Hapus</button></div>)}</div><p className="admin-form-hint">Subkategori yang sudah tersimpan dipertahankan agar tautan tetap tersedia; namanya dapat diedit.</p></div></>}
    </div></section><div className="admin-form-footer"><p>{initial.id ? 'Produk dan tautan yang sudah ada tetap terhubung.' : 'Data baru langsung tersedia pada form produk setelah disimpan.'}</p><div><button type="button" className="admin-secondary" onClick={cancel}>Batal</button><button className="admin-primary" type="submit">{saving ? 'Menyimpan…' : `Simpan ${labels[type]}`}</button></div></div>
  </fieldset></form>;
}

export default function AdminMasterPage({ type }) {
  const [editor, setEditor] = useState(null); const [notice, setNotice] = useState(''); const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState(''); const [deleteError, setDeleteError] = useState(''); const deletePending = useRef(false);
  useUnsavedChanges(false, undefined, Boolean(deleting));
  const remove = async (entry) => {
    if (deletePending.current || masterDeleteReason(type, entry.id)) return;
    if (!window.confirm(`Hapus ${labels[type]} "${entry.name}"? Data akan dihapus dari katalog.`)) return;
    deletePending.current = true; setDeleting(entry.id); setDeleteError(''); setNotice('');
    try {
      const result = await deleteMaster(type, entry.id);
      if (result.storageError) setDeleteError(result.storageError);
      else setNotice(`${labels[type]} ${entry.name} berhasil dihapus.`);
    } finally { deletePending.current = false; setDeleting(''); }
  };
  const entries = entriesFor(type);
  const filtered = entries.filter((entry) => entry.name.toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id')));
  const open = (entry) => { setNotice(''); setDeleteError(''); setEditor(entry ? copy(entry) : newDraft(type)); window.scrollTo(0, 0); };
  if (editor) return <MasterForm type={type} initial={editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setQuery(''); setNotice(`${labels[type]} berhasil disimpan ${catalogUsesServer ? 'ke database' : 'di browser ini'}.`); }} />;
  return <>{deleteError && <p className="admin-form-alert" role="alert">{deleteError}</p>}{notice && <p className="admin-save-notice" role="status">✓ {notice}</p>}<section className="admin-panel"><div className="admin-panel-heading"><div><h2>Daftar {labels[type]}</h2><p>{type === 'suppliers' ? 'Kelola PT yang memasok produk toko.' : type === 'brands' ? 'Kelola merek dan PT pemasok yang terhubung.' : 'Kelola kategori dan subkategori untuk katalog toko.'}</p></div><button type="button" className="admin-primary" disabled={Boolean(deleting)} onClick={() => open()}>+ Tambah {labels[type]}</button></div><div className="admin-filters"><div className="admin-field admin-search"><label htmlFor="master-search">Cari {labels[type]}</label><input id="master-search" type="search" value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} placeholder={`Nama ${labels[type]}`} /></div></div><p className="admin-results" role="status">Menampilkan {filtered.length} dari {entries.length} {labels[type]}</p><div className="admin-master-list">{filtered.map((entry) => {
    const items = products.filter((product) => type === 'suppliers' ? entry.productIds.includes(product.id) : type === 'brands' ? product.brandId === entry.id : product.categoryId === entry.id);
    return <article className="admin-master-card" key={entry.id} style={type === 'suppliers' ? supplierColorStyle(entry.color) : undefined}><div className="admin-master-card-heading"><span className="admin-supplier-avatar" style={type === 'suppliers' ? avatarColorStyle(entry.color) : undefined} aria-hidden="true">{type === 'suppliers' ? entry.initials : type === 'categories' ? entry.icon : entry.name.slice(0, 2).toUpperCase()}</span><div><h3>{entry.name}</h3><p>{new Set(items.map((product) => product.groupId)).size} produk utama · {items.length} SKU</p></div></div>{type === 'brands' && <p className="admin-master-detail">{entry.supplierIds.map((id) => suppliers.find((supplier) => supplier.id === id)?.name).filter(Boolean).join(' · ')}</p>}{type === 'categories' && <div className="admin-preview-sizes">{entry.children.map((child) => <span className="admin-size" key={child.id}>{child.name}</span>)}</div>}<div className="admin-master-actions"><button type="button" className="admin-secondary" disabled={Boolean(deleting)} onClick={() => open(entry)} aria-label={`Edit ${entry.name}`}>Edit {labels[type]}</button><button type="button" className="admin-danger" disabled={Boolean(deleting) || Boolean(masterDeleteReason(type, entry.id))} onClick={() => remove(entry)} aria-describedby={masterDeleteReason(type, entry.id) ? `delete-reason-${entry.id}` : undefined} aria-label={`Hapus ${labels[type]} ${entry.name}`}>{deleting === entry.id ? 'Menghapus…' : `Hapus ${labels[type]}`}</button></div>{masterDeleteReason(type, entry.id) && <p className="admin-form-hint" id={`delete-reason-${entry.id}`}>Belum dapat dihapus: {masterDeleteReason(type, entry.id)}</p>}</article>;
  })}</div>{!filtered.length && <div className="admin-empty"><h3>Data tidak ditemukan</h3><p>Coba kata pencarian lain.</p><button type="button" className="admin-secondary" onClick={() => setQuery('')}>Reset pencarian</button></div>}</section></>;
}
