import { purchasePackagingLabel } from '../../data/packagingPresentation';
import './PackagingSummary.css';

export default function PackagingSummary({ packaging, quantity }) {
  if (!packaging) return null;
  return <span className="purchase-packaging"><span className="purchase-packaging-total">{purchasePackagingLabel(packaging, quantity)}</span></span>;
}
