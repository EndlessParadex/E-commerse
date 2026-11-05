import { useState } from 'react';
import useCompany from '../state/useCompany';
import useOrderSearch from '../state/useOrderSearch';
import { driverNames } from '../data/companyProfile';
import { shortOrderNumber } from '../data/orderListPresentation';
import { orderStatusLabel } from '../state/orderModel';
import { isCOD } from '../state/frontendWorkflow';
import { rupiah } from '../components/shop/shopPresentation';
import './AdminDeliveriesPage.css';

const jakartaDay = (time) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(time));
const longDay = (day) =>
  new Date(day + 'T00:00:00+07:00').toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
// Cash the driver collects: COD orders that are not marked paid yet.
const codDue = (order) => (isCOD(order) && order.payment?.status !== 'paid' ? order.total : 0);
const packages = (order) => order.items.reduce((sum, item) => sum + item.quantity, 0);

/**
 * Daily delivery sheet: orders handed to each BAM driver on one day, with the
 * address and the COD cash to collect. Printable for the drivers.
 */
export default function AdminDeliveriesPage() {
  const { profile } = useCompany();
  const drivers = driverNames(profile);
  const [day, setDay] = useState(() => jakartaDay(Date.now()));
  const [driver, setDriver] = useState('');
  const search = useOrderSearch('admin', '', 'all');
  const orders = search.orders.filter(
    (order) =>
      order.shipping?.driverName &&
      order.shipping.shippedAt &&
      jakartaDay(order.shipping.shippedAt) === day &&
      (!driver || order.shipping.driverName === driver),
  );
  const groups = [...new Set(orders.map((order) => order.shipping.driverName))]
    .sort((a, b) => a.localeCompare(b, 'id'))
    .map((name) => {
      const list = orders.filter((order) => order.shipping.driverName === name);
      return {
        name,
        list,
        cod: list.reduce((sum, order) => sum + codDue(order), 0),
        packages: list.reduce((sum, order) => sum + packages(order), 0),
      };
    });

  return (
    <section className="admin-panel delivery-sheet" aria-labelledby="delivery-sheet-title">
      <div className="admin-panel-heading delivery-sheet-heading">
        <div>
          <h2 id="delivery-sheet-title">Daftar antar · {longDay(day)}</h2>
          <p>Pesanan yang dicatat dikirim pada tanggal ini, per sopir, dengan tagihan COD.</p>
        </div>
        <button
          type="button"
          className="admin-primary delivery-sheet-print"
          disabled={!orders.length}
          onClick={() => window.print()}
        >
          Cetak daftar
        </button>
      </div>
      <div className="delivery-sheet-filters">
        <div className="admin-field">
          <label htmlFor="delivery-day">Tanggal kirim</label>
          <input
            id="delivery-day"
            type="date"
            value={day}
            onChange={(event) => event.target.value && setDay(event.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="delivery-driver">Sopir</label>
          <select
            id="delivery-driver"
            value={driver}
            onChange={(event) => setDriver(event.target.value)}
          >
            <option value="">Semua sopir</option>
            {drivers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {search.loading ? (
        <p className="delivery-sheet-empty" role="status">
          Memuat pesanan…
        </p>
      ) : search.failed ? (
        <div className="delivery-sheet-empty" role="alert">
          <p>{search.error || 'Pesanan belum dapat dimuat.'}</p>
          <button type="button" className="admin-secondary" onClick={search.retry}>
            Coba lagi
          </button>
        </div>
      ) : !groups.length ? (
        <p className="delivery-sheet-empty">
          Belum ada pesanan yang dicatat dikirim{driver ? ' oleh ' + driver : ''} pada tanggal ini.
          Pengiriman dicatat dari halaman Pesanan dengan memilih sopir.
        </p>
      ) : (
        groups.map((group) => (
          <article key={group.name} className="delivery-sheet-driver">
            <header>
              <h3>{group.name}</h3>
              <p>
                {group.list.length} pesanan · {group.packages} kemasan · Tagihan COD{' '}
                <strong>{rupiah(group.cod)}</strong>
              </p>
            </header>
            <div className="delivery-sheet-table">
              <table>
                <thead>
                  <tr>
                    <th scope="col">No</th>
                    <th scope="col">Pesanan</th>
                    <th scope="col">Penerima</th>
                    <th scope="col">Alamat</th>
                    <th scope="col">Kemasan</th>
                    <th scope="col">Tagihan COD</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {group.list.map((order, index) => (
                    <tr key={order.id}>
                      <td>{index + 1}</td>
                      <td title={order.id}>{shortOrderNumber(order.id)}</td>
                      <td>{order.b2b?.storeName || order.recipient}</td>
                      <td className="delivery-sheet-address">{order.address}</td>
                      <td>{packages(order)}</td>
                      <td>{codDue(order) ? rupiah(codDue(order)) : 'Lunas'}</td>
                      <td>{orderStatusLabel(order)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ))
      )}
      {search.nextCursor && (
        <button
          type="button"
          className="admin-secondary delivery-sheet-more"
          disabled={search.moreBusy}
          onClick={search.loadMore}
        >
          {search.moreBusy ? 'Memuat…' : 'Muat pesanan lebih lama'}
        </button>
      )}
    </section>
  );
}
