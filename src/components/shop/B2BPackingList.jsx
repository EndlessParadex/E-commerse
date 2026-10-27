import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { b2bPackingList, packingColumns } from '../../data/b2bPackingList';
import './Commerce.css';
import './B2BPackingList.css';

const formats = {
  a4: { label: 'A4', size: '210mm 297mm', margin: '10mm' },
  continuousHalf: {
    label: 'Dot matrix · 9,5 × 5,5 inci',
    size: '241.3mm 139.7mm',
    margin: '8mm 12.7mm',
  },
  continuousFull: {
    label: 'Dot matrix · 9,5 × 11 inci',
    size: '241.3mm 279.4mm',
    margin: '8mm 12.7mm',
  },
};
export default function B2BPackingList({ order }) {
  const [format, setFormat] = useState('a4');
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState('');
  const printPending = useRef(false);
  useEffect(() => {
    if (!printing || printPending.current) return;
    printPending.current = true;
    const done = () => {
      printPending.current = false;
      setPrinting(false);
    };
    window.addEventListener('afterprint', done);
    const frame = window.requestAnimationFrame(() => {
      try {
        window.print();
      } catch {
        setPrintError('Jendela cetak belum dapat dibuka. Coba lagi.');
        done();
      }
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);
  let document;
  try {
    document = b2bPackingList(order);
  } catch (error) {
    return (
      <p className="shop-warning" role="status">
        {error.message}
      </p>
    );
  }
  const paper = formats[format];
  const content = (
    <article
      className={'b2b-packing-list' + (format === 'a4' ? '' : ' is-dot-matrix')}
      aria-label="Daftar barang B2B tanpa harga"
    >
      <header>
        <h2>{document.storeName}</h2>
        <p>Sales: {document.salesNames}</p>
      </header>
      <table>
        <thead>
          <tr>
            <th scope="col">Nama barang</th>
            {packingColumns.map(([key, label]) => (
              <th scope="col" key={key}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {document.rows.map((row, index) => (
            <tr key={index}>
              <td>
                {row.name}
                {row.size && <span> · {row.size}</span>}
                {row.contents && <small>{row.contents}</small>}
              </td>
              {packingColumns.map(([key]) => (
                <td key={key}>{row.quantities[key] || '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            {packingColumns.map(([key]) => (
              <td key={key}>{document.totals[key]}</td>
            ))}
          </tr>
        </tfoot>
      </table>
      <p className="b2b-packing-count">Jumlah jenis barang: {document.productCount}</p>
    </article>
  );
  return (
    <details className="confirmation-card b2b-packing-disclosure">
      <summary>Daftar barang B2B · tanpa harga</summary>
      <div className="b2b-print-controls">
        <label>
          Format kertas
          <select
            aria-label="Format kertas dokumen B2B"
            value={format}
            onChange={(event) => setFormat(event.target.value)}
          >
            {Object.entries(formats).map(([key, value]) => (
              <option value={key} key={key}>
                {value.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="admin-secondary"
          disabled={printing}
          onClick={() => {
            setPrintError('');
            setPrinting(true);
          }}
        >
          Cetak / simpan PDF tanpa harga
        </button>
      </div>
      <p className="b2b-print-hint">
        Samakan ukuran kertas pada pengaturan printer. Untuk dot matrix, gunakan continuous form
        yang sesuai dan skala 100%. Matikan header/footer browser agar alamat halaman tidak ikut
        tercetak.
      </p>
      {printError && (
        <p role="alert" className="shop-warning">
          {printError}
        </p>
      )}
      <div className="b2b-packing-preview">{content}</div>
      {printing &&
        createPortal(
          <div className="invoice-print-root b2b-print-root">
            <style>{`@media print { @page { size: ${paper.size}; margin: ${paper.margin}; } }`}</style>
            {content}
          </div>,
          window.document.body,
        )}
    </details>
  );
}
