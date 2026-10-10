import { products } from './products.js';
import { suppliers } from './suppliers.js';
import { adminProducts } from './adminCatalog.js';
import { CATALOG_STORAGE_KEY, validateDraft, buildVariants, slug, productDraft } from './adminEditor.js';
import { masterSnapshot, validateMaster, applyMasters, validMasterSnapshot } from './catalogMasters.js';
import { packagingValues } from './productPackaging.js';

let revision = 0;
let edits = [];
const clone = (value) => JSON.parse(JSON.stringify(value));
const originalProducts = clone(products);
const originalSuppliers = clone(suppliers);
const originalMasters = clone(masterSnapshot());
let serverRevision = 0;
let transport = (...args) => globalThis.fetch(...args);
export let catalogUsesServer = false;
export let pendingLocalImport = false;
let localBackup = null;
let localChecked = false;
let initialization = null;
let serverSupportsPackaging = false;
const listeners = new Set();
export const subscribeCatalog = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export const catalogRevision = () => revision;
const refreshAdmin = () => adminProducts.splice(0, adminProducts.length, ...products.map((product) => ({ ...product, supplier: suppliers.find((supplier) => supplier.productIds.includes(product.id)) || null })));
const announce = () => { revision += 1; listeners.forEach((listener) => listener()); };
function applyServerCatalog(value) {
  if (value?.version !== 1 || !Number.isSafeInteger(value.revision) || !Array.isArray(value.edits) || !value.masters) throw new Error('Invalid server catalog');
  const previousProducts = clone(products); const previousSuppliers = clone(suppliers); const previousMasters = masterSnapshot();
  // Rebuild from the original seed so browser preview entries cannot leak into the server catalog.
  try {
    const groups = new Set(value.edits.map((draft) => draft.groupId));
    products.splice(0, products.length, ...clone(originalProducts.filter((product) => groups.has(product.groupId))));
    const visibleIds = new Set(products.map((product) => product.id));
    suppliers.splice(0, suppliers.length, ...clone(originalSuppliers).map((supplier) => ({ ...supplier, productIds: supplier.productIds.filter((id) => visibleIds.has(id)) })));
    applyMasters(clone(originalMasters));
    if (!validMasterSnapshot(value.masters, { retainExisting: false, checkUsage: false })) throw new Error('Invalid server master data');
    applyMasters(value.masters);
    value.edits.forEach((draft) => {
      if (Object.keys(validateDraft(draft)).length) throw new Error('Invalid server product');
      applyDraft(draft);
    });
  } catch (error) {
    products.splice(0, products.length, ...previousProducts); suppliers.splice(0, suppliers.length, ...previousSuppliers);
    applyMasters(previousMasters); refreshAdmin(); throw error;
  }
  edits = clone(value.edits); serverRevision = value.revision;
  const variants = value.edits.flatMap((draft) => draft.variants);
  serverSupportsPackaging = value.capabilities?.packaging === true || (variants.length > 0 && variants.every((variant) => Object.hasOwn(variant, 'packagingType') && Object.hasOwn(variant, 'unitsPerPackage')));
  announce();
}
const catalogDrafts = () => [...new Set(products.map((product) => product.groupId))].map((groupId) => productDraft(groupId));
function persistLocal(masters, nextEdits, result, storage) {
  try { storage.setItem(CATALOG_STORAGE_KEY, JSON.stringify({ version: 2, masters, edits: nextEdits })); }
  catch { return { storageError: 'Perubahan belum tersimpan. Penyimpanan browser penuh atau tidak tersedia; isian tetap tersedia.' }; }
  applyServerCatalog({ version: 1, revision: serverRevision, masters, edits: nextEdits });
  return result;
}
export function masterDeleteReason(type, id) {
  const entries = masterSnapshot()[type];
  if (!entries?.some((entry) => entry.id === id)) return 'Data tidak ditemukan.';
  const used = products.some((product) => type === 'suppliers' ? suppliers.find((entry) => entry.id === id)?.productIds.includes(product.id) : type === 'brands' ? product.brandId === id : product.categoryId === id);
  if (used) return 'Masih digunakan oleh produk. Pindahkan atau hapus produknya terlebih dahulu.';
  if (type === 'suppliers' && masterSnapshot().brands.some((brand) => brand.supplierIds.includes(id))) return 'Masih terhubung ke merek. Ubah hubungan PT pada merek atau hapus mereknya terlebih dahulu.';
  return '';
}
export function deleteProduct(groupId, storage = globalThis.localStorage) {
  if (!products.some((product) => product.groupId === groupId)) return { storageError: 'Produk tidak ditemukan.' };
  const nextEdits = (catalogUsesServer ? edits : catalogDrafts()).filter((draft) => draft.groupId !== groupId);
  const masters = masterSnapshot();
  return catalogUsesServer ? persistServer(masters, nextEdits, { deleted: true }) : persistLocal(masters, nextEdits, { deleted: true }, storage);
}
export function deleteMaster(type, id, storage = globalThis.localStorage) {
  const reason = masterDeleteReason(type, id); if (reason) return { storageError: reason };
  const masters = masterSnapshot(); masters[type] = masters[type].filter((entry) => entry.id !== id);
  const nextEdits = catalogUsesServer ? edits : catalogDrafts();
  return catalogUsesServer ? persistServer(masters, nextEdits, { deleted: true }) : persistLocal(masters, nextEdits, { deleted: true }, storage);
}
export function initializeCatalog(request = transport) {
  if (!initialization) initialization = loadServerCatalog(request).finally(() => { initialization = null; });
  return initialization;
}
async function loadServerCatalog(request) {
  catalogUsesServer = true; transport = request;
  if (!localChecked) {
    localChecked = true;
    try {
      if (globalThis.localStorage?.getItem(CATALOG_STORAGE_KEY) && !catalogLoadError) {
        localBackup = { version: 1, masters: masterSnapshot(), edits: [...new Set(products.map((product) => product.groupId))].map((groupId) => productDraft(groupId)) };
      }
    } catch { /* The existing preview data stays in browser storage. */ }
  }
  const response = await transport('/api/catalog', { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Katalog belum dapat dimuat dari server.');
  applyServerCatalog(await response.json());
  pendingLocalImport = Boolean(localBackup && serverRevision === 0);
}
async function persistServer(masters, nextEdits, result) {
  if (!serverSupportsPackaging && nextEdits.some((draft) => draft.variants.some((variant) => packagingValues(variant).packagingType !== 'satuan'))) {
    return { storageError: 'Server yang berjalan belum mendukung Pack/Dus. Hentikan terminal npm run server dengan Ctrl+C, jalankan npm run server kembali dari folder proyek yang sudah diperbarui, lalu muat ulang halaman. Pilihan kemasan belum dikirim; salin isian yang diperlukan sebelum memuat ulang.' };
  }
  try {
    const response = await transport('/api/admin/catalog', { method: 'PUT', credentials: 'include', signal: AbortSignal.timeout(15000), headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: 1, revision: serverRevision, masters, edits: nextEdits }) });
    const payload = await response.json();
    if (!response.ok) {
      const message = response.status === 401 ? 'Sesi sudah berakhir. Masuk kembali sebagai admin.' : response.status === 403 ? 'Akun ini tidak memiliki akses admin.' : response.status === 409 ? 'Katalog di server sudah berubah. Salin isian yang diperlukan, lalu muat ulang halaman sebelum menyimpan lagi.' : payload.errors?.form || 'Perubahan belum tersimpan. Coba kembali.';
      return { storageError: message };
    }
    const packagingSaved = nextEdits.every((draft) => draft.variants.every((variant) => {
      const saved = payload.edits?.find((entry) => entry.groupId === draft.groupId)?.variants?.find((entry) => entry.id === variant.id);
      return saved && JSON.stringify(packagingValues(variant)) === JSON.stringify(packagingValues(saved));
    }));
    if (!packagingSaved) return { storageError: 'Server membalas informasi kemasan yang berbeda dari isian. Hasil penyimpanan perlu diperiksa; isian form tetap tersedia. Pastikan server terbaru sudah dijalankan ulang, salin isian yang diperlukan, lalu muat ulang halaman dan periksa produk sebelum menyimpan kembali.' };
    applyServerCatalog(payload); pendingLocalImport = false;
    return result;
  } catch (error) { return { storageError: error?.name === 'TimeoutError' ? 'Server belum membalas. Hasil penyimpanan perlu diperiksa; salin isian, muat ulang, dan periksa katalog sebelum mengulang penyimpanan.' : 'Perubahan belum dapat dikonfirmasi. Periksa koneksi dan hasil penyimpanan pada katalog sebelum mencoba lagi; isian tetap tersedia.' }; }
}
export async function importLocalCatalog() {
  if (!localBackup || serverRevision !== 0) return { storageError: 'Impor hanya tersedia saat database katalog masih awal.' };
  return persistServer(localBackup.masters, localBackup.edits, { imported: true });
}
function withDraftBrand(snapshot, draft) {
  const id = draft.brandId || slug(draft.brand);
  const existing = snapshot.brands.find((brand) => brand.id === id);
  if (existing) { if (!existing.supplierIds.includes(draft.supplierId)) existing.supplierIds.push(draft.supplierId); }
  else snapshot.brands.push({ id, name: draft.brand.trim(), supplierIds: [draft.supplierId] });
  return snapshot;
}
function applyDraft(draft) {
  const next = buildVariants(draft);
  const removed = new Set(products.filter((item) => item.groupId === draft.groupId).map((item) => item.id));
  const position = products.findIndex((item) => item.groupId === draft.groupId);
  const retained = products.filter((item) => !removed.has(item.id));
  retained.splice(position < 0 ? 0 : Math.min(position, retained.length), 0, ...next);
  products.splice(0, products.length, ...retained);
  suppliers.forEach((supplier) => {
    supplier.productIds = supplier.productIds.filter((id) => !removed.has(id));
    if (supplier.id === draft.supplierId) supplier.productIds.push(...next.map((item) => item.id));
  });
  refreshAdmin();
  return next[0].groupId;
}
export function saveProduct(draft, storage = globalThis.localStorage) {
  const errors = validateDraft(draft);
  if (Object.keys(errors).length) return { errors };
  const groupId = draft.groupId || `local-${draft.variants[0].id}`;
  const saved = { ...draft, groupId };
  // Persist first: a full or unavailable browser storage must never report success.
  const nextEdits = [...(catalogUsesServer ? edits : catalogDrafts()).filter((entry) => entry.groupId !== groupId), saved];
  const masters = withDraftBrand(masterSnapshot(), saved);
  if (catalogUsesServer) return persistServer(masters, nextEdits, { groupId });
  return persistLocal(masters, nextEdits, { groupId }, storage);
}
export function saveMaster(type, draft, storage = globalThis.localStorage) {
  const errors = validateMaster(type, draft);
  if (Object.keys(errors).length) return { errors };
  const masters = masterSnapshot();
  let id = draft.id;
  if (!id) { const prefix = `${type}-${slug(draft.name) || 'baru'}`.slice(0, 85); id = prefix; let suffix = 1; while (masters[type].some((entry) => entry.id === id)) id = `${prefix}-${suffix++}`; }
  const saved = { ...draft, id, name: draft.name.trim() };
  if (type === 'suppliers') { saved.initials = draft.initials.trim().toUpperCase(); saved.logo = draft.logo || ''; }
  if (type === 'categories') {
    const used = new Set(draft.children.filter((child) => child.id).map((child) => child.id));
    saved.children = draft.children.map((child) => {
      if (child.id) return { ...child, name: child.name.trim() };
      const prefix = `sub-${slug(child.name) || 'baru'}`.slice(0, 85); let childId = prefix; let suffix = 1;
      while (used.has(childId)) childId = `${prefix}-${suffix++}`;
      used.add(childId); return { id: childId, name: child.name.trim() };
    });
  }
  const index = masters[type].findIndex((entry) => entry.id === id);
  if (index < 0) masters[type].push(saved); else masters[type][index] = saved;
  if (!validMasterSnapshot(masters)) return { errors: { name: 'Data tidak valid. Periksa nama dan pilihan yang diisi.' } };
  // Update saved product drafts too so a renamed brand remains renamed after reload.
  const nextEdits = (catalogUsesServer ? edits : catalogDrafts()).map((entry) => type === 'brands' && (entry.brandId || slug(entry.brand)) === id ? { ...entry, brandId: id, brand: saved.name } : entry);
  if (catalogUsesServer) return persistServer(masters, nextEdits, { id });
  return persistLocal(masters, nextEdits, { id }, storage);
}
export let catalogLoadError = '';
if (typeof window !== 'undefined') {
  try {
    const raw = window.localStorage.getItem(CATALOG_STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      if (![1, 2].includes(stored.version) || !Array.isArray(stored.edits)) throw new Error('Invalid catalog');
      if (stored.version === 2) applyServerCatalog({ ...stored, version: 1, revision: 0 });
      else {
        if (stored.masters) {
          if (!validMasterSnapshot(stored.masters)) throw new Error('Invalid master data');
          applyMasters(stored.masters); refreshAdmin();
        }
        for (const draft of stored.edits) {
          if (typeof draft.groupId !== 'string') throw new Error('Invalid draft');
        }
        // Validate collisions against the evolving catalog before applying each group.
        for (const draft of stored.edits) {
          // Older product-only saves have free-text brands. Keep these during migration.
          if (!draft.brandId) applyMasters(withDraftBrand(masterSnapshot(), draft));
          if (Object.keys(validateDraft(draft)).length) { catalogLoadError = 'Sebagian perubahan lokal tidak dapat dibaca. Periksa kembali daftar produk.'; continue; }
          applyDraft(draft); edits.push(draft);
        }
        }
    }
  } catch { catalogLoadError = 'Perubahan lokal tidak dapat dibaca sepenuhnya. Periksa katalog; data tersimpan belum dihapus.'; }
}
