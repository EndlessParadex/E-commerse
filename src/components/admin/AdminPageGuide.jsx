import AdminIcon from './AdminIcon';

export const adminGuideByView = {
  overview: [
    ['overview', 'Ringkasan', 'Periksa kondisi operasional.'],
    ['orders', 'Pesanan', 'Tinjau pesanan pelanggan.'],
    ['stock', 'Stok', 'Periksa ketersediaan produk.'],
    ['b2bStores', 'Toko & Sales', 'Kelola mitra dan penugasan.'],
  ],
  orders: [
    ['search', 'Cari pesanan', 'Temukan pelanggan atau nomor pesanan.'],
    ['orders', 'Periksa status', 'Tinjau pembayaran dan detail.'],
    ['details', 'Proses pesanan', 'Simpan tindakan yang diizinkan.'],
  ],
  stock: [
    ['search', 'Cari produk', 'Pilih ukuran atau SKU.'],
    ['stock', 'Periksa stok', 'Cek persediaan tersedia.'],
    ['details', 'Perbarui stok', 'Simpan hasil perhitungan.'],
  ],
  products: [
    ['search', 'Cari katalog', 'Gunakan pemasok dan merek.'],
    ['products', 'Periksa varian', 'Lihat ukuran dan harga.'],
    ['plus', 'Kelola produk', 'Tambah atau ubah produk.'],
  ],
  suppliers: [
    ['search', 'Cari pemasok', 'Telusuri perusahaan pemasok.'],
    ['suppliers', 'Periksa relasi', 'Cek produk yang terhubung.'],
    ['plus', 'Kelola pemasok', 'Tambah atau ubah data.'],
  ],
  brands: [
    ['search', 'Cari merek', 'Pilih merek dalam katalog.'],
    ['suppliers', 'Periksa pemasok', 'Cek PT yang terkait.'],
    ['plus', 'Kelola merek', 'Simpan identitas merek.'],
  ],
  categories: [
    ['search', 'Cari kategori', 'Temukan kelompok produk.'],
    ['categories', 'Periksa subkategori', 'Cek struktur kategori.'],
    ['plus', 'Kelola kategori', 'Simpan perubahan katalog.'],
  ],
  sharedCarts: [
    ['b2bStores', 'Pilih toko', 'Tentukan toko yang diproses.'],
    ['calendar', 'Periksa periode', 'Lihat tanggal pengiriman.'],
    ['details', 'Tinjau keranjang', 'Periksa pembayaran dan stok.'],
    ['orders', 'Finalisasi', 'Selesaikan sesuai izin Admin.'],
  ],
  accounts: [
    ['search', 'Cari akun', 'Temukan akun pengguna.'],
    ['accounts', 'Periksa akses', 'Lihat peran dan status.'],
    ['details', 'Kelola izin', 'Konfirmasi sebelum menyimpan.'],
  ],
  approvals: [
    ['search', 'Cari pendaftar', 'Periksa permintaan baru.'],
    ['owner', 'Verifikasi akun', 'Tinjau identitas dan status.'],
    ['details', 'Beri keputusan', 'Setujui atau tolak dengan aman.'],
  ],
  company: [
    ['details', 'Identitas', 'Periksa profil perusahaan.'],
    ['owner', 'Kontak', 'Lengkapi alamat dan nomor.'],
    ['stock', 'Pengaturan', 'Tinjau informasi toko.'],
    ['details', 'Simpan', 'Pastikan data sudah benar.'],
  ],
  email: [
    ['email', 'Pilih layanan', 'Tentukan penyedia SMTP.'],
    ['details', 'Atur pengirim', 'Isi identitas dan koneksi.'],
    ['email', 'Uji email', 'Verifikasi hasil pengiriman.'],
  ],
};

export default function AdminPageGuide({ view }) {
  const steps = adminGuideByView[view];
  if (!steps?.length) return null;
  return (
    <details className="admin-page-guide">
      <summary>Petunjuk halaman (opsional)</summary>
      <nav aria-label="Panduan halaman Admin">
        <ol className="admin-page-guide-steps">
        {steps.map(([icon, label, description], index) => (
          <li className="admin-page-guide-step" key={label}>
            <span className="admin-page-guide-number">{index + 1}</span>
            <span className="admin-page-guide-icon"><AdminIcon name={icon} /></span>
            <span className="admin-page-guide-copy">
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
          </li>
        ))}
        </ol>
      </nav>
    </details>
  );
}
