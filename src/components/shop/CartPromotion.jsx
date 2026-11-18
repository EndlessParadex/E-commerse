import { freeQuantity, lineFree, promotionLabel, unitsToNextFree } from '../../data/promotions';
import { promotionOf, usePromotions } from '../../data/promotionStore';
import './CartPromotion.css';

/**
 * Under a cart line: the promotion badge, the free units as their own "GRATIS" row, and a
 * nudge when a few more would earn the next free unit.
 */
export default function CartPromotion({ variantId, quantity, name, unit, maximum, onAdd }) {
  const promotions = usePromotions();
  const promotion = promotionOf(variantId, promotions);
  if (!promotion) return null;
  const free = lineFree(promotion, quantity, maximum);
  const more = unitsToNextFree(promotion, quantity);
  const canAdd = onAdd && Number.isFinite(maximum) && quantity + more + promotion.free <= maximum;
  const label = promotionLabel(promotion);
  return (
    <div className="cart-promotion">
      <span className="promo-badge">PROMO {label}</span>
      {free > 0 && (
        <div className="cart-free-line">
          <span className="cart-free-icon" aria-hidden="true">
            🎁
          </span>
          <span className="cart-free-text">
            <strong>
              Gratis · {free} {unit}
            </strong>
            <span>{name}</span>
          </span>
          <strong className="cart-free-price">GRATIS</strong>
        </div>
      )}
      {more > 0 && freeQuantity(promotion, quantity + more) > freeQuantity(promotion, quantity) && (
        <p className="cart-promotion-next">
          Tambah {more} {unit} lagi untuk dapat {promotion.free} {unit} gratis.
          {canAdd && (
            <button type="button" onClick={() => onAdd(more)}>
              + Tambah {more}
            </button>
          )}
        </p>
      )}
      {free < freeQuantity(promotion, quantity) && (
        <p className="cart-promotion-next">Barang gratis dibatasi stok yang tersisa.</p>
      )}
    </div>
  );
}
