import { useState } from 'react';
import useWorkflow from '../state/useWorkflow';
import AdminIcon from '../components/admin/AdminIcon';
import AdminSectionIcon from '../components/admin/AdminSectionIcon';
import SharedCartPage from '../components/shop/SharedCartPage';
import { dateLabel, rupiah } from '../components/shop/shopPresentation';
import { orderStatusLabel } from '../state/orderModel';
import AdminOrdersPage from './AdminOrdersPage';
import AdminProductForm from './AdminProductForm';
import { useStockCounts } from './useAdminWorkCounts';

const urgency = (order) => {
  if (order.payment?.status === 'proof_submitted') return 0;
  return (
    {
      awaiting_review: 1,
      awaiting_confirmation: 1,
      processing: 2,
      awaiting_acceptance: 3,
      awaiting_payment: 3,
      shipped: 4,
    }[order.status] ?? null
  );
};
const nextAction = (order) => {
  if (order.payment?.status === 'proof_submitted') return 'Periksa bukti';
  return (
    {
      awaiting_review: 'Tentukan total',
      awaiting_confirmation: 'Tentukan total',
      processing: 'Proses pesanan',
      shipped: 'Tandai selesai',
    }[order.status] || 'Lihat pesanan'
  );
};
const statusTone = (order) => {
  if (order.payment?.status === 'proof_submitted') return 'danger';
  return { processing: 'info', shipped: 'success' }[order.status] || 'warning';
};
// Full identifiers stay available on hover; a UUID is too long to scan in a table.
const shortOrderId = (id) => String(id).split('-').slice(0, 2).join('-');
const quickActions = [
  { id: 'add', label: 'Tambah produk', icon: 'plus' },
  { id: 'check', label: 'Periksa pesanan', icon: 'orders' },
  { id: 'cart', label: 'Keranjang bersama', icon: 'sharedCarts' },
];

function WorkCard({ label, value, hint, icon, tone, href, onClick }) {
  const content = (
    <>
      <span className="admin-work-card-label">
        {label}
        <AdminIcon name={icon} />
      </span>
      <strong>{value ?? '—'}</strong>
      <small>{value === null ? 'Belum dapat dimuat' : hint}</small>
    </>
  );
  // Color signals pending work, so an empty queue stays neutral.
  const className = 'admin-work-card' + (value > 0 ? ' is-' + tone : '');
  return href ? (
    <a className={className} href={href}>
      {content}
    </a>
  ) : (
    <button className={className} type="button" onClick={onClick}>
      {content}
    </button>
  );
}

function OrderQueue({ onReview }) {
  const { orders = [], loading, failed, error } = useWorkflow('admin');
  const queue = orders
    .filter((order) => urgency(order) !== null)
    .sort((a, b) => urgency(a) - urgency(b) || (a.createdAt || 0) - (b.createdAt || 0))
    .slice(0, 5);
  return (
    <section className="admin-panel admin-ops-orders" aria-labelledby="admin-ops-orders-title">
      <div className="admin-panel-heading">
        <AdminSectionIcon name="orders" />
        <div>
          <h2 id="admin-ops-orders-title">Antrean pesanan</h2>
          <p>Diurutkan dari yang paling mendesak.</p>
        </div>
        <a className="admin-secondary" href="#/admin/pesanan">
          Lihat semua →
        </a>
      </div>
      {loading ? (
        <p className="admin-ops-placeholder" role="status">
          Memuat pesanan…
        </p>
      ) : failed ? (
        <p className="admin-ops-placeholder" role="alert">
          {error || 'Pesanan belum dapat dimuat.'}
        </p>
      ) : queue.length ? (
        <div className="admin-ops-table-wrap">
          <table className="admin-ops-table">
            <thead>
              <tr>
                <th scope="col">No</th>
                <th scope="col">Pesanan</th>
                <th scope="col">Penerima</th>
                <th scope="col">Total</th>
                <th scope="col">Tanggal</th>
                <th scope="col">Status</th>
                <th scope="col">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((order, index) => (
                <tr key={order.id}>
                  <td>{index + 1}</td>
                  <td>
                    <span className="admin-ops-order-id" title={order.id}>
                      {shortOrderId(order.id)}
                    </span>
                  </td>
                  <td>{order.b2b?.storeName || order.recipient || '—'}</td>
                  <td>{rupiah(order.total)}</td>
                  <td>{dateLabel(order.createdAt)}</td>
                  <td className={'admin-ops-status is-' + statusTone(order)}>
                    {orderStatusLabel(order)}
                  </td>
                  <td>
                    <button type="button" className="admin-ops-action" onClick={onReview}>
                      <AdminIcon name="orders" /> {nextAction(order)}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="admin-ops-placeholder">Tidak ada pesanan yang perlu ditindak.</p>
      )}
    </section>
  );
}

function InventorySummary() {
  const { inventory, counts } = useStockCounts();
  const good = counts?.total ? (100 * counts.available) / counts.total : 0;
  const empty = counts?.total ? (100 * counts.empty) / counts.total : 0;
  return (
    <section className="admin-panel admin-ops-inventory" aria-labelledby="admin-ops-stock-title">
      <div className="admin-panel-heading">
        <AdminSectionIcon name="stock" />
        <div>
          <h2 id="admin-ops-stock-title">Ringkasan stok</h2>
          <p>Jumlah jenis stok, bukan unit.</p>
        </div>
        <a className="admin-secondary" href="#/admin/stok">
          Kelola stok →
        </a>
      </div>
      {inventory.loading ? (
        <p className="admin-ops-placeholder" role="status">
          Memuat stok…
        </p>
      ) : inventory.failed ? (
        <p className="admin-ops-placeholder" role="alert">
          {inventory.error || 'Stok belum dapat dimuat.'}
        </p>
      ) : !counts ? (
        <p className="admin-ops-placeholder">
          Ringkasan stok tersedia setelah database stok dimuat.
        </p>
      ) : (
        <div className="admin-ops-stock-visual">
          <div
            className="admin-ops-stock-donut"
            role="img"
            aria-label={
              counts.available +
              ' jenis tersedia, ' +
              counts.empty +
              ' jenis habis, ' +
              counts.unknown +
              ' jenis tidak diketahui'
            }
            style={{
              background:
                'conic-gradient(#22b885 0% ' +
                good +
                '%, #fb6b78 ' +
                good +
                '% ' +
                (good + empty) +
                '%, #c9d7e8 ' +
                (good + empty) +
                '% 100%)',
            }}
          >
            <div>
              <strong>{counts.total}</strong>
              <small>Jenis stok</small>
            </div>
          </div>
          <dl className="admin-ops-stock-legend">
            <div>
              <dt>
                <span className="admin-ops-stock-dot available" />
                Tersedia
              </dt>
              <dd>{counts.available}</dd>
            </div>
            <div>
              <dt>
                <span className="admin-ops-stock-dot empty" />
                Habis
              </dt>
              <dd>{counts.empty}</dd>
            </div>
            <div>
              <dt>
                <span className="admin-ops-stock-dot unknown" />
                Tidak diketahui
              </dt>
              <dd>{counts.unknown}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}

export default function AdminOpsOverview({ counts, user, disabled, onProductSaved, onLeave }) {
  const [panel, setPanel] = useState('queue');
  const close = () => setPanel('queue');
  return (
    <>
      <section className="admin-work-cards" aria-label="Pekerjaan utama">
        <WorkCard
          label="Pesanan perlu diproses"
          value={counts.orders}
          hint="Menunggu tindakan Admin"
          icon="orders"
          tone="info"
          onClick={() => setPanel('check')}
        />
        <WorkCard
          label="Bukti bayar menunggu"
          value={counts.proofs}
          hint="Perlu diperiksa"
          icon="details"
          tone="danger"
          onClick={() => setPanel('check')}
        />
        <WorkCard
          label="Stok habis"
          value={counts.stockEmpty}
          hint="Jenis stok kosong"
          icon="stock"
          tone="warning"
          href="#/admin/stok"
        />
        <WorkCard
          label="Akun menunggu"
          value={counts.approvals}
          hint="Menunggu persetujuan"
          icon="accounts"
          tone="violet"
          href="#/admin/persetujuan"
        />
      </section>
      <div className={'admin-work-layout' + (panel === 'queue' ? '' : ' has-panel')}>
        <div className="admin-work-main">
          {panel === 'queue' ? (
            <OrderQueue onReview={() => setPanel('check')} />
          ) : (
            <>
              <div className="admin-work-panel-bar">
                {panel === 'cart' && <h2>Keranjang bersama</h2>}
                <button type="button" className="admin-secondary" onClick={close}>
                  Kembali ke antrean
                </button>
              </div>
              {panel === 'add' && (
                <AdminProductForm
                  groupId=""
                  onNavigate={() => {
                    close();
                    onLeave();
                  }}
                  onClose={close}
                  onSaved={onProductSaved}
                />
              )}
              {panel === 'check' && <AdminOrdersPage embedded initialFilter="processing" />}
              {panel === 'cart' && <SharedCartPage key={user?.id} adminView />}
            </>
          )}
        </div>
        <aside className="admin-work-side" aria-label="Akses cepat Admin">
          {panel === 'queue' && <InventorySummary />}
          <section className="admin-panel admin-overview-quick">
            <h2>Aksi cepat</h2>
            <div className="admin-overview-quick-links">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  aria-pressed={panel === action.id}
                  disabled={action.id === 'add' && disabled}
                  onClick={() => setPanel(panel === action.id ? 'queue' : action.id)}
                >
                  <AdminIcon name={action.icon} /> {action.label}
                </button>
              ))}
              <a href="#/admin/stok">
                <AdminIcon name="stock" /> Kelola stok
              </a>
              <a href="#/admin/toko-sales">
                <AdminIcon name="b2bStores" /> Toko &amp; Sales
              </a>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
