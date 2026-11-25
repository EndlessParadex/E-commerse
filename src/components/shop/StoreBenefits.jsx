import './StoreBenefits.css';

// Only promises BAM actually keeps today: own drivers, COD, grosir packs, order tracking.
const BENEFITS = [
  {
    id: 'driver',
    title: 'Diantar sopir BAM',
    text: 'Langsung ke toko Anda',
    path: 'M3 6h11v9H3zM14 9h4l3 3v3h-7zM7 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  },
  {
    id: 'cod',
    title: 'Bayar di tempat (COD)',
    text: 'Bayar saat barang tiba',
    path: 'M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 10v4M18 10v4',
  },
  {
    id: 'grosir',
    title: 'Harga grosir',
    text: 'Per renceng, pack, dan dus',
    path: 'M4 8l8-4 8 4-8 4zM4 8v8l8 4 8-4V8M12 12v8',
  },
  {
    id: 'track',
    title: 'Status pesanan jelas',
    text: 'Pantau dari diproses sampai tiba',
    path: 'M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  },
];

export default function StoreBenefits() {
  return (
    <ul className="bam-store-benefits" aria-label="Keunggulan belanja di BAM">
      {BENEFITS.map((item) => (
        <li key={item.id}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d={item.path} />
          </svg>
          <span>
            <strong>{item.title}</strong>
            <small>{item.text}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
