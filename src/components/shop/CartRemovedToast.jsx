import { useEffect, useRef, useState } from 'react';
import ProductImage from './ProductImage';
import { cartItemPresentation } from '../../data/cartItemPresentation';
import { packagingLabel } from '../../data/productPackaging';
import './CartAddedPopup.css';

const SHOW_MS = 8000;

/**
 * "Dihapus dari keranjang" with an undo button, in the same place and style as the
 * "Masuk keranjang" popup: top right on a computer, above the bottom menu on a phone.
 * The countdown pauses while the pointer or keyboard focus is inside.
 */
export default function CartRemovedToast({ removed, onUndo, onClose }) {
  const [hold, setHold] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    window.clearTimeout(timer.current);
    if (!removed || hold) return undefined;
    timer.current = window.setTimeout(onClose, SHOW_MS);
    return () => window.clearTimeout(timer.current);
  }, [removed, hold, onClose]);
  if (!removed) return null;
  const display = cartItemPresentation(removed.item);
  const pack = display.packaging ? packagingLabel(display.packaging) : '';
  const meta = [
    display.sizeLabel,
    `${removed.item.quantity} ${display.packaging?.packagingType === 'satuan' || !pack ? 'buah' : display.packaging.packagingType}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="cart-added-region" role="status" aria-live="polite">
      <section
        key={removed.item.id + ':' + removed.at}
        className="cart-added-popup cart-removed-popup"
        aria-label="Barang dihapus dari keranjang"
        onPointerEnter={() => setHold(true)}
        onPointerLeave={() => setHold(false)}
        onFocus={() => setHold(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setHold(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      >
        <header className="cart-added-head">
          <svg className="cart-removed-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5" />
          </svg>
          <strong>Dihapus dari keranjang</strong>
          <button
            type="button"
            className="cart-added-close"
            aria-label="Tutup pemberitahuan"
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="cart-added-item">
          <div className="cart-added-thumb">
            <ProductImage product={display.product} variant="thumbnail" loading="eager" />
          </div>
          <div className="cart-added-text">
            <span className="cart-added-name">{display.name}</span>
            <span className="cart-added-meta">{meta}</span>
          </div>
        </div>
        <button type="button" className="cart-added-primary cart-removed-undo" onClick={onUndo}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
          </svg>
          Urungkan
        </button>
        <span
          className={'cart-added-timer' + (hold ? ' is-held' : '')}
          style={{ '--cart-added-ms': SHOW_MS + 'ms' }}
          aria-hidden="true"
        />
      </section>
    </div>
  );
}
