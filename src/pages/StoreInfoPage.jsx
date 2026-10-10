import './StoreInfoPage.css';

const pages = {
  tentang: { title: 'Tentang BAM', intro: 'Temukan produk, ukuran, dan harga dalam satu katalog.', sections: [
    { title: 'CV. Belitung Arta Mandiri', text: 'BAM menyajikan katalog produk yang dapat dijelajahi berdasarkan kategori, PT pemasok, dan merek. Setiap pilihan ukuran memiliki harga tersendiri agar pembeli dapat memilih sesuai kebutuhan.' },
    { title: 'Informasi toko', text: 'Alamat usaha, nomor WhatsApp, dan email resmi belum tersedia. Informasi tersebut akan dilengkapi setelah diberikan oleh pengelola BAM.' },
    { title: 'Tentang pratinjau belanja', text: 'Produk dan informasi katalog dikelola melalui ruang admin. Keranjang, checkout, pembayaran, dan riwayat pesanan masih merupakan simulasi; tidak ada transaksi keuangan yang diproses.' },
  ] },
  privasi: { title: 'Informasi privasi', intro: 'Ketahui bagaimana data digunakan pada versi pratinjau ini.', sections: [
    { title: 'Data akun', text: 'Nama, email, dan alamat yang Anda isi saat mendaftar digunakan untuk akun dan alamat pengiriman. Data akun tersimpan di server BAM. Kata sandi disimpan dalam bentuk hash, dan cookie sesi digunakan untuk mempertahankan akses akun.' },
    { title: 'Data pada browser', text: 'Keranjang, favorit, dan notifikasi disimpan pada browser yang digunakan. Pesanan percobaan, catatan, dan pilihan WhatsApp disimpan sementara pada tab browser. Riwayat pesanan belum terhubung ke akun.' },
    { title: 'Pembayaran dan WhatsApp', text: 'Pratinjau ini tidak meminta nomor kartu, CVV, atau PIN, tidak memproses dana, dan tidak mengirim pesan WhatsApp. Pilihan metode pembayaran hanya dicatat untuk mencoba tampilan dan alur belanja.' },
    { title: 'Kebijakan resmi', text: 'Kebijakan privasi resmi dan kontak pengelola belum tersedia. Informasi pada halaman ini menjelaskan perilaku versi pratinjau saat ini.' },
  ] },
  pengiriman: { title: 'Informasi pengiriman', intro: 'Periksa alamat dan pilihan pengiriman sebelum membuat pesanan.', sections: [
    { title: 'Alamat penerima', text: 'Masuk untuk menggunakan alamat dari akun Anda. Anda juga dapat mengisi atau mengubah nama penerima dan alamat pada halaman checkout. Isi alamat lengkap agar mudah diperiksa.' },
    { title: 'Reguler dan Express', text: 'Pilihan Reguler dan Express pada checkout menggunakan estimasi serta ongkir contoh. Tarif, cakupan wilayah, kurir, dan pelacakan pengiriman nyata belum tersedia.' },
    { title: 'Status pengiriman', text: 'Pesanan percobaan belum dikirim ke kurir. Pada pratinjau, admin dapat mencatat kurir dan nomor resi, lalu mengubah status menjadi Dikirim dan Selesai. Resi dan status tersebut terlihat pada detail pesanan di tab yang sama.' },
  ] },
  pembatalan: { title: 'Pembatalan dan retur', intro: 'Kelola perubahan rencana belanja dengan pilihan yang jelas.', sections: [
    { title: 'Sebelum membuat pesanan', text: 'Gunakan Batalkan belanja di keranjang atau Batalkan checkout di halaman checkout. Barang tetap tersimpan di keranjang, kecuali Anda memilih untuk mengosongkannya juga.' },
    { title: 'Setelah checkout', text: 'Buka Pesanan saya, pilih pesanan, lalu tekan Batalkan pesanan dan pilih alasan. Pesanan percobaan yang belum dibayar dan belum dikirim dapat dibatalkan. Status pembatalan tetap terlihat setelah halaman dimuat ulang.' },
    { title: 'Pesanan yang sudah dibayar atau dikirim', text: 'Pembatalan dari halaman ini tidak tersedia untuk pesanan yang sudah dibayar, dikirim, atau selesai. Penanganannya memerlukan pemeriksaan oleh pengelola toko.' },
    { title: 'Retur dan pengembalian dana', text: 'Ketentuan retur serta pengembalian dana resmi belum tersedia. Simulasi ini tidak memindahkan dana dan tidak menyediakan proses pengembalian barang nyata.' },
  ] },
  bantuan: { title: 'Pusat bantuan', intro: 'Panduan singkat untuk menjelajahi katalog dan mencoba belanja.', sections: [
    { title: 'Mencari produk', text: 'Gunakan nama produk, merek, ukuran, atau SKU pada kolom pencarian. Buka Semua Kategori untuk memilih kategori atau PT pemasok. Pada halaman katalog, gunakan filter kategori, subkategori, pemasok, dan merek.' },
    { title: 'Memilih ukuran dan kemasan', text: 'Buka produk, lalu pilih gramasi atau ukuran. Tepat di bawahnya, pilih Satuan, Pack, atau Dus yang tersedia untuk ukuran tersebut. Harga mengikuti pilihan kemasan: 1 buah, 1 pack, atau 1 dus. Jumlah pembelian mengikuti kemasan tersebut, misalnya 2 pack. Tombol Kembali berada di bawah navigasi halaman produk.' },
    { title: 'Memeriksa keranjang', text: 'Anda dapat mengubah jumlah atau menghapus barang. Jika informasi katalog berubah, periksa pemberitahuan pada keranjang dan gunakan harga terbaru. Barang yang tidak tersedia perlu dikeluarkan sebelum checkout.' },
    { title: 'Memilih pembayaran', text: 'Checkout menyediakan bayar di tempat, transfer bank, Virtual Account, DANA, GoPay, ShopeePay, dan OVO. Semua pilihan masih simulasi. Jangan melakukan pembayaran berdasarkan pratinjau ini.' },
    { title: 'Melanjutkan pembayaran', text: 'Buka detail pesanan dan tekan Lanjutkan pembayaran untuk mencoba status berhasil, gagal, atau kedaluwarsa. Batas pratinjau adalah 24 jam setelah checkout. Pesanan yang dibatalkan atau kedaluwarsa tidak dapat dibayar dan stok simulasi dilepas.' },
    { title: 'Membatalkan pembelian', text: 'Batalkan proses belanja dari keranjang atau checkout. Untuk pesanan yang sudah dibuat, gunakan Batalkan pesanan pada riwayat atau halaman detail.' },
    { title: 'Layanan pelanggan', text: 'Kontak layanan pelanggan dan layanan penyelesaian keluhan resmi belum tersedia. Halaman ini menyediakan panduan penggunaan pratinjau BAM.' },
  ] },
};
export default function StoreInfoPage({ page }) {
  const content = pages[page] || pages.bantuan;
  return <div className="store-info-page"><nav className="shop-breadcrumb" aria-label="Breadcrumb"><a href="#/">Beranda</a><span aria-hidden="true">/</span><span aria-current="page">{content.title}</span></nav><header className="store-info-heading"><span className="section-eyebrow">Informasi BAM</span><h1>{content.title}</h1><p>{content.intro}</p></header><div className="store-info-layout"><nav className="store-info-nav" aria-label="Halaman informasi">{Object.entries(pages).map(([id, item]) => <a key={id} href={'#/' + id} aria-current={id === page ? 'page' : undefined}>{item.title}</a>)}</nav><div className="store-info-content">{content.sections.map((section) => <section key={section.title}><h2>{section.title}</h2><p>{section.text}</p></section>)}<a className="bam-button-secondary" href="#/cari?q=">Kembali ke katalog →</a></div></div></div>;
}
