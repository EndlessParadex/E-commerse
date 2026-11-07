/**
 * Impor katalog produk dari folder lokal (katalog.json + foto) ke database BAM.
 *
 * Data harga dan foto TIDAK disimpan di repo. Letakkan di folder `katalog-lokal/`
 * (diabaikan Git), lalu jalankan:
 *   npm run import:katalog                 -> periksa saja (tidak menulis apa pun)
 *   npm run import:katalog -- --tulis      -> backup database, lalu simpan
 * Opsi:
 *   --folder <path>     folder katalog lain (default: katalog-lokal)
 *   --perbarui          ganti produk dengan ID yang sama (SKU lama harus tetap ada)
 *   --hapus-contoh      hapus produk contoh bawaan BAM beserta master yang tidak terpakai
 *   --tanpa-backup      lewati backup otomatis sebelum menulis
 *
 * Semua isian divalidasi oleh normalizeCatalog yang sama dengan form admin, dalam satu
 * transaksi dengan cek revisi. Hentikan server BAM sebelum menjalankan --tulis.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.js';
import { normalizeCatalog } from '../server/catalog.js';
import { loadLocalEnv } from '../server/loadEnv.js';
import { slug } from '../src/data/adminEditor.js';
import { isCategoryIcon } from '../src/data/categoryIcons.js';
import { validCatalogColor } from '../src/data/catalogColors.js';
import { masterSnapshot } from '../src/data/catalogMasters.js';
import { products as demoProducts } from '../src/data/products.js';
import { MAX_PRODUCT_PHOTOS } from '../src/data/productPhotos.js';

// GET /api/catalog mengirim seluruh katalog (termasuk foto base64) ke setiap pengunjung,
// dan PUT /api/admin/catalog dibatasi 20 MB. Sisakan ruang agar admin tetap bisa menyimpan.
export const CATALOG_WARN_BYTES = 5 * 1024 * 1024;
export const CATALOG_MAX_BYTES = 15 * 1024 * 1024;

const MIME = { '.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png', '.webp': 'webp' };
const KEMASAN = { satuan: 'satuan', pack: 'pack', dus: 'dus', renceng: 'renceng', box: 'box' };

export class ImportError extends Error {}
const fail = (message) => {
  throw new ImportError(message);
};
const isId = (value) => typeof value === 'string' && /^[a-z0-9_-]{1,100}$/.test(value);
const nameKey = (value) => value.trim().toLocaleLowerCase('id').replace(/\s+/g, ' ');

function readPhoto(folder, file, label) {
  if (typeof file !== 'string' || !file.trim()) fail(`${label}: nama file foto kosong.`);
  const path = resolve(folder, file);
  const inside = relative(resolve(folder), path);
  if (inside.startsWith('..') || isAbsolute(inside))
    fail(`${label}: foto harus berada di dalam folder katalog (${file}).`);
  if (!existsSync(path)) fail(`${label}: foto tidak ditemukan (${file}).`);
  const type = MIME[extname(path).toLowerCase()];
  if (!type) fail(`${label}: foto harus JPG, PNG, atau WebP (${file}).`);
  if (statSync(path).size > 1024 * 1024) fail(`${label}: foto lebih dari 1 MB (${file}).`);
  return { src: `data:image/${type};base64,${readFileSync(path).toString('base64')}`, alt: '' };
}

/** Baca dan periksa katalog.json. Mengembalikan data yang sudah dirapikan. */
export function readKatalog(folder) {
  const file = join(folder, 'katalog.json');
  if (!existsSync(file))
    fail(`File ${file} tidak ditemukan. Salin folder katalog-lokal ke root proyek dulu.`);
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    fail(`${file} bukan JSON yang valid.`);
  }
  if (data?.versi !== 1) fail('katalog.json harus memiliki "versi": 1.');
  const pemasok = data.pemasok;
  if (!isId(pemasok?.id) || !pemasok.nama || !pemasok.singkatan)
    fail('Isi "pemasok" dengan id, nama, dan singkatan.');
  if (pemasok.warna && !validCatalogColor(pemasok.warna)) fail('Warna pemasok tidak valid.');
  const kategori = data.kategori;
  if (!isId(kategori?.id) || !kategori.nama) fail('Isi "kategori" dengan id dan nama.');
  if (kategori.ikon && !isCategoryIcon(kategori.ikon)) fail('Ikon kategori tidak dikenal.');
  const subkategori = kategori.subkategori || [];
  if (!Array.isArray(subkategori) || subkategori.some((child) => !isId(child?.id) || !child.nama))
    fail('Daftar subkategori tidak valid.');
  if (!Array.isArray(data.produk) || !data.produk.length) fail('Daftar "produk" kosong.');
  const ids = new Set();
  const skus = new Set();
  for (const produk of data.produk) {
    const label = `Produk ${produk?.id || '(tanpa id)'}`;
    if (!isId(produk?.id)) fail(`${label}: id hanya huruf kecil, angka, - atau _.`);
    if (ids.has(produk.id)) fail(`${label}: id ganda di katalog.json.`);
    ids.add(produk.id);
    if (!produk.nama || !produk.merek || !produk.subkategori || !produk.deskripsi)
      fail(`${label}: nama, merek, subkategori, dan deskripsi wajib diisi.`);
    if (!subkategori.some((child) => child.id === produk.subkategori))
      fail(`${label}: subkategori "${produk.subkategori}" tidak ada di daftar kategori.`);
    if (!Array.isArray(produk.varian) || !produk.varian.length)
      fail(`${label}: minimal satu varian.`);
    for (const varian of produk.varian) {
      const sku = String(varian?.sku || '');
      if (skus.has(sku.toLowerCase())) fail(`${label}: SKU ${sku} ganda di katalog.json.`);
      skus.add(sku.toLowerCase());
      if (!KEMASAN[varian.kemasan]) fail(`${label}: kemasan ${sku} tidak dikenal.`);
      if (!Number.isSafeInteger(varian.harga) || varian.harga <= 0)
        fail(`${label}: harga ${sku} harus bilangan bulat rupiah lebih dari 0.`);
      if ((varian.foto || []).length > MAX_PRODUCT_PHOTOS)
        fail(`${label}: maksimal ${MAX_PRODUCT_PHOTOS} foto per varian.`);
    }
  }
  return data;
}

function variantDraft(folder, produk, varian) {
  const label = `SKU ${varian.sku}`;
  return {
    id: varian.sku,
    sizeValue: String(varian.ukuran),
    sizeUnit: varian.satuan,
    packagingType: KEMASAN[varian.kemasan],
    unitsPerPackage: String(varian.kemasan === 'satuan' ? 1 : varian.isi),
    packsPerBox: varian.packDalamDus ? String(varian.packDalamDus) : '',
    price: String(varian.harga),
    oldPrice: varian.hargaCoret ? String(varian.hargaCoret) : '',
    photos: (varian.foto || []).map((file) => readPhoto(folder, file, label)),
  };
}

/** Gabungkan katalog.json ke snapshot katalog yang sedang tersimpan. */
export function mergeKatalog(
  current,
  data,
  folder,
  { perbarui = false, hapusContoh = false } = {},
) {
  const masters = structuredClone(current.masters);
  let edits = current.edits.map((draft) => structuredClone(draft));
  const removed = [];

  if (hapusContoh) {
    const demoGroups = new Set(demoProducts.map((product) => product.groupId));
    edits = edits.filter((draft) => {
      if (!demoGroups.has(draft.groupId)) return true;
      removed.push(draft.baseName);
      return false;
    });
  }

  // Data yang dibuat lewat Admin memakai ID berawalan (suppliers-…, brands-…, sub-…).
  // Cocokkan berdasarkan ID atau nama supaya data yang sudah ada dipakai ulang.
  const sameName = (a, b) => nameKey(a) === nameKey(b);
  let supplier = masters.suppliers.find(
    (entry) => entry.id === data.pemasok.id || sameName(entry.name, data.pemasok.nama),
  );
  if (!supplier) {
    supplier = {
      id: data.pemasok.id,
      name: data.pemasok.nama,
      initials: data.pemasok.singkatan,
      color: data.pemasok.warna || 'sky',
      logo: '',
    };
    masters.suppliers.push(supplier);
  }
  const supplierId = supplier.id;

  let category = masters.categories.find(
    (entry) => entry.id === data.kategori.id || sameName(entry.name, data.kategori.nama),
  );
  if (!category) {
    category = {
      id: data.kategori.id,
      name: data.kategori.nama,
      icon: data.kategori.ikon || '🍪',
      children: [],
    };
    masters.categories.push(category);
  }
  const childIds = new Map();
  for (const child of data.kategori.subkategori) {
    let existing = category.children.find(
      (entry) => entry.id === child.id || sameName(entry.name, child.nama),
    );
    if (!existing) {
      existing = { id: child.id, name: child.nama };
      category.children.push(existing);
    }
    childIds.set(child.id, existing.id);
  }

  const newProducts = [];
  const updatedProducts = [];
  for (const produk of data.produk) {
    const brandSlug = slug(produk.merek);
    let brand = masters.brands.find(
      (entry) =>
        entry.id === brandSlug ||
        entry.id === `brands-${brandSlug}` ||
        sameName(entry.name, produk.merek),
    );
    if (!brand) {
      brand = { id: brandSlug, name: produk.merek, supplierIds: [], logo: '' };
      masters.brands.push(brand);
    }
    if (!brand.supplierIds.includes(supplierId)) brand.supplierIds.push(supplierId);
    const brandId = brand.id;

    const variants = produk.varian.map((varian) => variantDraft(folder, produk, varian));
    // Galeri produk = foto varian pertama yang punya foto; varian lain dengan foto sendiri
    // memakai galerinya sendiri, varian tanpa foto memakai galeri produk.
    const lead = variants.find((variant) => variant.photos.length);
    const gallery = lead ? lead.photos : [];
    const draft = {
      groupId: produk.id,
      baseName: produk.nama,
      brandId,
      brand: brand.name,
      supplierId,
      color: produk.warna && validCatalogColor(produk.warna) ? produk.warna : 'sky',
      categoryId: category.id,
      subcategoryId: childIds.get(produk.subkategori),
      description: produk.deskripsi,
      image: gallery[0]?.src || '',
      imageAlt: produk.nama,
      gallery,
      // gallery: null = mewarisi galeri produk. Varian pemimpin selalu mewarisi supaya
      // fotonya tidak tersimpan dua kali di katalog.
      variants: variants.map(({ photos, ...variant }, index) => ({
        ...variant,
        gallery: photos.length && variants[index] !== lead ? photos : null,
      })),
    };

    // Produk yang diketik manual di Admin dikenali dari namanya.
    const index = edits.findIndex(
      (entry) => entry.groupId === produk.id || sameName(entry.baseName, produk.nama),
    );
    if (index >= 0) {
      const existing = edits[index];
      if (!perbarui)
        fail(
          `Produk "${produk.nama}" sudah ada di katalog. Pakai --perbarui untuk menggantinya dengan data katalog.json.`,
        );
      const newSkus = new Set(draft.variants.map((variant) => variant.id.toLowerCase()));
      const missing = existing.variants
        .map((variant) => variant.id)
        .filter((sku) => !newSkus.has(sku.toLowerCase()));
      if (missing.length)
        fail(
          `Produk "${produk.nama}" punya SKU lama yang tidak ada di katalog.json: ${missing.join(', ')}. ` +
            'BAM tidak mengizinkan SKU lama dihapus. Samakan SKU di katalog.json dengan SKU tersebut, ' +
            'atau hapus produk itu lewat Admin dulu.',
        );
      draft.groupId = existing.groupId;
      edits[index] = draft;
      updatedProducts.push(produk.nama);
    } else {
      edits.push(draft);
      newProducts.push(produk.nama);
    }
  }

  // Cek SKU bentrok dengan produk lain sebelum validasi umum, supaya pesannya jelas.
  const owner = new Map();
  for (const draft of edits)
    for (const variant of draft.variants) {
      const key = variant.id.toLowerCase();
      if (owner.has(key) && owner.get(key) !== draft.groupId)
        fail(`SKU ${variant.id} sudah dipakai produk "${owner.get(key)}".`);
      owner.set(key, draft.groupId);
    }

  if (hapusContoh) {
    // Hapus master contoh yang tidak lagi dipakai produk mana pun.
    const demo = masterSnapshot();
    const usedSuppliers = new Set(edits.map((draft) => draft.supplierId));
    const usedBrands = new Set(edits.map((draft) => draft.brandId));
    const usedCategories = new Set(edits.map((draft) => draft.categoryId));
    const usedChildren = new Set(
      edits.map((draft) => `${draft.categoryId}/${draft.subcategoryId}`),
    );
    const demoSupplierIds = new Set(demo.suppliers.map((entry) => entry.id));
    const demoBrandIds = new Set(demo.brands.map((entry) => entry.id));
    const demoCategories = new Map(demo.categories.map((entry) => [entry.id, entry]));
    masters.brands = masters.brands.filter(
      (entry) => !demoBrandIds.has(entry.id) || usedBrands.has(entry.id),
    );
    masters.brands.forEach((entry) => {
      entry.supplierIds = entry.supplierIds.filter(
        (id) => !demoSupplierIds.has(id) || usedSuppliers.has(id),
      );
    });
    masters.suppliers = masters.suppliers.filter(
      (entry) =>
        !demoSupplierIds.has(entry.id) ||
        usedSuppliers.has(entry.id) ||
        masters.brands.some((brand) => brand.supplierIds.includes(entry.id)),
    );
    masters.categories = masters.categories
      .map((entry) => {
        const demoCategory = demoCategories.get(entry.id);
        if (!demoCategory) return entry;
        const demoChildren = new Set(demoCategory.children.map((child) => child.id));
        return {
          ...entry,
          children: entry.children.filter(
            (child) => !demoChildren.has(child.id) || usedChildren.has(`${entry.id}/${child.id}`),
          ),
        };
      })
      .filter(
        (entry) =>
          !demoCategories.has(entry.id) || usedCategories.has(entry.id) || entry.children.length,
      )
      .filter((entry) => entry.children.length);
  }

  const next = { version: 1, masters, edits };
  const bytes = Buffer.byteLength(JSON.stringify(next));
  if (bytes > CATALOG_MAX_BYTES)
    fail(
      `Katalog akan menjadi ${(bytes / 1048576).toFixed(1)} MB, melebihi batas aman ${CATALOG_MAX_BYTES / 1048576} MB. ` +
        'Kecilkan atau kurangi foto (lihat docs/IMPOR-KATALOG.md).',
    );
  // Validasi akhir memakai aturan server yang sama dengan form admin.
  normalizeCatalog(next, current);
  return { next, bytes, newProducts, updatedProducts, removed };
}

export async function importKatalog({
  folder = 'katalog-lokal',
  dbPath = process.env.BAM_DB_PATH || 'data/bam.sqlite',
  tulis = false,
  perbarui = false,
  hapusContoh = false,
  backup = true,
  log = console.log,
} = {}) {
  const root = resolve(folder);
  const data = readKatalog(root);
  if (tulis && backup && existsSync(resolve(dbPath))) {
    const { backupDatabase } = await import('./database-backup.mjs');
    const saved = await backupDatabase({ source: resolve(dbPath) });
    log('Backup database dibuat:', saved?.folder || saved?.path || saved);
  }
  const app = createApp({ dbPath, logger: () => {} });
  try {
    const current = app.catalog.snapshot();
    const result = mergeKatalog(current, data, root, { perbarui, hapusContoh });
    const variants = data.produk.reduce((sum, produk) => sum + produk.varian.length, 0);
    const photos = data.produk.reduce(
      (sum, produk) => sum + produk.varian.reduce((n, varian) => n + (varian.foto || []).length, 0),
      0,
    );
    log(`Database      : ${resolve(dbPath)}`);
    log(`Produk baru   : ${result.newProducts.length}`);
    if (result.updatedProducts.length) log(`Diperbarui    : ${result.updatedProducts.length}`);
    if (result.removed.length) log(`Contoh dihapus: ${result.removed.length}`);
    log(`Varian (SKU)  : ${variants}`);
    log(`Foto          : ${photos}`);
    log(`Ukuran katalog: ${(result.bytes / 1048576).toFixed(1)} MB`);
    if (result.bytes > CATALOG_WARN_BYTES)
      log(
        'PERINGATAN: seluruh katalog (termasuk foto) dikirim ke setiap pengunjung. ' +
          'Di atas 5 MB halaman toko terasa lambat di jaringan seluler.',
      );
    if (!tulis) {
      log(
        '\nPemeriksaan selesai, TIDAK ada yang disimpan. Jalankan dengan --tulis untuk menyimpan.',
      );
      return { ...result, written: false };
    }
    const saved = app.catalog.save({ ...result.next, revision: current.revision });
    log(`\nTersimpan. Revisi katalog sekarang ${saved.revision}.`);
    log('Stok produk baru = 0. Atur stok lewat halaman Admin sebelum produk bisa dipesan.');
    return { ...result, written: true, revision: saved.revision };
  } finally {
    app.db.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadLocalEnv();
  const args = process.argv.slice(2);
  const folderIndex = args.indexOf('--folder');
  importKatalog({
    folder: folderIndex >= 0 ? args[folderIndex + 1] : 'katalog-lokal',
    tulis: args.includes('--tulis'),
    perbarui: args.includes('--perbarui'),
    hapusContoh: args.includes('--hapus-contoh'),
    backup: !args.includes('--tanpa-backup'),
  }).catch((error) => {
    console.error('Impor katalog gagal:', error.message);
    process.exitCode = 1;
  });
}
