import { paymentMethod } from '../state/paymentMethods';
export const dateLabel = (value) =>
  new Date(value + 'T00:00:00+07:00').toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
export const timeLabel = (value) =>
  new Date(value).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
export const roles = { owner: 'Pemilik BAM', admin: 'Admin', sales: 'Sales', buyer: 'Pembeli' };
export const todayID = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type) => parts.find((entry) => entry.type === type)?.value;
  return value('year') + '-' + value('month') + '-' + value('day');
};
export const weekdays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export function eventLabel(event) {
  const { name, before, after } = event.details;
  if (event.action === 'payment')
    return `Mengubah pembayaran: ${paymentMethod(event.details.before)?.label || 'Belum dipilih'} → ${paymentMethod(event.details.after)?.label || 'Belum dipilih'}`;
  if (event.action === 'clear')
    return event.details.clearedItems
      ? `Mengosongkan keranjang (${event.details.clearedItems.length} SKU)`
      : 'Mengosongkan keranjang';
  if (event.action === 'refresh') return 'Memperbarui informasi dan harga dari katalog';
  if (event.action === 'request_review') return 'Mengajukan pemeriksaan keranjang kepada Admin';
  if (event.action === 'lock') return 'Mengunci keranjang untuk pemeriksaan Admin';
  if (event.action === 'unlock') return 'Membuka kembali keranjang: ' + event.details.reason;
  if (event.action === 'finalize') return 'Memfinalisasi pesanan ' + event.details.orderId;
  if (event.action === 'reschedule')
    return (
      'Menjadwalkan ulang: ' +
      event.details.from +
      ' → ' +
      event.details.to +
      '. Alasan: ' +
      event.details.reason
    );
  if (event.action === 'remove') return `Menghapus ${name} (${before} kemasan)`;
  if (event.action === 'switch_package')
    return `Mengubah kemasan ${event.details.fromSku} → ${event.details.toSku} (${event.details.quantity} kemasan)`;
  return `${name}: ${before} → ${after} kemasan`;
}
