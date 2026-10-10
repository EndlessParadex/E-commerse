import { useState } from 'react';
import { products } from '../data/products';
import { availableStock, setAvailableStock, stockKey, DEMO_STOCK } from '../state/frontendWorkflow';
import { packagingLabel, packagingValues } from '../data/productPackaging';
import useWorkflow from '../state/useWorkflow';
import ConfirmDialog from '../components/shop/ConfirmDialog';
import '../styles/workflow.css';

export default function AdminStockPage() {
  const { orders, failed } = useWorkflow();
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all');
  const [target, setTarget] = useState(null); const [amount, setAmount] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  let stockFailed = failed;
  const rows = [...new Map(products.map((product) => [stockKey(product), product])).values()].map((product) => {
    let available = 0;
    try { available = availableStock(product, window.sessionStorage, orders); } catch { stockFailed = true; }
    return { product, available, variants: products.filter((entry) => stockKey(entry) === stockKey(product)) };
  });
  const visible = rows.filter(({ product, available, variants }) => (filter === 'all' || (filter === 'empty' ? available === 0 : available > 0 && available <= 12)) && `${product.baseName} ${product.brand} ${product.sizeLabel} ${variants.map((variant) => variant.id).join(' ')}`.toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id')));
  const save = () => {
    if (!/^\d+$/.test(amount)) { setError('Isi stok dengan bilangan bulat, minimal 0.'); return; }
    const result = setAvailableStock(target.product, Number(amount), window.sessionStorage);
    if (result.error) { setError(result.error); return; }
    setNotice(`Stok ${target.product.baseName} ${target.product.sizeLabel} disimpan: ${amount} satuan tersedia.`); setTarget(null);
  };
  return <section className="admin-panel workflow-admin-stock"><div className="admin-panel-heading"><div><h2>Stok per ukuran</h2><p>Satuan, pack, dan dus dengan ukuran yang sama menggunakan stok bersama.</p></div><span className="admin-result-pill">{rows.length} ukuran</span></div>
    <p className="workflow-preview">Stok simulasi awal {DEMO_STOCK} satuan per ukuran. Nilai tersimpan di tab ini dan belum terhubung ke gudang. Checkout menahan stok; pembatalan atau pembayaran kedaluwarsa melepasnya.</p>
    <div className="workflow-filters"><div className="admin-field"><label htmlFor="admin-stock-search">Cari produk atau SKU</label><input id="admin-stock-search" type="search" maxLength={200} value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="admin-field"><label htmlFor="admin-stock-status">Ketersediaan</label><select id="admin-stock-status" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Semua stok</option><option value="empty">Stok habis</option><option value="low">Stok menipis (1–12 satuan)</option></select></div></div>
    {notice && <p className="workflow-notice" role="status">{notice}</p>}
    {stockFailed ? <div className="admin-empty" role="alert"><h3>Stok belum dapat dibuka</h3><p>Data penyimpanan browser tidak tersedia atau tidak dapat dibaca. Coba muat ulang halaman.</p></div> : !visible.length ? <div className="admin-empty"><h3>Produk tidak ditemukan</h3><button className="admin-secondary" onClick={() => { setQuery(''); setFilter('all'); }}>Reset filter</button></div> : <ul className="workflow-stock-list">{visible.map((row) => <li className="workflow-stock-card" key={stockKey(row.product)}><header><div><h3>{row.product.baseName}</h3><p>{row.product.brand} · {row.product.sizeLabel} per satuan</p></div><span className={'workflow-badge' + (!row.available ? ' status-expired' : row.available <= 12 ? ' status-awaiting_payment' : '')}>{row.available ? row.available <= 12 ? 'Menipis' : 'Tersedia' : 'Habis'}</span></header><p className="workflow-stock-amount"><strong>{row.available.toLocaleString('id-ID')}</strong> satuan tersedia</p><ul>{row.variants.map((variant) => <li key={variant.id}><div><strong>{packagingLabel(variant)}</strong><small>{variant.id}</small></div><span>{Math.floor(row.available / packagingValues(variant).unitsPerPackage).toLocaleString('id-ID')} kemasan</span></li>)}</ul><button className="admin-secondary" onClick={() => { setTarget(row); setAmount(String(row.available)); setError(''); }} aria-label={`Ubah stok ${row.product.baseName} ${row.product.sizeLabel}`}>Ubah stok tersedia</button></li>)}</ul>}
    {target && <ConfirmDialog danger={false} title="Ubah stok simulasi" confirmLabel="Simpan stok" onConfirm={save} onClose={() => setTarget(null)} error={error}><p>{target.product.baseName} · {target.product.sizeLabel} per satuan. Isi jumlah satuan yang tersedia untuk pembelian baru. Stok pesanan yang sudah dibuat tetap dipertahankan.</p><label htmlFor="stock-available">Stok tersedia (satuan)<input id="stock-available" type="number" inputMode="numeric" min="0" max="1000000000" step="1" value={amount} aria-invalid={Boolean(error)} onChange={(event) => { setAmount(event.target.value); setError(''); }} /></label></ConfirmDialog>}
  </section>;
}
