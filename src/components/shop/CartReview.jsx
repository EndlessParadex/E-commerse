import { useShop } from '../../state/useShop';
import { rupiah } from './shopPresentation';
import { packagingValues } from '../../data/productPackaging';
import { cartItemPresentation } from '../../data/cartItemPresentation';
import { purchasePackagingLabel, purchaseProductName } from '../../data/packagingPresentation';

export default function CartReview() {
  const shop = useShop();
  if (!shop.cartReview.issues.length) return null;
  return <section className="cart-review" role="alert" aria-labelledby="cart-review-title"><h2 id="cart-review-title">Periksa kembali keranjang</h2><p>Sesuaikan informasi dan jumlah barang sebelum melanjutkan checkout.</p><ul>{shop.cartReview.issues.map((issue) => {
    const saved = shop.cart.find((item) => item.id === issue.id);
    const display = saved && cartItemPresentation(saved);
    const name = display ? purchaseProductName({ name: issue.name, baseName: display.name, sizeLabel: display.sizeLabel, ...display.packaging }) : issue.name;
    return <li key={issue.id + issue.type}><strong>{name}</strong>{issue.type === 'stock_error' ? <span>Stok belum dapat diperiksa karena penyimpanan browser tidak tersedia. Coba muat ulang halaman.</span> : issue.type === 'stock' ? <><span>{issue.maximum ? `Stok tidak cukup. Maksimal ${purchasePackagingLabel(issue.current, issue.maximum)} dengan isi keranjang saat ini.` : 'Stok untuk kemasan ini habis atau sudah digunakan pilihan kemasan lain pada keranjang.'}</span>{issue.maximum > 0 && <button type="button" className="bam-button-secondary" onClick={() => shop.dispatch({ type: 'quantity', id: issue.id, quantity: issue.maximum })}>Sesuaikan jumlah dengan stok</button>}<button type="button" className="bam-button-danger" onClick={() => shop.dispatch({ type: 'remove', id: issue.id })}>Hapus dari keranjang</button></> : issue.type === 'unavailable' ? <><span>Produk sudah tidak tersedia.</span><button type="button" className="bam-button-danger" onClick={() => shop.dispatch({ type: 'remove', id: issue.id })}>Hapus barang tidak tersedia</button></> : <><span>Informasi diperbarui menjadi {purchaseProductName(issue.current)} · {rupiah(issue.current.price)} untuk {purchasePackagingLabel(issue.current)}.</span>{JSON.stringify(packagingValues(display?.packaging || {})) !== JSON.stringify(packagingValues(issue.current)) && <span>Isi kemasan diperbarui: {packagingValues(issue.current).unitsPerPackage} barang dalam {purchasePackagingLabel(issue.current)}.</span>}</>}</li>;
  })}</ul>{shop.cartReview.issues.some((issue) => issue.type === 'changed') && <button type="button" className="bam-button-secondary" onClick={shop.updateCart}>Gunakan informasi dan harga terbaru</button>}</section>;
}
