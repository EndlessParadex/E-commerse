import { useRef, useState } from 'react';
import { products } from '../data/products';
import {
  availableStock,
  setAvailableStock,
  stockKey,
  initialStock,
  previewStockForImport,
} from '../state/frontendWorkflow';
import { packagingTypes, packagingValues } from '../data/productPackaging';
import {
  serverStock,
  setServerStock,
  refreshServerWorkflow,
  importServerStock,
} from '../state/serverWorkflow';
import useUnsavedChanges from '../state/useUnsavedChanges';
import useWorkflow from '../state/useWorkflow';
import ConfirmDialog from '../components/shop/ConfirmDialog';
import ProductImage from '../components/shop/ProductImage';
import { savedProductPhotos } from '../data/productPhotos';
import { productColorStyle } from '../data/catalogColors';
import { stockBreakdown } from '../data/stockPresentation';
import {
  stockEditorTypes, stockEditorFactors, stockEditorCounts, stockEditorEmpty, previewStockEditor,
} from '../data/stockEditorModel';
import StockPackageEditor from '../components/shop/StockPackageEditor';
import '../styles/workflow.css';
import './AdminStockPage.css';

function StockProductIdentity({ product, variants }) {
  // A shared stock row may represent several packs of the same product size.
  const source = savedProductPhotos(product).length
    ? product
    : variants.find((variant) => savedProductPhotos(variant).length) || product;
  const photo = savedProductPhotos(source)[0];
  const preview = {
    ...product,
    image: photo?.src || '',
    imageAlt: photo?.alt || `${product.baseName} ${product.sizeLabel}`,
  };
  return (
    <div className="workflow-stock-identity">
      <div className="workflow-stock-photo" style={productColorStyle(source.color)}>
        <ProductImage product={preview} variant="thumbnail" />
      </div>
      <div className="workflow-stock-name">
        <h3>{product.baseName}</h3>
        <p>
          {product.brand} · {product.sizeLabel} per satuan
        </p>
      </div>
    </div>
  );
}

function StockPackagingRow({ variant, available }) {
  const { packagingType, unitsPerPackage } = packagingValues(variant);
  const name = packagingTypes.find((entry) => entry.id === packagingType)?.name || 'Satuan';
  const label =
    packagingType === 'satuan' ? name : `${name} (${unitsPerPackage.toLocaleString('id-ID')})`;
  return (
    <li>
      <div>
        <strong
          className="workflow-stock-packaging-label"
          title={
            packagingType === 'satuan'
              ? 'Dijual per satuan'
              : `Isi ${unitsPerPackage.toLocaleString('id-ID')} satuan per ${packagingType}`
          }
        >
          {label}
        </strong>
        <small>{variant.id}</small>
      </div>
      <strong className="workflow-stock-package-count">
        {Math.floor(available / unitsPerPackage).toLocaleString('id-ID')} {packagingType}
      </strong>
    </li>
  );
}

function StockOverview({ available, variants, compact = false }) {
  const breakdown = stockBreakdown(available, variants);
  const summary = breakdown.items
    .filter((item) => item.quantity > 0)
    .map((item) => `${item.quantity.toLocaleString('id-ID')} ${item.name.toLowerCase()}`)
    .join(' + ') || 'Stok kosong';
  return (
    <section className="workflow-stock-overview" aria-label="Ringkasan pembagian stok">
      {compact ? (
        <div className="workflow-stock-compact-total">
          <span>Total stok</span>
          <strong>{available.toLocaleString('id-ID')} <small>satuan</small></strong>
          <p>{summary}</p>
        </div>
      ) : (
        <>
          <div className="workflow-stock-overview-heading">
            <h4>Ringkasan stok</h4>
            <p className="workflow-stock-amount">
              Total <strong>{available.toLocaleString('id-ID')}</strong> satuan
            </p>
          </div>
          <dl className="workflow-stock-summary">
            {breakdown.items.map((item) => (
              <div
                className={'workflow-stock-stat' + (!item.unitsPerPackage ? ' is-unconfigured' : '')}
                data-packaging={item.type}
                key={item.type}
              >
                <dt>{item.name}</dt>
                <dd>
                  <strong>{item.quantity.toLocaleString('id-ID')}</strong>
                  <small>
                    {item.type === 'satuan'
                      ? 'Satuan lepas'
                      : item.unitsPerPackage
                        ? `Isi ${item.unitsPerPackage.toLocaleString('id-ID')} satuan`
                        : 'Belum diatur'}
                  </small>
                </dd>
              </div>
            ))}
          </dl>
          <p className="workflow-stock-hint">Total stok dibagi ke dus, pack, lalu satuan lepas.</p>
        </>
      )}
    </section>
  );
}
export default function AdminStockPage() {
  const { orders, failed, loading, server, canImportPreview } = useWorkflow('inventory');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const inputRef = useRef(null);
  const [importOpen, setImportOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [layout, setLayout] = useState('compact');
  const [target, setTarget] = useState(null);
  const [editMode, setEditMode] = useState('replace');
  const [quantities, setQuantities] = useState(stockEditorEmpty);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const conversion = target ? stockEditorFactors(target.variants) : null;
  const preview = target
    ? previewStockEditor({ mode: editMode, counts: quantities, available: target.available, factors: conversion })
    : null;
  const startingQuantities = target ? stockEditorCounts(target.available, target.variants) : null;
  const dirty = Boolean(target &&
    (editMode !== 'replace' || stockEditorTypes.some(({ id }) => quantities[id] !== startingQuantities[id])));
  useUnsavedChanges(dirty, undefined, busy);
  const focusEditor = () =>
    window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  const focusEditButton = (key) =>
    window.requestAnimationFrame(() =>
      document
        .getElementById('stock-edit-' + encodeURIComponent(key))
        ?.focus({ preventScroll: true }),
    );
  const changeList = (change) => {
    if (pending.current) return;
    if (dirty && !window.confirm('Perubahan stok belum disimpan. Tinggalkan isian ini?')) return;
    setTarget(null);
    setError('');
    change();
  };
  const edit = (row) =>
    changeList(() => {
      setTarget(row);
      setEditMode('replace');
      setQuantities(stockEditorCounts(row.available, row.variants));
      setNotice('');
      focusEditor();
    });
  const cancel = () => {
    const key = target?.key;
    setTarget(null);
    setError('');
    if (key) focusEditButton(key);
  };
  let previewRows = [];
  try {
    if (server && canImportPreview) previewRows = previewStockForImport(window.sessionStorage);
  } catch {
    /* An unreadable preview cannot be imported. */
  }
  const importPreview = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const result = await importServerStock(
        previewRows.map(({ key, available, revision }) => ({ key, available, revision })),
      );
      if (result.error) setError(result.error);
      else {
        setImportOpen(false);
        setNotice(
          'Stok simulasi yang diperiksa telah diimpor ke database. Riwayat pesanan percobaan tetap berada di tab lama.',
        );
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  let stockFailed = failed || loading;
  const rows = [...new Map(products.map((product) => [stockKey(product), product])).values()].map(
    (product) => {
      let available = 0;
      try {
        available = availableStock(product, window.sessionStorage, orders);
      } catch {
        stockFailed = true;
      }
      return {
        key: stockKey(product),
        product,
        available,
        revision: server && !stockFailed ? serverStock(product).revision : 0,
        variants: products.filter((entry) => stockKey(entry) === stockKey(product)),
      };
    },
  );
  const visible = rows.filter(
    ({ product, available, variants }) =>
      (filter === 'all' ||
        (filter === 'empty' ? available === 0 : available > 0 && available <= 12)) &&
      `${product.baseName} ${product.brand} ${product.sizeLabel} ${variants.map((variant) => variant.id).join(' ')}`
        .toLocaleLowerCase('id')
        .includes(query.trim().toLocaleLowerCase('id')),
  );
  const save = async (event) => {
    event.preventDefault();
    if (pending.current || !target || stockFailed) return;
    if (preview.error) {
      setError(preview.error);
      focusEditor();
      return;
    }
    const units = preview.finalStock;
    const edited = target;
    pending.current = true;
    setBusy(true);
    try {
      const result = server
        ? await setServerStock(edited.product, units, edited.revision)
        : setAvailableStock(edited.product, units, window.sessionStorage);
      if (result.error) {
        setError(result.error);
        return;
      }
      setNotice(
        `Stok ${edited.product.baseName} ${edited.product.sizeLabel} disimpan: ${units.toLocaleString('id-ID')} satuan tersedia.`,
      );
      setTarget(null);
      setError('');
      focusEditButton(edited.key);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const reloadTarget = async () => {
    if (pending.current || !target) return;
    pending.current = true;
    setBusy(true);
    try {
      await refreshServerWorkflow();
      const latest = serverStock(target.product);
      setTarget({ ...target, available: latest.available, revision: latest.revision });
      setEditMode('replace');
      setQuantities(stockEditorCounts(latest.available, target.variants));
      setError('');
      focusEditor();
    } catch (failure) {
      setError(failure.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const editor = () => (
    <StockPackageEditor
      target={target} busy={busy} stockFailed={stockFailed} server={server}
      mode={editMode} quantities={quantities} factors={conversion} preview={preview}
      error={error} inputRef={inputRef} onSave={save} onCancel={cancel}
      onReload={reloadTarget}
      onModeChange={(mode) => {
        setEditMode(mode);
        setQuantities(mode === 'add' ? stockEditorEmpty()
          : stockEditorCounts(target.available, target.variants));
        setError('');
      }}
      onQuantityChange={(id, value) => {
        setQuantities((current) => ({ ...current, [id]: value }));
        setError('');
      }}
    />
  );
  return (
    <section className="admin-panel workflow-admin-stock">
      <div className="admin-panel-heading">
        <div>
          <h2>Stok per ukuran</h2>
          <p>Satuan, pack, dan dus dengan ukuran yang sama menggunakan stok bersama.</p>
        </div>
        <span className="admin-result-pill">{rows.length} ukuran</span>
      </div>
      <p className="workflow-preview">
        {server ? (
          'Stok tersimpan di database. Checkout menahan stok; pembatalan dan batas pembayaran yang berakhir mengembalikannya. Jumlah pada semua perangkat mengikuti server.'
        ) : (
          <>
            Stok simulasi awal {initialStock()} satuan per ukuran. Nilai tersimpan di tab ini dan
            belum terhubung ke gudang. Checkout menahan stok; pembatalan atau pembayaran kedaluwarsa
            melepasnya.
          </>
        )}
      </p>
      {!!previewRows.length && !loading && !failed && (
        <div className="workflow-preview">
          <strong>Stok simulasi lama ditemukan pada tab ini</strong>
          <p>
            Periksa angka sebelum memindahkannya ke database. Impor hanya tersedia sebelum stok atau
            pesanan server digunakan.
          </p>
          <button
            className="admin-secondary"
            type="button"
            disabled={busy}
            onClick={() => changeList(() => setImportOpen(true))}
          >
            Periksa stok lama untuk impor
          </button>
        </div>
      )}
      <div className="workflow-stock-toolbar">
        <div className="workflow-filters">
          <div className="admin-field">
            <label htmlFor="admin-stock-search">Cari produk atau SKU</label>
            <input
              id="admin-stock-search"
              type="search"
              maxLength={200}
              placeholder="Nama produk, merek, ukuran, atau SKU"
              value={query}
              disabled={busy}
              onChange={(event) => {
                const value = event.target.value;
                changeList(() => setQuery(value));
              }}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="admin-stock-status">Ketersediaan</label>
            <select
              id="admin-stock-status"
              value={filter}
              disabled={busy}
              onChange={(event) => {
                const value = event.target.value;
                changeList(() => setFilter(value));
              }}
            >
              <option value="all">Semua stok</option>
              <option value="empty">Stok habis</option>
              <option value="low">Stok menipis (1–12 satuan)</option>
            </select>
          </div>
        </div>
        <div className="workflow-stock-controls">
          <p role="status">
            {stockFailed ? 'Memeriksa stok' : `${visible.length} dari ${rows.length} ukuran`}
          </p>
          <fieldset className="workflow-stock-layout">
            <legend>Tampilan</legend>
            {[
              ['compact', 'Ringkas'],
              ['full', 'Kartu lengkap'],
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="stock-layout"
                  value={value}
                  checked={layout === value}
                  disabled={busy}
                  onChange={() => changeList(() => setLayout(value))}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          {(query || filter !== 'all') && (
            <button
              className="admin-text-button"
              type="button"
              disabled={busy}
              onClick={() =>
                changeList(() => {
                  setQuery('');
                  setFilter('all');
                })
              }
            >
              Reset filter
            </button>
          )}
        </div>
      </div>
      {notice && (
        <p className="workflow-notice" role="status">
          {notice}
        </p>
      )}
      {stockFailed ? (
        <div className="admin-empty" role="alert">
          <h3>{loading ? 'Memuat stok…' : 'Stok belum dapat dibuka'}</h3>
          <p>
            {server
              ? 'Periksa koneksi server lalu muat data terbaru.'
              : 'Data penyimpanan browser tidak tersedia atau tidak dapat dibaca. Coba muat ulang halaman.'}
          </p>
          {server && (
            <button
              className="admin-secondary"
              type="button"
              disabled={busy}
              onClick={() => refreshServerWorkflow()}
            >
              Muat stok terbaru
            </button>
          )}
        </div>
      ) : !visible.length ? (
        <div className="admin-empty">
          <h3>Produk tidak ditemukan</h3>
          <button
            className="admin-secondary"
            type="button"
            onClick={() =>
              changeList(() => {
                setQuery('');
                setFilter('all');
              })
            }
          >
            Reset filter
          </button>
        </div>
      ) : (
        <ul className={'workflow-stock-list is-' + layout}>
          {visible.map((row) => {
            const editing = target?.key === row.key;
            return (
              <li className={'workflow-stock-card' + (editing ? ' is-editing' : '')} key={row.key}>
                <header>
                  <StockProductIdentity product={row.product} variants={row.variants} />
                  <span
                    className={
                      'workflow-badge' +
                      (!row.available
                        ? ' status-expired'
                        : row.available <= 12
                          ? ' status-awaiting_payment'
                          : '')
                    }
                  >
                    {row.available ? (row.available <= 12 ? 'Menipis' : 'Tersedia') : 'Habis'}
                  </span>
                </header>
                <StockOverview available={row.available} variants={row.variants}
                  compact={layout === 'compact'} />
                <footer className="workflow-stock-footer">
                  {editing ? (
                    editor()
                  ) : (
                    <button
                      id={'stock-edit-' + encodeURIComponent(row.key)}
                      type="button"
                      className="admin-secondary"
                      disabled={busy}
                      onClick={() => edit(row)}
                      aria-label={`Ubah stok ${row.product.baseName} ${row.product.sizeLabel}`}
                      aria-expanded="false"
                    >
                      Ubah stok
                    </button>
                  )}
                </footer>
                <details
                  className="workflow-stock-details"
                  key={layout}
                  open={layout === 'full' ? true : undefined}
                >
                  <summary>
                    Rincian kemasan / SKU <span>{row.variants.length} pilihan</span>
                  </summary>
                  <div className="workflow-stock-packaging-heading">
                    <h4>Kemasan / SKU</h4>
                    <span>Maks. bisa dijual</span>
                  </div>
                  <ul className="workflow-stock-packages">
                    {row.variants.map((variant) => (
                      <StockPackagingRow
                        key={variant.id}
                        variant={variant}
                        available={row.available}
                      />
                    ))}
                  </ul>
                  <p className="workflow-stock-sales-hint">
                    Jumlah per kemasan dihitung dari total stok yang sama.
                  </p>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      {stockFailed && target && (
        <div className="workflow-stock-recovery">
          <StockProductIdentity product={target.product} variants={target.variants} />
          <p>Isian perubahan tetap tersedia. Muat stok terbaru sebelum menyimpan.</p>
          {editor()}
        </div>
      )}
      {importOpen && (
        <ConfirmDialog
          danger={false}
          busy={busy}
          title="Impor stok simulasi yang telah diperiksa?"
          confirmLabel="Impor angka stok ini"
          onConfirm={importPreview}
          onClose={() => setImportOpen(false)}
          error={error}
        >
          <p>
            Angka berikut adalah sisa stok pada tab ini. Riwayat pesanan simulasi tidak disalin
            sebagai pesanan pelanggan.
          </p>
          <ul>
            {previewRows.map((row) => (
              <li key={row.key}>
                {row.name}: <strong>{row.available.toLocaleString('id-ID')} satuan</strong>
              </li>
            ))}
          </ul>
        </ConfirmDialog>
      )}
    </section>
  );
}
