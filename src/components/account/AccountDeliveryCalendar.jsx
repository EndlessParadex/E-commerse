import { useEffect, useState } from 'react';
import { accountApi } from './accountApi';
import { deliveryWeekdays } from '../../data/deliverySchedule';
import { isStoreDeliveryDate } from '../../data/b2bDeliverySchedule';
import './DeliverySchedules.css';

const dateLabel = (date) =>
  new Date(date + 'T00:00:00Z').toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
function Calendar({ entry, today }) {
  const [month, setMonth] = useState(() => today.slice(0, 7) + '-01');
  const start = Date.parse(month + 'T00:00:00Z');
  const offset = (new Date(start).getUTCDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) =>
    new Date(start + (index - offset) * 86400000).toISOString().slice(0, 10),
  );
  const move = (delta) =>
    setMonth(
      new Date(Date.UTC(new Date(start).getUTCFullYear(), new Date(start).getUTCMonth() + delta, 1))
        .toISOString()
        .slice(0, 10),
    );
  return (
    <article className="delivery-schedule-card">
      <header>
        <span>{entry.kind === 'region' ? 'Wilayah belanja pribadi' : 'Toko terhubung'}</span>
        <h3>{entry.label}</h3>
        <p>
          {deliveryWeekdays[entry.schedule.weekday]} · setiap {entry.schedule.intervalWeeks} minggu
        </p>
      </header>
      <div className="delivery-month-nav">
        <button
          type="button"
          className="account-page-secondary"
          aria-label={'Bulan sebelumnya untuk ' + entry.label}
          disabled={month <= '2000-01-01'}
          onClick={() => move(-1)}
        >
          ‹
        </button>
        <strong>
          {new Date(start).toLocaleDateString('id-ID', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          })}
        </strong>
        <button
          type="button"
          className="account-page-secondary"
          aria-label={'Bulan berikutnya untuk ' + entry.label}
          disabled={month >= '2099-12-01'}
          onClick={() => move(1)}
        >
          ›
        </button>
      </div>
      <div className="delivery-month-grid" role="group" aria-label={'Kalender ' + entry.label}>
        {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((label) => (
          <strong key={label}>{label}</strong>
        ))}
        {days.map((date) => {
          const inMonth = date.slice(0, 7) === month.slice(0, 7);
          const scheduled = inMonth && isStoreDeliveryDate(entry.schedule, date);
          return (
            <span
              key={date}
              className={(scheduled ? 'is-scheduled' : '') + (inMonth ? '' : ' is-outside')}
              aria-label={dateLabel(date) + (scheduled ? ', jadwal pengiriman' : '')}
              aria-current={date === today ? 'date' : undefined}
            >
              {Number(date.slice(-2))}
            </span>
          );
        })}
      </div>
      <p className="delivery-calendar-legend">Tanggal berwarna mengikuti jadwal rutin.</p>
      <ol className="delivery-upcoming" aria-label={'Pengiriman berikutnya ' + entry.label}>
        {entry.dates.slice(0, 3).map((date) => (
          <li key={date}>{dateLabel(date)}</li>
        ))}
      </ol>
    </article>
  );
}
export default function AccountDeliveryCalendar() {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [page, setPage] = useState(1),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    accountApi('/api/delivery/calendar?page=' + page)
      .then((payload) => {
        if (active) {
          setData(payload);
          setError('');
        }
      })
      .catch((failure) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, [page, retry]);
  const changePage = (value) => {
    setData(null);
    setPage(value);
  };
  return (
    <section className="account-delivery-calendar">
      <p>
        Jadwal rutin mengikuti data toko atau wilayah dari server. Tanggal ini adalah rencana
        pengiriman; status barang mengikuti detail pesanan.
      </p>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="account-page-secondary"
            onClick={() => setRetry(retry + 1)}
          >
            Muat ulang jadwal
          </button>
        </div>
      ) : !data ? (
        <p role="status">Memuat jadwal pengiriman…</p>
      ) : (
        <>
          {data.schedules.length ? (
            <div className="delivery-calendars">
              {data.schedules.map((entry) => (
                <Calendar key={entry.kind + entry.id} entry={entry} today={data.today} />
              ))}
            </div>
          ) : (
            <p>
              Jadwal belum ditetapkan. Pemilik BAM dapat mengatur jadwal toko atau wilayah akun
              Anda.
            </p>
          )}
          {data.unscheduledStores > 0 && (
            <p>{data.unscheduledStores} toko pada halaman ini belum memiliki jadwal tetap.</p>
          )}
          {data.pages > 1 && (
            <div className="delivery-month-nav">
              <button
                className="account-page-secondary"
                disabled={data.page <= 1}
                onClick={() => changePage(data.page - 1)}
              >
                Sebelumnya
              </button>
              <span>
                Halaman {data.page}/{data.pages}
              </span>
              <button
                className="account-page-secondary"
                disabled={data.page >= data.pages}
                onClick={() => changePage(data.page + 1)}
              >
                Berikutnya
              </button>
            </div>
          )}
        </>
      )}
      <a className="account-page-secondary" href="#/pesanan">
        Lihat pesanan saya →
      </a>
    </section>
  );
}
