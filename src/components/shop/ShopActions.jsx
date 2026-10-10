import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useShop } from '../../state/useShop';
import { useDelivery } from '../../state/useDelivery';
import { ActionIcon } from './ShopIcon';
import AccountMenu from '../account/AccountMenu';
import { rupiah } from './shopPresentation';
import NotificationItem from './NotificationItem';
import './ShopActions.css';
import './Notifications.css';

export default function ShopActions({ onOpen }) {
  const shop = useShop();
  const { user } = useDelivery();
  const [active, setActive] = useState(null);
  const rootRef = useRef(null);
  const closeTimer = useRef(null);

  const close = () => {
    clearTimeout(closeTimer.current);
    setActive(null);
  };
  const open = (kind) => {
    clearTimeout(closeTimer.current);
    onOpen?.();
    setActive(kind);
  };

  useEffect(() => {
    const handleOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        clearTimeout(closeTimer.current);
        setActive(null);
      }
    };
    const handleRoute = () => {
      clearTimeout(closeTimer.current);
      setActive(null);
    };
    document.addEventListener('pointerdown', handleOutside);
    window.addEventListener('hashchange', handleRoute);
    return () => {
      clearTimeout(closeTimer.current);
      document.removeEventListener('pointerdown', handleOutside);
      window.removeEventListener('hashchange', handleRoute);
    };
  }, []);

  useLayoutEffect(() => {
    if (!active) return;
    const position = () => {
      const trigger = rootRef.current?.querySelector(`[data-kind="${active}"]`);
      const popup = trigger?.querySelector('.shop-preview');
      if (!popup) return;
      const rect = trigger.getBoundingClientRect();
      const width = popup.getBoundingClientRect().width;
      const left = Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16));
      popup.style.left = `${left - rect.left}px`;
      popup.style.setProperty('--preview-arrow-left', `${Math.max(16, Math.min(width - 16, rect.left + rect.width / 2 - left))}px`);
      popup.style.setProperty('--preview-max-height', `${Math.max(100, window.innerHeight - rect.bottom - 32)}px`);
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [active]);

  return <div className="icon-group shop-actions" ref={rootRef}>
    {['cart', 'notifications', 'account'].map((kind) => {
      const isCart = kind === 'cart';
      const isAccount = kind === 'account';
      const count = isAccount ? 0 : isCart ? shop.quantity : shop.unreadCount;
      const title = isAccount ? 'Akun saya' : isCart ? 'Keranjang' : 'Notifikasi';
      const href = isAccount ? '#/akun' : isCart ? '#/keranjang' : '#/notifikasi';
      const expanded = active === kind;
      return <div className="shop-hover-target" data-kind={kind} key={kind}
        onPointerEnter={(event) => { if (event.pointerType !== 'touch') open(kind); }}
        onPointerLeave={() => { closeTimer.current = setTimeout(() => setActive(null), 140); }}
        onFocus={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) open(kind); }}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}
        onKeyDown={(event) => { if (event.key === 'Escape') { close(); event.stopPropagation(); } }}>
        <a className={isAccount ? "user-profile account-trigger" : "action-icon shop-action"} href={href} aria-label={isAccount ? (user ? 'Akun saya, ' + user.name : 'Akun saya, masuk') : isCart ? 'Keranjang, ' + count + ' barang' : 'Notifikasi, ' + count + ' belum dibaca'} aria-expanded={expanded} aria-controls={'preview-' + kind} onClick={close}>
          <ActionIcon notification={!isCart && !isAccount} account={isAccount} />
          {isAccount && <span>{user ? 'Akun Saya' : 'Masuk / Daftar'}</span>}
          {count > 0 && <span className="shop-badge" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
        </a>
        {expanded && <section className="shop-preview" id={`preview-${kind}`} aria-label={`Ringkasan ${title.toLowerCase()}`}>
          <div className="shop-preview-inner">
            <header className="shop-preview-header"><h2>{title}</h2><span>{!isAccount && <>{count} {isCart ? 'barang' : 'belum dibaca'}</>}</span></header>
            {!isCart && !isAccount && shop.notifications.length > 0 && <div className="preview-notification-toolbar"><button type="button" className="shop-text-button" disabled={shop.unreadCount === 0} onClick={() => shop.dispatch({ type: 'readAll' })}>Tandai semua sudah dibaca</button></div>}
            {isAccount ? <div className="account-preview-body">
              <div className="account-preview-avatar"><ActionIcon account /></div>
              {user ? <><h3>Halo, {user.name}</h3><p>{user.email}</p></> : <><h3>Selamat datang di BAM.</h3><p>Masuk atau buat akun untuk pengalaman belanja Anda.</p><a className="shop-primary" href="#/login" onClick={close}>Masuk</a><a className="account-secondary" href="#/daftar" onClick={close}>Daftar akun baru</a></>}
              <div className="account-preview-menu"><AccountMenu onNavigate={close} /></div>
            </div> : isCart ? <>
              {shop.cart.length === 0 ? <p className="shop-preview-empty">Keranjang masih kosong.</p> : <ul className="shop-preview-list">
                {shop.cart.slice(0, 4).map((item) => <li key={item.id}><div><strong>{item.name}</strong><p>{item.quantity} × {rupiah(item.price)}</p></div><span>{rupiah(item.price * item.quantity)}</span></li>)}
              </ul>}
              {shop.cart.length > 4 && <p className="shop-preview-more">+{shop.cart.length - 4} produk lainnya</p>}
              {shop.cart.length > 0 && <div className="shop-preview-total"><span>Subtotal</span><strong>{rupiah(shop.subtotal)}</strong></div>}
            </> : <>
              <p className="notification-preview-context">Pembaruan pesanan percobaan · Simulasi</p>
              {shop.notifications.length === 0 ? <p className="shop-preview-empty">Belum ada notifikasi.</p> : <ul className="shop-preview-list">
                {shop.notifications.slice(0, 3).map((item) => <NotificationItem key={item.id} item={item} compact onRead={(id) => shop.dispatch({ type: 'read', id })} onNavigate={close} orderLinkStatus={shop.orderLinkStatus(item.orderId)} />)}
              </ul>}
              {shop.notifications.length > 3 && <p className="shop-preview-more">+{shop.notifications.length - 3} notifikasi lainnya</p>}
            </>}
            {!isAccount && <footer className="shop-preview-footer"><a className="shop-primary" href={href} onClick={close}>{isCart ? 'Lihat keranjang' : 'Lihat semua notifikasi'} <span aria-hidden="true">→</span></a></footer>}
          </div>
        </section>}
      </div>;
    })}
  </div>;
}
