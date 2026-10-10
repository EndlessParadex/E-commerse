import { isOrderNotification, notificationKind, shortOrderId } from '../../state/orderNotifications';
import { dateLabel } from './shopPresentation';

export function NotificationIcon({ kind }) {
  const icon = notificationKind(kind)?.icon;
  return <span className={'notification-icon tone-' + (notificationKind(kind)?.tone || 'info')} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {icon === 'check' ? <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></> : icon === 'cancel' ? <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></> : icon === 'truck' ? <><path d="M3 6h11v11H3zM14 10h4l3 4v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></> : icon === 'clock' ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> : icon === 'alert' ? <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v4m0 4h.01" /></> : <><path d="M5 7h14l1 14H4L5 7Z" /><path d="M8 7V6a4 4 0 0 1 8 0v1" /></>}
  </svg></span>;
}

export default function NotificationItem({ item, compact = false, onRead, onDelete, onNavigate, orderLinkStatus = 'available' }) {
  return <li className={'notification-item' + (compact ? ' notification-compact' : '') + (item.read ? '' : ' is-unread')}>
    <NotificationIcon kind={item.kind} />
    <div className="notification-content">
      <div className="notification-heading"><h3>{item.title}</h3>{!item.read && <span className="notification-status">Belum dibaca</span>}</div>
      <p>{item.message}</p>
      <div className="notification-meta">{isOrderNotification(item) && <span>Pesanan #{shortOrderId(item.orderId)}</span>}<time dateTime={new Date(item.createdAt).toISOString()}>{dateLabel(item.createdAt)}</time></div>
      <div className="notification-actions">
        <div className="notification-primary-actions">{isOrderNotification(item) && (orderLinkStatus === 'available' ? <a className="shop-text-button" href={'#/pesanan/' + encodeURIComponent(item.orderId)} onClick={() => { onRead(item.id); onNavigate?.(); }}>Lihat detail pesanan <span aria-hidden="true">→</span></a> : <span className="notification-history-unavailable">{orderLinkStatus === 'unavailable' ? 'Detail pesanan belum dapat dibaca. Coba muat ulang halaman.' : 'Detail pesanan tersedia di tab tempat pesanan dibuat.'}</span>)}{!compact && !item.read && <button type="button" className="shop-text-button notification-mark-read" aria-label={'Tandai dibaca: ' + item.title + (item.orderId ? ', pesanan ' + shortOrderId(item.orderId) : '')} onClick={() => onRead(item.id)}>Tandai dibaca</button>}</div>
        {!compact && <button type="button" className="shop-delete" aria-label={'Hapus notifikasi ' + item.title + (item.orderId ? ', pesanan ' + shortOrderId(item.orderId) : '')} onClick={() => onDelete(item)}>Hapus</button>}
      </div>
    </div>
  </li>;
}
