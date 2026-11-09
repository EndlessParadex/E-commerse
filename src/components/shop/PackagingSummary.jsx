import { purchasePackagingLabel } from '../../data/packagingPresentation';
import { packagingValues } from '../../data/productPackaging';
import './PackagingSummary.css';

export default function PackagingSummary({ packaging, quantity }) {
  if (!packaging) return null;
  const contents = packagingValues(packaging).unitsPerPackage;
  return (
    <span className="purchase-packaging">
      {/* Show what one box/pack holds wherever the line is listed (cart, checkout, orders). */}
      <span className="purchase-packaging-total">
        {purchasePackagingLabel(packaging, quantity)}
        {contents > 1 && <span className="purchase-packaging-contents"> · isi {contents}</span>}
      </span>
    </span>
  );
}
