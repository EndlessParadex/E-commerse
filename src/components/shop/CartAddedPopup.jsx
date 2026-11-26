import { useEffect, useRef, useState } from 'react';
import ProductImage from './ProductImage';
import { CART_ADDED_EVENT } from '../../state/cartFeedback';
import { packagingValues } from '../../data/productPackaging';
import './CartAddedPopup.css';
import './StoreMotion.css';

const SHOW_MS = 4200;
const FLY_MS = 700;

const reduceMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

// The visible header cart icon; on phones it may be hidden, then nothing flies.
const cartTarget = () => {
  const node = document.querySelector('.shop-hover-target[data-kind="cart"] .shop-action');
  if (!node) return null;
  const box = node.getBoundingClientRect();
  return box.width > 0 && box.height > 0 ? box : null;
};

// "180g · 2 renceng", or "180g · 1 buah" for single pieces.
function describe(product, quantity) {
  let pack = '';
  try {
    const type = packagingValues(product).packagingType;
    pack = type && type !== 'satuan' ? type : '';
  } catch {
    pack = '';
  }
  return [product.sizeLabel, `${quantity} ${pack || 'buah'}`].filter(Boolean).join(' · ');
}

/** Shared "masuk keranjang" popup, plus a small photo that flies into the header cart. */
export default function CartAddedPopup() {
  const [item, setItem] = useState(null);
  const [flyer, setFlyer] = useState(null);
  const [hold, setHold] = useState(false);
  const hideTimer = useRef(null);
  const flyerRef = useRef(null);
  const serial = useRef(0);

  useEffect(() => {
    const onAdded = (event) => {
      const { product, quantity, rect } = event.detail || {};
      // A slow save can finish after the buyer already opened the cart; no popup there.
      if (!product || /^#\/(keranjang|checkout)/.test(window.location.hash)) return;
      serial.current += 1;
      const id = serial.current;
      setItem({ id, product, meta: describe(product, quantity || 1) });
      const target = !reduceMotion() && rect ? cartTarget() : null;
      setFlyer(target ? { id, product, rect, target } : null);
    };
    // Moving to another page (cart, checkout) closes it, so it never covers the next step.
    const onRoute = () => {
      setItem(null);
      setFlyer(null);
    };
    window.addEventListener(CART_ADDED_EVENT, onAdded);
    window.addEventListener('hashchange', onRoute);
    return () => {
      window.removeEventListener(CART_ADDED_EVENT, onAdded);
      window.removeEventListener('hashchange', onRoute);
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  // Auto-hide, paused while the pointer or keyboard focus is inside.
  useEffect(() => {
    window.clearTimeout(hideTimer.current);
    if (!item || hold) return undefined;
    hideTimer.current = window.setTimeout(() => setItem(null), SHOW_MS);
    return () => window.clearTimeout(hideTimer.current);
  }, [item, hold]);

  useEffect(() => {
    const node = flyerRef.current;
    if (!flyer || !node || typeof node.animate !== 'function') return undefined;
    const size = 64;
    const from = {
      x: flyer.rect.left + flyer.rect.width / 2 - size / 2,
      y: flyer.rect.top + flyer.rect.height / 2 - size / 2,
    };
    const to = {
      x: flyer.target.left + flyer.target.width / 2 - size / 2,
      y: flyer.target.top + flyer.target.height / 2 - size / 2,
    };
    // Arc upward, but keep the photo on screen when the cart sits at the very top.
    const lift = Math.max(12, Math.min(from.y, to.y) - 90);
    const animation = node.animate(
      [
        { transform: `translate(${from.x}px, ${from.y}px) scale(1)`, opacity: 0.95 },
        {
          transform: `translate(${(from.x + to.x) / 2}px, ${lift}px) scale(0.75)`,
          opacity: 1,
          offset: 0.45,
        },
        { transform: `translate(${to.x}px, ${to.y}px) scale(0.2)`, opacity: 0.4 },
      ],
      { duration: FLY_MS, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'forwards' },
    );
    const done = () => setFlyer((current) => (current?.id === flyer.id ? null : current));
    animation.onfinish = done;
    return () => {
      animation.onfinish = null;
      animation.cancel();
    };
  }, [flyer]);

  const close = () => setItem(null);

  return (
    <>
      {flyer && (
        <div className="cart-flyer" ref={flyerRef} aria-hidden="true">
          <ProductImage product={flyer.product} variant="thumbnail" loading="eager" />
        </div>
      )}
      <div className="cart-added-region" role="status" aria-live="polite">
        {item && (
          <section
            key={item.id}
            className="cart-added-popup"
            aria-label="Barang masuk keranjang"
            onPointerEnter={() => setHold(true)}
            onPointerLeave={() => setHold(false)}
            onFocus={() => setHold(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setHold(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') close();
            }}
          >
            <header className="cart-added-head">
              <svg className="cart-added-check" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M7.5 12.5l3 3 6-6.5" />
              </svg>
              <strong>Masuk keranjang</strong>
              <button
                type="button"
                className="cart-added-close"
                aria-label="Tutup pemberitahuan"
                onClick={close}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </header>
            <div className="cart-added-item">
              <div className="cart-added-thumb">
                <ProductImage product={item.product} variant="thumbnail" loading="eager" />
              </div>
              <div className="cart-added-text">
                <span className="cart-added-name">{item.product.name}</span>
                <span className="cart-added-meta">{item.meta}</span>
              </div>
            </div>
            <div className="cart-added-actions">
              <a className="cart-added-primary" href="#/keranjang" onClick={close}>
                Lihat keranjang
              </a>
              <button type="button" className="cart-added-secondary" onClick={close}>
                Lanjut belanja
              </button>
            </div>
            <span
              className={'cart-added-timer' + (hold ? ' is-held' : '')}
              style={{ '--cart-added-ms': SHOW_MS + 'ms' }}
              aria-hidden="true"
            />
          </section>
        )}
      </div>
    </>
  );
}
