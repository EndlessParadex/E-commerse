/**
 * Pindahkan semua produk dari satu kategori ke kategori lain, lalu hapus kategori asal yang
 * sudah kosong. Foto, harga, SKU, dan isian produk lain tidak berubah.
 *
 *   npm run katalog:pindah -- --dari <id> --ke <id> [--sub asal=tujuan ...]   -> periksa saja
 *   npm run katalog:pindah -- --dari <id> --ke <id> [--sub asal=tujuan ...] --tulis
 *
 * --sub memetakan subkategori asal ke subkategori tujuan yang sudah ada. Subkategori asal
 * yang tidak dipetakan ikut dipindah ke kategori tujuan dengan nama yang sama (atau memakai
 * subkategori tujuan yang namanya sama). Hentikan server BAM sebelum menjalankan --tulis.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.js';
import { loadLocalEnv } from '../server/loadEnv.js';

export class MoveError extends Error {}
const fail = (message) => {
  throw new MoveError(message);
};
const nameKey = (value) => value.trim().toLocaleLowerCase('id').replace(/\s+/g, ' ');

/** The catalog with every product of `from` moved to `to`. Pure: returns a new value. */
export function moveCategory(current, { from, to, subs = {} }) {
  if (!from || !to || from === to) fail('Isi --dari dan --ke dengan dua kategori berbeda.');
  const masters = structuredClone(current.masters);
  const source = masters.categories.find((entry) => entry.id === from);
  const target = masters.categories.find((entry) => entry.id === to);
  if (!source) fail(`Kategori asal "${from}" tidak ada.`);
  if (!target) fail(`Kategori tujuan "${to}" tidak ada.`);
  const childMap = new Map();
  const addedChildren = [];
  for (const child of source.children) {
    const wanted = subs[child.id];
    if (wanted) {
      if (!target.children.some((entry) => entry.id === wanted))
        fail(`Subkategori tujuan "${wanted}" tidak ada di ${target.name}.`);
      childMap.set(child.id, wanted);
      continue;
    }
    const same = target.children.find(
      (entry) => entry.id === child.id || nameKey(entry.name) === nameKey(child.name),
    );
    if (same) childMap.set(child.id, same.id);
    else {
      target.children.push({ id: child.id, name: child.name });
      addedChildren.push(child.name);
      childMap.set(child.id, child.id);
    }
  }
  for (const key of Object.keys(subs))
    if (!source.children.some((child) => child.id === key))
      fail(`Subkategori asal "${key}" tidak ada di ${source.name}.`);
  const moved = [];
  const edits = current.edits.map((draft) => {
    if (draft.categoryId !== from) return draft;
    moved.push(draft.baseName);
    return { ...draft, categoryId: to, subcategoryId: childMap.get(draft.subcategoryId) };
  });
  masters.categories = masters.categories.filter((entry) => entry.id !== from);
  return {
    next: { version: 1, masters, edits },
    moved,
    addedChildren,
    mapping: [...childMap].map(([a, b]) => `${a} → ${b}`),
    source: source.name,
    target: target.name,
  };
}

export async function pindahKategori({
  dbPath = process.env.BAM_DB_PATH || 'data/bam.sqlite',
  from,
  to,
  subs = {},
  tulis = false,
  backup = true,
  log = console.log,
} = {}) {
  if (tulis && backup && existsSync(resolve(dbPath))) {
    const { backupDatabase } = await import('./database-backup.mjs');
    const saved = await backupDatabase({ source: resolve(dbPath) });
    log('Backup database dibuat:', saved?.folder || saved?.path || saved);
  }
  const app = createApp({ dbPath, logger: () => {} });
  try {
    const current = app.catalog.snapshot();
    const result = moveCategory(current, { from, to, subs });
    log(`Database      : ${resolve(dbPath)}`);
    log(`Dari          : ${result.source} (${from}) — kategori ini dihapus setelah kosong`);
    log(`Ke            : ${result.target} (${to})`);
    log(`Produk dipindah: ${result.moved.length}`);
    for (const line of result.mapping) log(`  subkategori ${line}`);
    if (result.addedChildren.length)
      log(`Subkategori baru di tujuan: ${result.addedChildren.join(', ')}`);
    if (!tulis) {
      log(
        '\nPemeriksaan selesai, TIDAK ada yang disimpan. Jalankan dengan --tulis untuk menyimpan.',
      );
      return { ...result, written: false };
    }
    const saved = app.catalog.save({ ...result.next, revision: current.revision });
    log(`\nTersimpan. Revisi katalog sekarang ${saved.revision}.`);
    return { ...result, written: true, revision: saved.revision };
  } finally {
    app.db.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadLocalEnv();
  const args = process.argv.slice(2);
  const value = (flag) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const subs = {};
  args.forEach((arg, index) => {
    if (arg !== '--sub') return;
    const [a, b] = String(args[index + 1] || '').split('=');
    if (!a || !b) fail('Format --sub: asal=tujuan');
    subs[a] = b;
  });
  pindahKategori({
    from: value('--dari'),
    to: value('--ke'),
    subs,
    tulis: args.includes('--tulis'),
    backup: !args.includes('--tanpa-backup'),
  }).catch((error) => {
    console.error('Pindah kategori gagal:', error.message);
    process.exitCode = 1;
  });
}
