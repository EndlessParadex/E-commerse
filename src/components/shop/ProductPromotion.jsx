import { promotionLabel, promotionTerms } from '../../data/promotions';
import { promotionOf, usePromotions } from '../../data/promotionStore';
import './ProductPromotion.css';

/** Product page: the running "beli X gratis Y" of the selected SKU, with its terms. */
export default function ProductPromotion({ variantId, unit }) {
  const promotion = promotionOf(variantId, usePromotions());
  if (!promotion) return null;
  return (
    <div className="detail-promotion">
      <span className="detail-promotion-badge">PROMO {promotionLabel(promotion)}</span>
      <p>
        <strong>
          Bayar {promotion.buy} {unit}, terima {promotion.buy + promotion.free} {unit}.
        </strong>{' '}
        Barang gratis ditambahkan otomatis di keranjang.
        <small>{promotionTerms(promotion)}</small>
      </p>
    </div>
  );
}
