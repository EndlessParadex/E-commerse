import { createPortal } from 'react-dom';
import useCompany from '../../state/useCompany';
import { rupiah, dateLabel } from './shopPresentation';
import './Commerce.css';
export default function OrderInvoice({ order }) {
  const company = useCompany();
  const seller = order.seller || company.profile;
  const finalized = order.commerceVersion !== 31 || order.shipping.quoted === true;
  const invoice = (
    <article className="order-invoice">
      <header>
        <h2>{finalized ? 'Faktur pesanan' : 'Ringkasan permintaan pesanan'}</h2>
        <strong>{seller.legalName || seller.shortName}</strong>
        <p>
          {seller.address}
          <br />
          {seller.phone} {seller.email}
        </p>
      </header>
      <p>
        Nomor: <strong>{order.id}</strong>
        <br />
        Tanggal: {dateLabel(order.createdAt)}
        <br />
        Status pembayaran:{' '}
        {order.payment.status === 'paid'
          ? 'Sudah dibayar'
          : order.payment.groupId === 'cod'
            ? 'COD'
            : 'Belum dikonfirmasi dibayar'}
      </p>
      <p>
        <strong>Penerima: {order.recipient}</strong>
        <br />
        {order.address}
      </p>
      <table>
        <thead>
          <tr>
            <th>Barang / SKU</th>
            <th>Jumlah</th>
            <th>Harga</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.name}
                <br />
                <small>{item.id}</small>
              </td>
              <td>{item.quantity}</td>
              <td>{rupiah(item.price)}</td>
              <td>{rupiah(item.price * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Subtotal barang: {rupiah(order.subtotal)}
        <br />
        Ongkir: {finalized ? rupiah(order.shipping.cost) : 'Belum ditetapkan'}
        <br />
        <strong>
          {finalized ? 'Total akhir' : 'Subtotal sementara'}: {rupiah(order.total)}
        </strong>
      </p>
      {order.payment.reference && <p>Referensi pembayaran: {order.payment.reference}</p>}
      <p>
        {finalized
          ? 'Total sesuai penawaran toko.'
          : 'Ringkasan ini belum menjamin stok dan belum termasuk ongkir.'}{' '}
        Dokumen ini bukan faktur pajak.
      </p>
    </article>
  );
  return (
    <>
      <details className="confirmation-card commerce-invoice-disclosure">
        <summary>Faktur / ringkasan pesanan</summary>
        <button
          className="shop-primary commerce-print-button"
          type="button"
          onClick={() => window.print()}
        >
          Cetak / simpan PDF
        </button>
        {invoice}
      </details>
      {typeof document !== 'undefined' &&
        createPortal(<div className="invoice-print-root">{invoice}</div>, document.body)}
    </>
  );
}
