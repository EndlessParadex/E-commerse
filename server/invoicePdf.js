import PDFDocument from 'pdfkit';
import { invoiceDiscount } from '../src/components/shop/invoiceDiscount.js';

const rupiah = (value) => 'Rp ' + value.toLocaleString('id-ID');
// Built-in PDF fonts cover Latin-1 only. Replace the rest so emoji cannot corrupt a line.
const safe = (value) => String(value ?? '').replace(/[^\t\n\r\x20-\x7e -ÿ]/g, '?');
const date = (value) =>
  new Date(value).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export const invoiceFilename = (order) =>
  'Faktur-' + String(order.id).replace(/[^A-Za-z0-9-]/g, '-') + '.pdf';

export function invoicePaymentStatus(order) {
  if (order.payment?.status === 'paid') return 'Lunas';
  return order.payment?.groupId === 'cod' ? 'Bayar saat barang diterima' : 'Menunggu pembayaran';
}

const left = 48,
  right = 547,
  width = right - left;
const columns = [
  { label: 'No.', x: left, width: 26 },
  { label: 'Produk', x: left + 30, width: 215 },
  { label: 'Qty', x: left + 249, width: 34, align: 'right' },
  { label: 'Harga satuan', x: left + 287, width: 104, align: 'right' },
  { label: 'Subtotal', x: left + 395, width: 104, align: 'right' },
];

function tableHeader(doc) {
  doc.font('Helvetica-Bold').fontSize(9);
  const y = doc.y;
  for (const column of columns)
    doc.text(column.label, column.x, y, { width: column.width, align: column.align || 'left' });
  doc
    .moveTo(left, y + 15)
    .lineTo(right, y + 15)
    .stroke();
  doc.y = y + 21;
}

function itemRow(doc, item, index) {
  const discount = invoiceDiscount(item);
  const name = safe(item.name) + (discount ? ` (diskon ${discount.percentage}%)` : '');
  doc.font('Helvetica').fontSize(9);
  const height = doc.heightOfString(name, { width: columns[1].width });
  if (doc.y + height > 760) {
    doc.addPage();
    tableHeader(doc);
    doc.font('Helvetica').fontSize(9);
  }
  const y = doc.y;
  const cells = [
    String(index + 1),
    name,
    String(item.quantity),
    rupiah(item.price),
    rupiah(item.price * item.quantity),
  ];
  cells.forEach((value, column) =>
    doc.text(value, columns[column].x, y, {
      width: columns[column].width,
      align: columns[column].align || 'left',
    }),
  );
  doc.y = y + height + 8;
}

function summaryRow(doc, label, value, bold = false) {
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9.5);
  const y = doc.y;
  doc.text(label, left + 249, y, { width: 130 });
  doc.text(value, left + 379, y, { width: 120, align: 'right' });
  doc.y = y + (bold ? 20 : 16);
}

// Uses the seller and price snapshots stored on the order, like the on-screen invoice.
export function renderInvoicePdf(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: left,
      info: { Title: 'Faktur pesanan ' + safe(order.id), Author: safe(order.seller?.shortName) },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const seller = order.seller || {};
    const payment = order.payment || {};
    const shipping = order.shipping || {};
    const destination = payment.destination;
    const paid = payment.status === 'paid';
    const paymentLabel =
      payment.groupId === 'cod' ? 'Bayar di Tempat (COD)' : payment.label || 'Pembayaran toko';
    const savings = order.items.reduce(
      (sum, item) => sum + (invoiceDiscount(item)?.savings || 0),
      0,
    );

    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .text(safe(seller.shortName || 'BAM'), left, 48);
    doc.font('Helvetica-Bold').fontSize(10).text(safe(seller.legalName), { width: 280 });
    doc.font('Helvetica').fontSize(9);
    if (seller.address) doc.text(safe(seller.address), { width: 280 });
    if (seller.phone || seller.email)
      doc.text(safe([seller.phone, seller.email].filter(Boolean).join(' / ')), { width: 280 });
    const sellerEnd = doc.y;
    doc.font('Helvetica-Bold').fontSize(16).text('Faktur pesanan', left, 48, {
      width,
      align: 'right',
    });
    doc.font('Helvetica').fontSize(9).text(date(order.createdAt), { width, align: 'right' });
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(paid ? 'LUNAS' : 'BELUM LUNAS', { width, align: 'right' });

    doc.y = Math.max(sellerEnd, doc.y) + 12;
    doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(1.5).stroke().lineWidth(0.75);
    doc.y += 10;
    doc.font('Helvetica').fontSize(9).text('Nomor pesanan', left);
    doc.font('Helvetica-Bold').fontSize(11).text(safe(order.id));
    doc.y += 10;

    const blockTop = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).text('Dikirim kepada', left, blockTop, { width: 240 });
    doc.font('Helvetica').text(safe(order.b2b?.storeName || order.recipient), { width: 240 });
    doc.text(safe(order.address), { width: 240 });
    const addressEnd = doc.y;
    doc.font('Helvetica-Bold').text('Informasi pembayaran', left + 260, blockTop, { width: 239 });
    doc.font('Helvetica').text(safe(paymentLabel), { width: 239 });
    doc.text(invoicePaymentStatus(order), { width: 239 });
    if (payment.reference) doc.text('Referensi: ' + safe(payment.reference), { width: 239 });
    if (destination && !paid) {
      doc.text(safe(`${destination.bank} ${destination.account}`), { width: 239 });
      doc.text('a.n. ' + safe(destination.holder), { width: 239 });
      if (destination.instructions) doc.text(safe(destination.instructions), { width: 239 });
    }

    doc.x = left;
    doc.y = Math.max(addressEnd, doc.y) + 18;
    tableHeader(doc);
    order.items.forEach((item, index) => itemRow(doc, item, index));
    doc.moveTo(left, doc.y).lineTo(right, doc.y).stroke();
    doc.y += 10;

    if (doc.y > 680) doc.addPage();
    summaryRow(doc, 'Subtotal barang', rupiah(order.subtotal));
    if (savings > 0) summaryRow(doc, 'Total hemat', rupiah(savings));
    summaryRow(doc, 'Ongkir', shipping.cost ? rupiah(shipping.cost) : 'Gratis');
    summaryRow(doc, 'Total pembayaran', rupiah(order.total), true);

    if (order.note) {
      doc.y += 8;
      doc.font('Helvetica-Bold').fontSize(9).text('Catatan pembeli', left, doc.y, { width });
      doc.font('Helvetica').text(safe(order.note), { width });
    }
    doc.y += 16;
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(
        'Terima kasih telah berbelanja di ' + safe(seller.shortName || 'BAM') + '.',
        left,
        doc.y,
        {
          width,
        },
      );
    doc
      .font('Helvetica')
      .text('Dokumen ini adalah rincian pesanan, bukan faktur pajak.', { width });
    doc.end();
  });
}
