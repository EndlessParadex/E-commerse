import { workflowUsesServer } from '../data/adminStore';
import useCompany from '../state/useCompany';
import './StoreInfoPage.css';

const pages = {
  tentang: {
    title: 'Tentang BAM',
    intro: 'Temukan produk, ukuran, dan harga dalam satu katalog.',
    sections: [
      {
        title: 'CV. Belitung Arta Mandiri',
        text: 'BAM menyajikan katalog produk yang dapat dijelajahi berdasarkan kategori, PT pemasok, dan merek. Setiap pilihan ukuran memiliki harga tersendiri agar pembeli dapat memilih sesuai kebutuhan.',
      },
      {
        title: 'Informasi toko',
        text: 'Alamat usaha, nomor WhatsApp, dan email resmi belum tersedia. Informasi tersebut akan dilengkapi setelah diberikan oleh pengelola BAM.',
      },
      {
        title: 'Tentang pratinjau belanja',
        text: 'Produk dan informasi katalog dikelola melalui ruang admin. Keranjang, checkout, pembayaran, dan riwayat pesanan masih merupakan simulasi; tidak ada transaksi keuangan yang diproses.',
      },
    ],
  },
  privasi: {
    title: 'Informasi privasi',
    intro: 'Ketahui bagaimana data digunakan pada versi pratinjau ini.',
    sections: [
      {
        title: 'Data akun',
        text: 'Nama, email, dan alamat yang Anda isi saat mendaftar digunakan untuk akun dan alamat pengiriman. Data akun tersimpan di server BAM. Kata sandi disimpan dalam bentuk hash, dan cookie sesi digunakan untuk mempertahankan akses akun.',
      },
      {
        title: 'Data pada browser',
        text: 'Keranjang, favorit, dan notifikasi disimpan pada browser yang digunakan. Pesanan percobaan, catatan, dan pilihan WhatsApp disimpan sementara pada tab browser. Riwayat pesanan belum terhubung ke akun.',
      },
      {
        title: 'Pembayaran dan WhatsApp',
        text: 'Pratinjau ini tidak meminta nomor kartu, CVV, atau PIN, tidak memproses dana, dan tidak mengirim pesan WhatsApp. Pilihan metode pembayaran hanya dicatat untuk mencoba tampilan dan alur belanja.',
      },
      {
        title: 'Kebijakan resmi',
        text: 'Kebijakan privasi resmi dan kontak pengelola belum tersedia. Informasi pada halaman ini menjelaskan perilaku versi pratinjau saat ini.',
      },
    ],
  },
  pengiriman: {
    title: 'Informasi pengiriman',
    intro: 'Periksa alamat dan pilihan pengiriman sebelum membuat pesanan.',
    sections: [
      {
        title: 'Alamat penerima',
        text: 'Masuk untuk menggunakan alamat dari akun Anda. Anda juga dapat mengisi atau mengubah nama penerima dan alamat pada halaman checkout. Isi alamat lengkap agar mudah diperiksa.',
      },
      {
        title: 'Reguler dan Express',
        text: 'Pilihan Reguler dan Express pada checkout menggunakan estimasi serta ongkir contoh. Tarif, cakupan wilayah, kurir, dan pelacakan pengiriman nyata belum tersedia.',
      },
      {
        title: 'Status pengiriman',
        text: 'Pesanan percobaan belum dikirim ke kurir. Pada pratinjau, admin dapat mencatat kurir dan nomor resi, lalu mengubah status menjadi Dikirim dan Selesai. Resi dan status tersebut terlihat pada detail pesanan di tab yang sama.',
      },
    ],
  },
  pembatalan: {
    title: 'Pembatalan dan retur',
    intro: 'Kelola perubahan rencana belanja dengan pilihan yang jelas.',
    sections: [
      {
        title: 'Sebelum membuat pesanan',
        text: 'Gunakan Batalkan belanja di keranjang atau Batalkan checkout di halaman checkout. Barang tetap tersimpan di keranjang, kecuali Anda memilih untuk mengosongkannya juga.',
      },
      {
        title: 'Setelah checkout',
        text: 'Buka Pesanan saya, pilih pesanan, lalu tekan Batalkan pesanan dan pilih alasan. Pesanan percobaan yang belum dibayar dan belum dikirim dapat dibatalkan. Status pembatalan tetap terlihat setelah halaman dimuat ulang.',
      },
      {
        title: 'Pesanan yang sudah dibayar atau dikirim',
        text: 'Pembatalan dari halaman ini tidak tersedia untuk pesanan yang sudah dibayar, dikirim, atau selesai. Penanganannya memerlukan pemeriksaan oleh pengelola toko.',
      },
      {
        title: 'Retur dan pengembalian dana',
        text: 'Ketentuan retur serta pengembalian dana resmi belum tersedia. Simulasi ini tidak memindahkan dana dan tidak menyediakan proses pengembalian barang nyata.',
      },
    ],
  },
  bantuan: {
    title: 'Pusat bantuan',
    intro: 'Panduan singkat untuk menjelajahi katalog dan mencoba belanja.',
    sections: [
      {
        title: 'Mencari produk',
        text: 'Gunakan nama produk, merek, ukuran, atau SKU pada kolom pencarian. Buka Semua Kategori untuk memilih kategori atau PT pemasok. Pada halaman katalog, gunakan filter kategori, subkategori, pemasok, dan merek.',
      },
      {
        title: 'Memilih ukuran dan kemasan',
        text: 'Buka produk, lalu pilih gramasi atau ukuran. Tepat di bawahnya, pilih Satuan, Pack, atau Dus yang tersedia untuk ukuran tersebut. Harga mengikuti pilihan kemasan: 1 buah, 1 pack, atau 1 dus. Jumlah pembelian mengikuti kemasan tersebut, misalnya 2 pack. Tombol Kembali berada di bawah navigasi halaman produk.',
      },
      {
        title: 'Memeriksa keranjang',
        text: 'Anda dapat mengubah jumlah atau menghapus barang. Jika informasi katalog berubah, periksa pemberitahuan pada keranjang dan gunakan harga terbaru. Barang yang tidak tersedia perlu dikeluarkan sebelum checkout.',
      },
      {
        title: 'Memilih pembayaran',
        text: 'Checkout menyediakan bayar di tempat, transfer bank, Virtual Account, DANA, GoPay, ShopeePay, dan OVO. Semua pilihan masih simulasi. Jangan melakukan pembayaran berdasarkan pratinjau ini.',
      },
      {
        title: 'Melanjutkan pembayaran',
        text: 'Buka detail pesanan dan tekan Lanjutkan pembayaran untuk mencoba status berhasil, gagal, atau kedaluwarsa. Batas pratinjau adalah 24 jam setelah checkout. Pesanan yang dibatalkan atau kedaluwarsa tidak dapat dibayar dan stok simulasi dilepas.',
      },
      {
        title: 'Membatalkan pembelian',
        text: 'Batalkan proses belanja dari keranjang atau checkout. Untuk pesanan yang sudah dibuat, gunakan Batalkan pesanan pada riwayat atau halaman detail.',
      },
      {
        title: 'Layanan pelanggan',
        text: 'Kontak layanan pelanggan dan layanan penyelesaian keluhan resmi belum tersedia. Halaman ini menyediakan panduan penggunaan pratinjau BAM.',
      },
    ],
  },
};
export default function StoreInfoPage({ page }) {
  const company = useCompany();
  const { profile: companyProfile } = company;
  const configured = Object.fromEntries(
    Object.entries(pages).map(([key, entry]) => [
      key,
      {
        ...entry,
        title: entry.title.replace('BAM', companyProfile.shortName),
        intro: entry.intro.replace('BAM', companyProfile.shortName),
        sections: entry.sections.map((section) => ({
          title: section.title.replace('CV. Belitung Arta Mandiri', companyProfile.legalName),
          text: section.text.replaceAll('BAM', companyProfile.shortName),
        })),
      },
    ]),
  );
  configured.tentang.sections[0] = {
    title: companyProfile.legalName,
    text: companyProfile.description || 'Jelajahi produk yang tersedia dalam katalog kami.',
  };
  const contacts = [companyProfile.address, companyProfile.phone, companyProfile.email].filter(
    Boolean,
  );
  if (contacts.length)
    configured.tentang.sections[1] = { title: 'Informasi toko', text: contacts.join(' · ') };
  if (workflowUsesServer) {
    configured.tentang.sections[2] = {
      title: 'Belanja dan pembayaran',
      text: 'Produk, pesanan, dan stok dikelola melalui server. Pesanan terhubung ke akun pelanggan. Aplikasi belum memproses pembayaran atau menghubungi kurir secara otomatis.',
    };
    configured.privasi.sections[1] = {
      title: 'Data pesanan dan browser',
      text: 'Pesanan, catatan, pilihan WhatsApp, dan stok tersimpan di database server. Keranjang, favorit, preferensi tampilan, dan tanda baca notifikasi masih disimpan pada browser. Riwayat pesanan akun tetap tersedia dari perangkat lain setelah masuk.',
    };
    configured.pengiriman.sections[2] = {
      title: 'Status pengiriman',
      text: 'Admin mencatat kurir dan nomor resi setelah memeriksa pengiriman. Status diperbarui pada server dan dapat dibaca pelanggan. Pelacakan kurir serta perhitungan ongkir otomatis belum terhubung; biaya pengiriman saat ini memakai tarif contoh.',
    };
    configured.bantuan.sections[3] = {
      title: 'Memilih pembayaran',
      text: 'Pilih metode pembayaran untuk dicatat bersama pesanan. Integrasi pembayaran belum aktif. Gunakan hanya instruksi pembayaran resmi yang telah dikonfirmasi oleh pengelola toko.',
    };
    configured.bantuan.sections[4] = {
      title: 'Melanjutkan pembayaran',
      text: 'Pesanan menunggu pembayaran selama 24 jam. Server mengembalikan stok jika batas pembayaran berakhir. Admin mencatat pembayaran setelah diperiksa. Pelanggan tidak dapat mengubah pesanan menjadi sudah dibayar.',
    };
  }
  if (workflowUsesServer && company.commerce?.version === 31) {
    configured.pengiriman.sections[1] = {
      title: 'Ongkir dan kurir',
      text: 'Toko menetapkan ongkir sesuai barang, tujuan dan kurir. Anda melihat dan menyetujui total akhir sebelum membayar. Subtotal pada permintaan awal belum termasuk ongkir.',
    };
    configured.pengiriman.sections[2] = {
      title: 'Status pengiriman',
      text: 'Toko mencatat kurir dan resi setelah pengiriman dilakukan. Pembaruan dikirim melalui email dan tersedia pada Pesanan saya. Pelacakan otomatis ke sistem kurir belum terhubung.',
    };
    configured.bantuan.sections[3] = {
      title: 'Memilih pembayaran',
      text: 'Pilih COD yang diaktifkan toko atau transfer bank ke rekening resmi pada detail pesanan. VA dan e-wallet otomatis tidak ditawarkan. Untuk transfer, unggah bukti setelah total akhir disetujui; toko memeriksa dana sebelum mengonfirmasi pembayaran.',
    };
    configured.bantuan.sections[4] = {
      title: 'Menyetujui total akhir',
      text: 'Toko memeriksa permintaan, menetapkan ongkir, dan mengirim penawaran. Setujui total pada detail pesanan. Waktu pembayaran dimulai setelah Anda melanjutkan; tanggal akhir reservasi dan pembayaran ditampilkan pada pesanan.',
    };
    configured.bantuan.sections.push({
      title: 'Verifikasi email dan cetak pesanan',
      text: 'Verifikasi email wajib sebelum memesan. Buka Akun saya → Keamanan untuk mengirim ulang tautan. Faktur/ringkasan dapat dicetak atau disimpan PDF dari detail pesanan.',
    });
    configured.pembatalan.sections[1] = {
      title: 'Setelah mengirim permintaan',
      text: 'Buka Pesanan saya untuk membatalkan dan menuliskan alasan. Pesanan yang sudah dibayar, dikirim, selesai, atau buktinya sedang diperiksa memerlukan penanganan pengelola toko.',
    };
    configured.pembatalan.sections[3] = {
      title: 'Retur dan pengembalian dana',
      text: 'Hubungi pengelola toko dengan nomor pesanan dan bukti pembayaran. Pengembalian dana memerlukan pemeriksaan toko dan tidak diproses otomatis oleh aplikasi. Konfirmasikan ketentuan toko sebelum membayar.',
    };
    configured.privasi.intro = 'Ketahui bagaimana data akun dan pesanan digunakan.';
    configured.privasi.sections[2] = {
      title: 'Pembayaran dan kontak',
      text: 'Rekening tujuan berasal dari pengaturan toko. Bukti transfer tersimpan pada server dan hanya dapat dibuka pemilik pesanan serta admin. Email digunakan untuk verifikasi, pemulihan akun dan pembaruan pesanan. Nomor WhatsApp opsional digunakan toko untuk kontak manual dengan persetujuan Anda.',
    };
  }
  // Keep historical order details intact, but explain the actual rules for new orders.
  if (workflowUsesServer && company.commerce?.codOnly === true) {
    configured.pengiriman.intro = 'Periksa alamat pengiriman sebelum checkout. Ongkos kirim BAM gratis.';
    configured.pengiriman.sections[1] = {
      title: 'Gratis ongkos kirim',
      text: 'Semua pesanan baru menggunakan pengiriman gratis (Rp0). Harga total sudah final sejak checkout. Toko mengatur pengiriman secara manual.',
    };
    configured.pengiriman.sections[2] = {
      title: 'Status dan pengiriman barang',
      text: 'Pesanan baru langsung diproses jika checkout berhasil. Toko menyiapkan barang dan mencatat kurir serta resi saat dikirim. Lihat perkembangan di Pesanan saya; pelacakan otomatis ke sistem kurir belum tersedia.',
    };
    configured.bantuan.sections[3] = {
      title: 'Pembayaran COD',
      text: 'BAM hanya menerima bayar di tempat (COD) untuk pesanan baru. Tidak perlu transfer bank atau membayar sebelum barang diterima. Ongkir gratis dan harga checkout sudah final.',
    };
    configured.bantuan.sections[4] = {
      title: 'Setelah checkout',
      text: 'Setelah checkout berhasil, pesanan langsung berstatus Diproses. Anda tidak perlu menekan tombol persetujuan harga atau total kedua. Lihat Pesanan saya untuk memantau pengiriman dan membayar COD saat barang diterima.',
    };
    configured.pembatalan.sections[1] = {
      title: 'Membatalkan pesanan baru',
      text: 'Buka Pesanan saya, pilih pesanan lalu Batalkan pesanan dengan alasan. Pesanan yang sudah dikirim atau selesai tidak dapat dibatalkan langsung dari website; hubungi toko untuk bantuan.',
    };
    configured.privasi.sections[2] = {
      title: 'Pembayaran COD dan kontak',
      text: 'Pesanan baru dibayar COD saat barang diterima. Email digunakan untuk verifikasi, pemulihan akun, serta pembaruan pesanan. Nomor WhatsApp bersifat opsional untuk kontak manual dengan persetujuan Anda. Riwayat pesanan lama tetap disimpan sesuai transaksi awalnya.',
    };
  }
  const content = configured[page] || configured.bantuan;
  return (
    <div className="store-info-page">
      <nav className="shop-breadcrumb" aria-label="Breadcrumb">
        <a href="#/">Beranda</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{content.title}</span>
      </nav>
      <header className="store-info-heading">
        <span className="section-eyebrow">Informasi {companyProfile.shortName}</span>
        <h1>{content.title}</h1>
        <p>{content.intro}</p>
      </header>
      <div className="store-info-layout">
        <nav className="store-info-nav" aria-label="Halaman informasi">
          {Object.entries(configured).map(([id, item]) => (
            <a key={id} href={'#/' + id} aria-current={id === page ? 'page' : undefined}>
              {item.title}
            </a>
          ))}
        </nav>
        <div className="store-info-content">
          {content.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.text}</p>
            </section>
          ))}
          <a className="bam-button-secondary" href="#/cari?q=">
            Kembali ke katalog →
          </a>
        </div>
      </div>
    </div>
  );
}
