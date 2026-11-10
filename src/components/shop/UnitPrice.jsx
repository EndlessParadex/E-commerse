import { unitPrice } from '../../data/packagingPresentation';
import { rupiah } from './shopPresentation';

/**
 * " · Rp 6.400 / satuan" after a package price on the product page, where buyers compare
 * packages. Renders nothing for satuan lines. Not used in the cart or checkout: those lists
 * count packages only, by design (see packagingUi.test.js).
 */
export default function UnitPrice({ packaging, price }) {
  const each = unitPrice(packaging, price);
  if (!each) return null;
  return (
    <span className="unit-price">
      {' · '}
      {each.exact ? '' : '≈ '}
      {rupiah(each.value)} / satuan
    </span>
  );
}
