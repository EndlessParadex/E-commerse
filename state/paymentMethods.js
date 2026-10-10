export const PAYMENT_GROUPS = [
  { id: 'cod', label: 'Bayar di tempat', icon: 'COD' },
  { id: 'transfer', label: 'Transfer bank', icon: 'BANK' },
  { id: 'va', label: 'Virtual Account', icon: 'VA' },
  { id: 'wallet', label: 'E-wallet', icon: 'PAY' },
];
const banks = ['BCA', 'Mandiri', 'BNI', 'BRI'];
export const PAYMENT_METHODS = [
  { id: 'cod', groupId: 'cod', label: 'Bayar di tempat', provider: 'COD', description: 'Bayar saat barang diterima' },
  ...banks.map((bank) => ({ id: `transfer-${bank.toLowerCase()}`, groupId: 'transfer', label: `Transfer bank ${bank}`, provider: bank, description: 'Transfer ke rekening bank tujuan' })),
  ...banks.map((bank) => ({ id: `va-${bank.toLowerCase()}`, groupId: 'va', label: `${bank} Virtual Account`, provider: bank, description: 'Nomor pembayaran khusus untuk pesanan' })),
  ...['DANA', 'GoPay', 'ShopeePay', 'OVO'].map((provider) => ({ id: `wallet-${provider.toLowerCase()}`, groupId: 'wallet', label: provider, provider, description: 'Bayar melalui aplikasi e-wallet' })),
];
export const paymentMethod = (id) => PAYMENT_METHODS.find((method) => method.id === id);
export function paymentInstructions(payment) {
  const group = payment?.groupId || paymentMethod(payment?.id)?.groupId;
  return {
    cod: ['Siapkan pembayaran sesuai total pesanan.', 'Bayar kepada kurir saat barang diterima.'],
    transfer: ['Periksa bank tujuan dan total pembayaran.', 'Rekening tujuan belum tersedia dalam simulasi ini.'],
    va: ['Pilih pembayaran Virtual Account pada layanan bank.', 'Nomor Virtual Account belum diterbitkan dalam simulasi ini.'],
    card: ['Pembayaran kartu akan menggunakan halaman pembayaran yang aman.', 'Jangan memasukkan nomor kartu, CVV, atau PIN pada pratinjau ini.'],
    wallet: [`Pembayaran akan dilanjutkan melalui aplikasi ${payment?.provider || payment?.label || 'e-wallet'}.`, 'Tautan atau QR pembayaran belum tersedia dalam simulasi ini.'],
  }[group] || ['Metode ini tercatat pada pesanan percobaan.'];
}
