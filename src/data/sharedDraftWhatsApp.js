/** Builds a WhatsApp draft for manual review, never sending a finalized order. */
export function sharedDraftWhatsAppUrl(cart) {
  const phone = String(cart?.store?.phone || '').trim();
  if (!/^\+62[1-9]\d{7,12}$/.test(phone) || !cart?.items?.length || cart.status === 'finalized')
    return null;
  const priced = cart.items.every((item) =>
    Number.isFinite(item.price) && item.price >= 0 && Number.isInteger(item.quantity)
  );
  const estimatedTotal = priced
    ? new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(cart.items.reduce((sum, item) => sum + item.quantity * item.price, 0))
    : null;
  const lines = [
    'DRAFT KERANJANG BAM — BELUM MENJADI PESANAN',
    'Toko: ' + cart.store.storeName,
    'Rencana kirim: ' + cart.date,
    '',
    ...cart.items.slice(0, 30).map((item, index) => {
      const kind = item.packaging?.packagingType || 'satuan';
      const units = Number(item.packaging?.unitsPerPackage || 1);
      return (
        index +
        1 +
        '. ' +
        item.name +
        ' — ' +
        item.quantity +
        ' ' +
        kind +
        (units > 1 ? ' (isi ' + units + ' satuan)' : '')
      );
    }),
    ...(cart.items.length > 30 ? ['Dan ' + (cart.items.length - 30) + ' SKU lainnya.'] : []),
    '',
    ...(estimatedTotal ? ['Estimasi total barang: ' + estimatedTotal] : []),
    'Harga, stok, dan pesanan resmi baru pasti setelah pemeriksaan dan finalisasi Admin BAM.',
  ];
  return 'https://wa.me/' + phone.slice(1) + '?text=' + encodeURIComponent(lines.join('\n'));
}
