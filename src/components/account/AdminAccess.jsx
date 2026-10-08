import { useDelivery } from '../../state/useDelivery';

export default function AdminAccess({ children }) {
  const { user, authLoading, authError } = useDelivery();
  if (authLoading) return <div className="shop-page" role="status">Memeriksa akses admin…</div>;
  if (!user || user.role !== 'admin') return <div className="shop-page"><h1>{user ? 'Akses admin diperlukan' : 'Masuk sebagai admin'}</h1><p>{authError || (user ? 'Akun ini belum memiliki izin untuk mengelola katalog.' : 'Gunakan akun admin untuk mengelola produk dan pemasok.')}</p><a className="shop-primary" href="#/login">Masuk</a> <a href="#/">Kembali ke toko</a></div>;
  return children;
}
