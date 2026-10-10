import { useEffect, useRef, useState } from 'react';
import { useShop } from '../../state/useShop';
import { notificationKind, shortOrderId } from '../../state/orderNotifications';
import { ActionIcon } from './ShopIcon';
import ConfirmDialog from './ConfirmDialog';
import NotificationItem from './NotificationItem';
import './Notifications.css';

function dayLabel(time, now) {
  const day = new Date(time); const today = new Date(now); const yesterday = new Date(now);
  yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return 'Hari ini';
  if (day.toDateString() === yesterday.toDateString()) return 'Kemarin';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(day);
}

export default function NotificationsPanel() {
  const shop = useShop();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(10);
  const [confirmClear, setConfirmClear] = useState(false);
  const [deleted, setDeleted] = useState(null);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const filterRef = useRef(null);
  const wasConfirmOpen = useRef(false);
  useEffect(() => {
    if (wasConfirmOpen.current && !confirmClear) filterRef.current?.querySelector('[aria-pressed="true"]')?.focus();
    wasConfirmOpen.current = confirmClear;
  }, [confirmClear]);
  const unread = shop.unreadCount;
  const readCount = shop.notifications.length - unread;
  const filters = [
    { id: 'all', label: 'Semua', count: shop.notifications.length },
    { id: 'unread', label: 'Belum dibaca', count: unread },
    { id: 'orders', label: 'Pesanan', count: shop.notifications.filter((item) => notificationKind(item.kind)?.category === 'orders').length },
    { id: 'payments', label: 'Pembayaran', count: shop.notifications.filter((item) => notificationKind(item.kind)?.category === 'payments').length },
  ];
  const search = query.trim().toLocaleLowerCase('id-ID');
  const filtered = shop.notifications.filter((item) => {
    const category = notificationKind(item.kind)?.category;
    return (filter === 'all' || (filter === 'unread' ? !item.read : category === filter)) && (!search || `${item.title} ${item.message} ${item.orderId || ''} ${item.orderId ? shortOrderId(item.orderId) : ''}`.toLocaleLowerCase('id-ID').includes(search));
  });
  const groups = new Map();
  for (const item of filtered.slice(0, limit)) {
    const label = dayLabel(item.createdAt, now);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  }
  const focusFilter = () => filterRef.current?.querySelector('[aria-pressed="true"]')?.focus();
  const read = (id) => { shop.dispatch({ type: 'read', id }); setNotice('Notifikasi ditandai sudah dibaca.'); if (filter === 'unread') focusFilter(); };
  const remove = (item) => { setDeleted(item); shop.dispatch({ type: 'removeNotification', id: item.id }); setNotice('Notifikasi dihapus. Pesanan tetap ada di riwayat.'); focusFilter(); };
  const reset = () => { setFilter('all'); setQuery(''); setLimit(10); };

  return <section className="notifications-panel" aria-label="Daftar notifikasi">
    <p className="notifications-context"><span className="notification-simulation">Simulasi</span><span>Pembaruan pesanan dan pembayaran percobaan Anda.</span></p>
    <div className="notifications-controls">
      <div className="notification-filters" role="group" aria-label="Filter notifikasi" ref={filterRef}>{filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => { setFilter(item.id); setLimit(10); }}><span>{item.label}</span><span className="notification-filter-count">{item.count}</span></button>)}</div>
      <label className="notification-search">Cari notifikasi<input type="search" value={query} maxLength={200} placeholder="Nomor pesanan atau isi notifikasi" onChange={(event) => { setQuery(event.target.value); setLimit(10); }} /></label>
    </div>
    {shop.notifications.length > 0 && <div className="notification-toolbar">
      <span className={unread === 0 ? 'notification-all-read' : 'notification-results'} role="status">{unread === 0 ? 'Semua notifikasi sudah dibaca' : `${unread} notifikasi belum dibaca`}</span>
      <div className="notification-toolbar-actions"><button type="button" className="shop-text-button" disabled={unread === 0} onClick={() => { shop.dispatch({ type: 'readAll' }); setNotice('Semua notifikasi ditandai sudah dibaca.'); }}>Tandai semua dibaca</button><button type="button" className="shop-delete" disabled={readCount === 0} onClick={() => setConfirmClear(true)}>Hapus yang sudah dibaca</button></div>
    </div>}
    <div className="notification-feedback" role="status">{notice && <span>{notice}</span>}{deleted && <button type="button" className="shop-text-button" onClick={() => { shop.dispatch({ type: 'restoreNotification', notification: deleted }); setDeleted(null); setNotice('Notifikasi dikembalikan.'); }}>Urungkan hapus</button>}</div>
    {filtered.length === 0 ? <div className="shop-empty notification-empty"><ActionIcon notification /><h3>{shop.notifications.length === 0 ? 'Belum ada notifikasi' : filter === 'unread' && !search ? 'Semua sudah dibaca' : 'Tidak ada notifikasi yang cocok'}</h3><p>{shop.notifications.length === 0 ? 'Pembaruan akan muncul saat Anda membuat pesanan atau statusnya berubah.' : filter === 'unread' && !search ? 'Notifikasi baru akan muncul di sini saat ada pembaruan.' : 'Coba kata pencarian lain atau tampilkan semua notifikasi.'}</p>{shop.notifications.length === 0 ? <a className="shop-primary" href="#/pesanan">Lihat pesanan saya</a> : <button type="button" className="bam-button-secondary" onClick={reset}>Tampilkan semua notifikasi</button>}</div> : <>
      <p className="notification-results" aria-live="polite">Menampilkan {Math.min(limit, filtered.length)} dari {filtered.length} notifikasi</p>
      {[...groups].map(([label, items]) => <section className="notification-day" key={label} aria-label={label}><h2>{label}</h2><ul className="shop-list">{items.map((item) => <NotificationItem key={item.id} item={item} onRead={read} onDelete={remove} orderLinkStatus={shop.orderLinkStatus(item.orderId)} />)}</ul></section>)}
      {filtered.length > limit && <button type="button" className="bam-button-secondary notification-load-more" onClick={() => setLimit((value) => value + 10)}>Tampilkan lebih banyak</button>}
    </>}
    {confirmClear && <ConfirmDialog title="Hapus notifikasi yang sudah dibaca?" confirmLabel="Ya, hapus notifikasi" onClose={() => setConfirmClear(false)} onConfirm={() => { shop.dispatch({ type: 'removeReadNotifications' }); setConfirmClear(false); setDeleted(null); setNotice('Notifikasi yang sudah dibaca dihapus. Riwayat pesanan tetap tersedia.'); }}><p>{readCount} notifikasi yang sudah dibaca akan dihapus. Notifikasi yang belum dibaca dan riwayat pesanan tetap tersimpan.</p></ConfirmDialog>}
  </section>;
}
