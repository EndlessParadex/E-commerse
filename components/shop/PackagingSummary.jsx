import { packagingLabel, packagingContents, packagingQuantity } from '../../data/productPackaging';
import './PackagingSummary.css';

export default function PackagingSummary({ packaging, quantity }) {
  if (!packaging) return null;
  return <span className="purchase-packaging"><span>{packagingLabel(packaging)}</span>{packaging.packagingType !== 'satuan' && <><span>{packagingContents(packaging)}</span><span className="purchase-packaging-total">{packagingQuantity(packaging, quantity)}</span></>}</span>;
}
