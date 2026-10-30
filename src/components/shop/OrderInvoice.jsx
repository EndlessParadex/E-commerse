import { useState } from 'react';
import { createPortal } from 'react-dom';
import useCompany from '../../state/useCompany';
import { rupiah, dateLabel } from './shopPresentation';
import { invoiceDiscount } from './invoiceDiscount';
import './Commerce.css';

export default function OrderInvoice({ order }) {
  const company = useCompany();
  const [paperFormat, setPaperFormat] = useState('a4');
  const dotMatrix = paperFormat === 'dotMatrix';
  const paper = dotMatrix
    ? { size: '241.3mm 279.4mm', margin: '8mm 12.7mm' }
    : { size: '210mm 297mm', margin: '16mm' };
  // Use the seller snapshot saved with this order, not editable current store settings.
  const seller = order.seller || company.profile;
  const payment = order.payment || {};
  const shipping = order.shipping || {};
  const finalized = order.commerceVersion !== 31 || shipping.quoted === true;
  const cod = payment.groupId === 'cod';
  const paid = payment.status === 'paid';
  const paymentLabel = cod ? 'Bayar di Tempat (COD)' : payment.label || 'Pembayaran toko';
  const totalSavings = order.items.reduce(
    (sum, item) => sum + (invoiceDiscount(item)?.savings || 0),
    0,
  );
  const paymentStatus = paid
    ? 'Sudah dibayar'
    : cod
      ? 'Belum dibayar — saat barang diterima'
      : 'Belum dikonfirmasi dibayar';

  const invoice = (
    <article
      className={'order-invoice' + (dotMatrix ? ' is-dot-matrix' : '')}
      aria-label="Faktur pesanan BAM"
    >
      <header className="invoice-header">
        <div className="invoice-seller">
          <div className="invoice-brand">
            BAM<span>.</span>
          </div>
          <strong>{seller.legalName || seller.shortName || 'BAM'}</strong>
          {seller.address && <p>{seller.address}</p>}
          {(seller.phone || seller.email) && (
            <p>{[seller.phone, seller.email].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        <div className="invoice-heading">
          <span className="invoice-eyebrow">
            {finalized ? 'RINCIAN PESANAN' : 'RINGKASAN PESANAN'}
          </span>
          <h2>{finalized ? 'Faktur pesanan' : 'Permintaan pesanan'}</h2>
          <span className="invoice-heading-date">{dateLabel(order.createdAt)}</span>
          <strong className="invoice-payment-tag">{cod ? 'COD' : paymentLabel}</strong>
        </div>
      </header>

      <section className="invoice-reference" aria-label="Identitas pesanan">
        <span>Nomor pesanan</span>
        <strong>{order.id}</strong>
      </section>

      <div className="invoice-details">
        <section className="invoice-details-card" aria-label="Penerima">
          <h3>Dikirim kepada</h3>
          <strong>{order.recipient}</strong>
          <p>{order.address}</p>
        </section>
        <section className="invoice-details-card" aria-label="Pembayaran">
          <h3>Informasi pembayaran</h3>
          <strong>{paymentLabel}</strong>
          <p>{paymentStatus}</p>
          {payment.reference && <p>Referensi: {payment.reference}</p>}
        </section>
      </div>

      <div className="invoice-table-wrap">
        <table className="invoice-items">
          <colgroup>
            <col className="invoice-col-number" />
            <col className="invoice-col-product" />
            <col className="invoice-col-quantity" />
            <col className="invoice-col-unit-price" />
            <col className="invoice-col-discount" />
            <col className="invoice-col-subtotal" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="invoice-number">
                No.
              </th>
              <th scope="col">Produk</th>
              <th scope="col" className="invoice-quantity">
                Qty
              </th>
              <th scope="col" className="invoice-money">
                Harga satuan
              </th>
              <th scope="col" className="invoice-discount">
                Diskon
              </th>
              <th scope="col" className="invoice-money">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={item.id}>
                <td className="invoice-number">{index + 1}</td>
                <td className="invoice-product">
                  <strong>{item.name}</strong>
                </td>
                <td className="invoice-quantity">{item.quantity}</td>
                <td className="invoice-money">
                  {rupiah(invoiceDiscount(item)?.oldPrice || item.price)}
                </td>
                <td className="invoice-discount">
                  {invoiceDiscount(item) ? (
                    <span className="invoice-discount-details">
                      <strong>−{invoiceDiscount(item).percentage}%</strong>
                      <span>{rupiah(item.price)}</span>
                    </span>
                  ) : (
                    <span className="invoice-no-discount">—</span>
                  )}
                </td>
                <td className="invoice-money">{rupiah(item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="invoice-summary" aria-label="Ringkasan biaya">
        <div className="invoice-summary-row">
          <span>Subtotal barang</span>
          <strong>{rupiah(order.subtotal)}</strong>
        </div>
        {totalSavings > 0 && (
          <div className="invoice-summary-row invoice-savings">
            <span>Total hemat</span>
            <strong>{rupiah(totalSavings)}</strong>
          </div>
        )}
        <div className="invoice-grand-total">
          <span>
            {finalized ? (cod ? 'Total pembayaran COD' : 'Total pembayaran') : 'Subtotal sementara'}
          </span>
          <strong>{rupiah(order.total)}</strong>
        </div>
      </section>

      <div className="invoice-payment-notice">
        <strong>Informasi pesanan</strong>
        <p>
          {!finalized
            ? 'Total akhir belum ditetapkan toko. Ringkasan ini bukan jumlah pembayaran final.'
            : order.codFixedTotal
              ? 'Harga final sejak checkout. Bayar total COD saat barang diterima.'
              : cod
                ? paid
                  ? 'Pembayaran COD sudah tercatat.'
                  : 'Bayar total pesanan saat barang diterima, sesuai rincian pesanan ini.'
                : order.total !== order.subtotal
                  ? 'Total akhir mengikuti biaya yang telah disepakati saat pesanan dibuat.'
                  : 'Rincian pembayaran mengikuti status dan metode pada pesanan ini.'}
        </p>
      </div>
      {order.note && (
        <section className="invoice-note">
          <strong>Catatan pembeli</strong>
          <p>{order.note}</p>
        </section>
      )}
      <footer className="invoice-footer">
        <strong>Terima kasih telah berbelanja di BAM.</strong>
        <span>Dokumen ini adalah rincian pesanan, bukan faktur pajak.</span>
      </footer>
    </article>
  );

  return (
    <>
      <details className="confirmation-card commerce-invoice-disclosure">
        <summary>Faktur / ringkasan pesanan</summary>
        <div className="commerce-invoice-controls">
          <label htmlFor="invoice-paper-format">
            Format faktur
            <select
              id="invoice-paper-format"
              value={paperFormat}
              onChange={(event) => setPaperFormat(event.target.value)}
            >
              <option value="a4">A4 (210 × 297 mm)</option>
              <option value="dotMatrix">Invoice Dot Matrix (9,5 × 11 inci)</option>
            </select>
          </label>
          <button
            className="shop-primary commerce-print-button"
            type="button"
            onClick={() => window.print()}
          >
            Cetak / simpan PDF
          </button>
        </div>
        <p className="commerce-invoice-paper-hint">
          {dotMatrix
            ? 'Gunakan kertas continuous form 9,5 × 11 inci. Samakan ukuran di pengaturan printer, pilih skala 100%, dan nonaktifkan header/footer browser.'
            : 'Gunakan kertas A4. Periksa pratinjau cetak sebelum mencetak atau menyimpan PDF.'}
        </p>
        <div className={'commerce-invoice-preview' + (dotMatrix ? ' is-dot-matrix' : '')}>
          {invoice}
        </div>
      </details>
      {typeof document !== 'undefined' &&
        createPortal(
          <div className={'invoice-print-root invoice-print-root--' + paperFormat}>
            <style>{`@media print { @page { size: ${paper.size}; margin: ${paper.margin}; } }`}</style>
            {invoice}
          </div>,
          document.body,
        )}
    </>
  );
}
