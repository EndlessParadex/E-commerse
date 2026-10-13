import { useContext } from 'react';
import { DeliveryContext } from '../../state/useDelivery';
import { categories, searchHref } from '../../data/catalog';
import NavigationIcon from '../layout/NavigationIcon';

export default function HomeQuickNav() {
  const { user } = useContext(DeliveryContext) || {};
  const scrollToCategories = (event) => {
    const section = document.getElementById('home-categories');
    if (!section) return;
    event.preventDefault();
    section.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  return <nav className="home-quick-nav" aria-label="Akses cepat beranda">
    <a className="home-quick-primary" href={searchHref('')}><NavigationIcon name="products" /><span>Semua produk</span><span className="home-quick-arrow" aria-hidden="true">→</span></a>
    {categories.length > 0 && <a href="#home-categories" onClick={scrollToCategories}><NavigationIcon name="categories" /><span>Pilih kategori</span></a>}
    <a href="#/pesanan"><NavigationIcon name="orders" /><span>Pesanan saya</span></a>
    <a href={user?.role === 'admin' ? '#/admin' : '#/akun'}><NavigationIcon name={user?.role === 'admin' ? 'overview' : 'account'} /><span>{user?.role === 'admin' ? 'Ruang admin' : 'Akun saya'}</span></a>
  </nav>;
}
