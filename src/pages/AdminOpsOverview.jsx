import useWorkflow from '../state/useWorkflow';
import AdminSectionIcon from '../components/admin/AdminSectionIcon';
import { serverStock } from '../state/serverWorkflow';
import { stockKey } from '../state/frontendWorkflow';
import { products } from '../data/products';
import { dateLabel } from '../components/shop/shopPresentation';
import { orderStatusLabel } from '../state/orderModel';

function RecentOrders() {
  const { orders = [], loading, failed, error } = useWorkflow('admin');
  const recent = [...orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);
  return (
    <section className="admin-panel admin-ops-orders" aria-labelledby="admin-ops-orders-title">
      <div className="admin-panel-heading">
        <AdminSectionIcon name="orders" />
        <div>
          <h2 id="admin-ops-orders-title">Pesanan terbaru</h2>
          <p>Pesanan yang tersedia untuk akun Admin saat ini.</p>
        </div>
        <a className="admin-secondary" href="#/admin/pesanan">Lihat semua →</a>
      </div>
      {loading ? (
        <p className="admin-ops-placeholder" role="status">Memuat pesanan…</p>
      ) : failed ? (
        <p className="admin-ops-placeholder" role="alert">{error || 'Pesanan belum dapat dimuat.'}</p>
      ) : recent.length ? (
        <div className="admin-ops-table-wrap">
          <table className="admin-ops-table">
            <thead><tr><th scope="col">Pesanan</th><th scope="col">Penerima</th>
              <th scope="col">Status</th><th scope="col">Tanggal</th></tr></thead>
            <tbody>
              {recent.map((order) => (
                <tr key={order.id}>
                  <td><span className="admin-ops-order-id">{order.id}</span></td>
                  <td>{order.recipient || order.b2b?.storeName || '—'}</td>
                  <td><span className={'workflow-badge status-' + order.status}>
                    {orderStatusLabel(order)}
                  </span></td>
                  <td>{dateLabel(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="admin-ops-placeholder">Belum ada pesanan untuk ditampilkan.</p>
      )}
      <p className="admin-ops-footnote">Menampilkan maksimal 5 pesanan yang telah dimuat; bukan keseluruhan riwayat transaksi.</p>
    </section>
  );
}

function InventorySummary() {
  const inventory = useWorkflow('inventory');
  const inventoryProducts = [...new Map(products.map((product) => [stockKey(product), product])).values()];
  let counts = null;
  if (!inventory.loading && !inventory.failed && inventory.server) {
    try {
      const rows = inventoryProducts.map((product) => serverStock(product));
      counts = {
        available: rows.filter((row) => row.available !== null && row.available > 0).length,
        empty: rows.filter((row) => row.available === 0).length,
        unknown: rows.filter((row) => row.available === null).length,
        total: rows.length,
      };
    } catch {
      counts = null;
    }
  }
  const good = counts?.total ? 100 * counts.available / counts.total : 0;
  const empty = counts?.total ? 100 * counts.empty / counts.total : 0;
  return (
    <section className="admin-panel admin-ops-inventory" aria-labelledby="admin-ops-stock-title">
      <div className="admin-panel-heading">
        <AdminSectionIcon name="stock" />
        <div>
          <h2 id="admin-ops-stock-title">Ringkasan stok</h2>
          <p>Jumlah jenis stok produk, bukan jumlah unit barang.</p>
        </div>
        <a className="admin-secondary" href="#/admin/stok">Kelola stok →</a>
      </div>
      {inventory.loading ? (
        <p className="admin-ops-placeholder" role="status">Memuat stok…</p>
      ) : inventory.failed ? (
        <p className="admin-ops-placeholder" role="alert">{inventory.error || 'Stok belum dapat dimuat.'}</p>
      ) : !counts ? (
        <p className="admin-ops-placeholder">Ringkasan stok tersedia setelah database stok dimuat.</p>
      ) : (
        <div className="admin-ops-stock-visual">
          <div
            className="admin-ops-stock-donut"
            role="img"
            aria-label={counts.available + ' jenis tersedia, ' + counts.empty + ' jenis habis, ' + counts.unknown + ' jenis tidak diketahui'}
            style={{ background: 'conic-gradient(#22b885 0% ' + good + '%, #fb6b78 ' + good + '% ' + (good + empty) + '%, #c9d7e8 ' + (good + empty) + '% 100%)' }}
          >
            <div><strong>{counts.total}</strong><small>Jenis stok</small></div>
          </div>
          <dl className="admin-ops-stock-legend">
            <div><dt><span className="admin-ops-stock-dot available" />Tersedia</dt><dd>{counts.available}</dd></div>
            <div><dt><span className="admin-ops-stock-dot empty" />Habis</dt><dd>{counts.empty}</dd></div>
            <div><dt><span className="admin-ops-stock-dot unknown" />Tidak diketahui</dt><dd>{counts.unknown}</dd></div>
          </dl>
        </div>
      )}
      <p className="admin-ops-footnote">Persediaan dihitung dari data stok BAM, tanpa menambahkan stok simulasi.</p>
    </section>
  );
}

export default function AdminOpsOverview() {
  return (
    <div className="admin-ops-overview">
      <RecentOrders />
      <InventorySummary />
    </div>
  );
}
