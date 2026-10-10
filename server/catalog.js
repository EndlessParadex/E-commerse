import { products } from '../src/data/products.js';
import { productDraft, slug } from '../src/data/adminEditor.js';
import { masterSnapshot } from '../src/data/catalogMasters.js';
import { validCatalogColor } from '../src/data/catalogColors.js';
import { packagingValues, packagingErrors, variantKey } from '../src/data/productPackaging.js';

export class CatalogError extends Error {
  constructor(message, status = 422, code = 'validation_error') { super(message); this.status = status; this.code = code; }
}
const fail = (message) => { throw new CatalogError(message); };
const id = (value) => typeof value === 'string' && /^[a-z0-9_-]{1,100}$/.test(value);
const nameKey = (value) => value.trim().toLocaleLowerCase('id').replace(/\s+/g, ' ');
const text = (value, limit, label, optional = false) => {
  if (typeof value !== 'string' || value.length > limit || (!optional && !value.trim())) fail(`${label} tidak valid.`);
  return value.trim();
};
function photo(value) {
  if (value === '') return '';
  if (typeof value !== 'string' || value.length > 1400000) fail('Foto maksimal 1 MB.');
  const match = value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) fail('Foto harus JPG, PNG, atau WebP.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 1048576 || bytes.length < 12 || bytes.toString('base64') !== match[2]) fail('Data foto tidak valid.');
  const valid = match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) fail('Format foto tidak sesuai dengan isi file.');
  return value;
}
function entries(value, maximum, label, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && !value.length) || value.length > maximum) fail(`${label} tidak valid.`);
  const ids = new Set(); const names = new Set();
  value.forEach((entry) => {
    if (!entry || !id(entry.id) || ids.has(entry.id.toLowerCase())) fail(`ID ${label} tidak unik atau tidak valid.`);
    const name = text(entry.name, 100, `Nama ${label}`);
    if (names.has(nameKey(name))) fail(`Nama ${label} sudah digunakan.`);
    ids.add(entry.id.toLowerCase()); names.add(nameKey(name));
  });
  return value;
}
export function normalizeCatalog(input, current = null) {
  try {
    if (input?.version !== 1 || !input.masters) fail('Format katalog tidak valid.');
    const suppliers = entries(input.masters.suppliers, 500, 'pemasok', true).map((entry) => ({ id: entry.id,
      name: text(entry.name, 100, 'Nama PT'), initials: text(entry.initials, 4, 'Singkatan').toUpperCase(),
      color: validCatalogColor(entry.color) ? entry.color : fail('Warna PT tidak valid.'), logo: photo(entry.logo || ''),
    }));
    const supplierIds = new Set(suppliers.map((entry) => entry.id));
    const brands = entries(input.masters.brands, 2000, 'merek', true).map((entry) => {
      const name = text(entry.name, 80, 'Nama merek');
      if (!slug(name) || !Array.isArray(entry.supplierIds) || !entry.supplierIds.length || new Set(entry.supplierIds).size !== entry.supplierIds.length || entry.supplierIds.some((key) => !supplierIds.has(key))) fail('PT pemasok merek tidak valid.');
      return { id: entry.id, name, supplierIds: [...entry.supplierIds] };
    });
    const categories = entries(input.masters.categories, 500, 'kategori', true).map((entry) => ({ id: entry.id, name: text(entry.name, 100, 'Nama kategori'),
      icon: ['📦', '🍫', '✨', '🍛', '🧼', '💻', '👕'].includes(entry.icon) ? entry.icon : fail('Ikon kategori tidak valid.'),
      children: entries(entry.children, 30, 'subkategori').map((child) => ({ id: child.id, name: text(child.name, 80, 'Nama subkategori') })),
    }));
    if (!Array.isArray(input.edits) || input.edits.length > 5000) fail('Daftar produk tidak valid.');
    const groups = new Set(); const skus = new Map();
    const edits = input.edits.map((draft) => {
      if (!draft || typeof draft.groupId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(draft.groupId) || groups.has(draft.groupId.toLowerCase())) fail('ID produk tidak valid atau duplikat.');
      groups.add(draft.groupId.toLowerCase());
      const brandId = draft.brandId || slug(draft.brand || ''); const brand = brands.find((entry) => entry.id === brandId);
      const category = categories.find((entry) => entry.id === draft.categoryId);
      if (!supplierIds.has(draft.supplierId) || !brand?.supplierIds.includes(draft.supplierId)) fail('Hubungan PT dan merek produk tidak valid.');
      if (!category?.children.some((child) => child.id === draft.subcategoryId)) fail('Kategori/subkategori produk tidak valid.');
      if (!Array.isArray(draft.variants) || !draft.variants.length || draft.variants.length > 20) fail('Produk harus memiliki 1–20 varian.');
      const sizes = new Set();
      const variants = draft.variants.map((variant) => {
        if (!variant || typeof variant.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(variant.id) || skus.has(variant.id.toLowerCase())) fail('SKU tidak valid atau sudah digunakan.');
        skus.set(variant.id.toLowerCase(), { groupId: draft.groupId, id: variant.id });
        const sizeValue = Number(variant.sizeValue); const price = Number(variant.price); const oldPrice = Number(variant.oldPrice || 0);
        if (!Number.isFinite(sizeValue) || sizeValue <= 0 || sizeValue > 1000000 || !['g', 'ml', 'pcs'].includes(variant.sizeUnit)) fail('Ukuran produk tidak valid.');
        // Older clients omit packaging fields. Preserve already saved contents
        // rather than converting an existing pack/dus back into a single unit.
        const previous = current?.edits.find((entry) => entry.groupId === draft.groupId)?.variants.find((entry) => entry.id === variant.id);
        const packageInput = { packagingType: variant.packagingType ?? previous?.packagingType,
          unitsPerPackage: variant.unitsPerPackage ?? previous?.unitsPerPackage, packsPerBox: variant.packsPerBox ?? previous?.packsPerBox };
        const packaging = packagingValues(packageInput); const errors = packagingErrors(packageInput);
        if (Object.keys(errors).length) fail(Object.values(errors)[0]);
        const combination = variantKey({ ...variant, ...packaging });
        if (sizes.has(combination)) fail('Kombinasi ukuran dan kemasan produk duplikat.'); sizes.add(combination);
        if (!Number.isSafeInteger(price) || price <= 0 || price > 1000000000 || !Number.isSafeInteger(oldPrice) || oldPrice < 0 || oldPrice > 1000000000 || (oldPrice && oldPrice <= price)) fail('Harga produk tidak valid.');
        return { id: variant.id, sizeValue: String(sizeValue), sizeUnit: variant.sizeUnit, ...packaging, unitsPerPackage: String(packaging.unitsPerPackage), packsPerBox: packaging.packsPerBox ? String(packaging.packsPerBox) : '', price: String(price), oldPrice: oldPrice ? String(oldPrice) : '' };
      });
      const color = draft.color || current?.edits.find((entry) => entry.groupId === draft.groupId)?.color || products.find((entry) => entry.groupId === draft.groupId)?.color || 'sky';
      if (!validCatalogColor(color)) fail('Warna kartu produk tidak valid.');
      return { groupId: draft.groupId, baseName: text(draft.baseName, 120, 'Nama produk'), brandId, brand: brand.name, supplierId: draft.supplierId, color,
        categoryId: draft.categoryId, subcategoryId: draft.subcategoryId, description: text(draft.description, 3000, 'Deskripsi'),
        image: photo(draft.image || ''), imageAlt: text(draft.imageAlt || '', 160, 'Keterangan foto', true), variants };
    });
    if (current) {
      for (const draft of current.edits) {
        if (!edits.some((entry) => entry.groupId === draft.groupId)) {
          if (draft.variants.some((variant) => skus.has(variant.id.toLowerCase()))) fail('SKU lama tidak boleh dipindahkan ke produk lain.');
          continue;
        }
        for (const variant of draft.variants) {
          const next = skus.get(variant.id.toLowerCase());
          if (!next || next.groupId !== draft.groupId || next.id !== variant.id) fail('SKU lama harus dipertahankan pada produk yang sama.');
        }
      }
    }
    return { version: 1, masters: { suppliers, brands, categories }, edits };
  } catch (error) { if (error instanceof CatalogError) throw error; throw new CatalogError('Isian katalog tidak valid.'); }
}

export class CatalogRepository {
  constructor(db) {
    this.db = db;
    db.exec(`CREATE TABLE IF NOT EXISTS catalog_meta (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS catalog_suppliers (id TEXT PRIMARY KEY, data TEXT NOT NULL, position INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS catalog_brands (id TEXT PRIMARY KEY, name TEXT NOT NULL, position INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS catalog_brand_suppliers (brand_id TEXT REFERENCES catalog_brands(id), supplier_id TEXT REFERENCES catalog_suppliers(id), PRIMARY KEY(brand_id,supplier_id));
      CREATE TABLE IF NOT EXISTS catalog_categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL, position INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS catalog_subcategories (category_id TEXT REFERENCES catalog_categories(id), id TEXT NOT NULL, name TEXT NOT NULL, position INTEGER NOT NULL, PRIMARY KEY(category_id,id));
      CREATE TABLE IF NOT EXISTS catalog_products (id TEXT PRIMARY KEY, supplier_id TEXT REFERENCES catalog_suppliers(id), brand_id TEXT REFERENCES catalog_brands(id), category_id TEXT, subcategory_id TEXT, data TEXT NOT NULL, position INTEGER NOT NULL, FOREIGN KEY(category_id,subcategory_id) REFERENCES catalog_subcategories(category_id,id));
      CREATE TABLE IF NOT EXISTS catalog_variants (id TEXT PRIMARY KEY COLLATE NOCASE, product_id TEXT REFERENCES catalog_products(id), size_value REAL NOT NULL, size_unit TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>0), old_price INTEGER NOT NULL CHECK(old_price>=0), position INTEGER NOT NULL, UNIQUE(product_id,size_value,size_unit));`);
    // Rebuild the legacy size-only constraint transactionally. Existing IDs, prices,
    // order and catalog revision are retained; their packaging defaults to Satuan.
    if (!db.prepare('PRAGMA table_info(catalog_variants)').all().some((column) => column.name === 'packaging_type')) {
      db.exec('BEGIN IMMEDIATE');
      try {
        db.exec(`CREATE TABLE catalog_variants_packaging (
          id TEXT PRIMARY KEY COLLATE NOCASE, product_id TEXT REFERENCES catalog_products(id),
          size_value REAL NOT NULL, size_unit TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>0),
          old_price INTEGER NOT NULL CHECK(old_price>=0), position INTEGER NOT NULL,
          packaging_type TEXT NOT NULL CHECK(packaging_type IN ('satuan','pack','dus')),
          units_per_package INTEGER NOT NULL CHECK(units_per_package BETWEEN 1 AND 1000000 AND (packaging_type!='satuan' OR units_per_package=1) AND (packaging_type='satuan' OR units_per_package>=2)),
          packs_per_box INTEGER NOT NULL CHECK(packs_per_box>=0 AND (packs_per_box=0 OR (packaging_type='dus' AND packs_per_box>=2 AND units_per_package%packs_per_box=0 AND units_per_package/packs_per_box>=2))),
          UNIQUE(product_id,size_value,size_unit,packaging_type,units_per_package));
          INSERT INTO catalog_variants_packaging SELECT id,product_id,size_value,size_unit,price,old_price,position,'satuan',1,0 FROM catalog_variants;
          DROP TABLE catalog_variants;
          ALTER TABLE catalog_variants_packaging RENAME TO catalog_variants;`);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }
    if (!db.prepare('SELECT id FROM catalog_meta WHERE id=1').get()) {
      const seed = normalizeCatalog({ version: 1, masters: masterSnapshot(), edits: [...new Set(products.map((product) => product.groupId))].map((groupId) => productDraft(groupId)) });
      db.exec('BEGIN IMMEDIATE');
      try { this.write(seed); db.prepare('INSERT INTO catalog_meta VALUES(1,0)').run(); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
    }
  }
  snapshot() {
    const db = this.db;
    const suppliers = db.prepare('SELECT data FROM catalog_suppliers ORDER BY position').all().map((entry) => JSON.parse(entry.data));
    const brands = db.prepare('SELECT id,name FROM catalog_brands ORDER BY position').all().map((entry) => ({ ...entry, supplierIds: db.prepare('SELECT supplier_id FROM catalog_brand_suppliers WHERE brand_id=? ORDER BY supplier_id').all(entry.id).map((row) => row.supplier_id) }));
    const categories = db.prepare('SELECT id,name,icon FROM catalog_categories ORDER BY position').all().map((entry) => ({ ...entry, children: db.prepare('SELECT id,name FROM catalog_subcategories WHERE category_id=? ORDER BY position').all(entry.id).map((child) => ({ ...child })) }));
    const edits = db.prepare('SELECT data FROM catalog_products ORDER BY position').all().map((row) => {
      const draft = JSON.parse(row.data); const brand = brands.find((entry) => entry.id === draft.brandId);
      return { ...draft, color: draft.color || products.find((entry) => entry.groupId === draft.groupId)?.color || 'sky', brand: brand.name, variants: db.prepare('SELECT * FROM catalog_variants WHERE product_id=? ORDER BY position').all(draft.groupId).map((variant) => ({ id: variant.id, sizeValue: String(variant.size_value), sizeUnit: variant.size_unit, packagingType: variant.packaging_type, unitsPerPackage: String(variant.units_per_package), packsPerBox: variant.packs_per_box ? String(variant.packs_per_box) : '', price: String(variant.price), oldPrice: variant.old_price ? String(variant.old_price) : '' })) };
    });
    return { version: 1, capabilities: { packaging: true }, revision: db.prepare('SELECT revision FROM catalog_meta WHERE id=1').get().revision, masters: { suppliers, brands, categories }, edits };
  }
  write(value) {
    const db = this.db;
    for (const table of ['catalog_variants', 'catalog_products', 'catalog_brand_suppliers', 'catalog_subcategories', 'catalog_brands', 'catalog_categories', 'catalog_suppliers']) db.exec(`DELETE FROM ${table}`);
    value.masters.suppliers.forEach((entry, index) => db.prepare('INSERT INTO catalog_suppliers VALUES(?,?,?)').run(entry.id, JSON.stringify(entry), index));
    value.masters.brands.forEach((entry, index) => {
      db.prepare('INSERT INTO catalog_brands VALUES(?,?,?)').run(entry.id, entry.name, index);
      entry.supplierIds.forEach((supplierId) => db.prepare('INSERT INTO catalog_brand_suppliers VALUES(?,?)').run(entry.id, supplierId));
    });
    value.masters.categories.forEach((entry, index) => {
      db.prepare('INSERT INTO catalog_categories VALUES(?,?,?,?)').run(entry.id, entry.name, entry.icon, index);
      entry.children.forEach((child, position) => db.prepare('INSERT INTO catalog_subcategories VALUES(?,?,?,?)').run(entry.id, child.id, child.name, position));
    });
    value.edits.forEach((draft, index) => {
      const { variants, ...data } = draft;
      db.prepare('INSERT INTO catalog_products VALUES(?,?,?,?,?,?,?)').run(draft.groupId, draft.supplierId, draft.brandId, draft.categoryId, draft.subcategoryId, JSON.stringify(data), index);
      variants.forEach((variant, position) => { const pack = packagingValues(variant); db.prepare('INSERT INTO catalog_variants VALUES(?,?,?,?,?,?,?,?,?,?)').run(variant.id, draft.groupId, Number(variant.sizeValue), variant.sizeUnit, Number(variant.price), Number(variant.oldPrice || 0), position, pack.packagingType, pack.unitsPerPackage, pack.packsPerBox); });
    });
  }
  save(input) {
    const db = this.db; db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.snapshot();
      if (!Number.isSafeInteger(input?.revision) || input.revision !== current.revision) throw new CatalogError('Katalog telah berubah. Muat ulang halaman sebelum menyimpan lagi.', 409, 'catalog_conflict');
      const next = normalizeCatalog(input, current); this.write(next);
      db.prepare('UPDATE catalog_meta SET revision=revision+1 WHERE id=1').run(); db.exec('COMMIT'); return this.snapshot();
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
}
