import { useEffect, useState } from 'react';
import { isStoreDeliveryDate } from '../../data/b2bDeliverySchedule';
import './SharedDeliveryCalendar.css';

const monthName = new Intl.DateTimeFormat('id-ID', {
  month: 'long', year: 'numeric', timeZone: 'UTC',
});
const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const isoDate = (time) => new Date(time).toISOString().slice(0, 10);
const firstOfMonth = (date) => (date || new Date().toISOString().slice(0, 10)).slice(0, 7) + '-01';

export default function SharedDeliveryCalendar({ date, schedule, disabled, onChoose }) {
  const [month, setMonth] = useState(() => firstOfMonth(date));
  useEffect(() => {
    if (date) {
      // oxlint-disable-next-line react/set-state-in-effect
      setMonth(firstOfMonth(date));
    }
  }, [date]);
  const start = Date.parse(month + 'T00:00:00Z');
  const weekday = new Date(start).getUTCDay();
  const offset = (weekday + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => {
    const value = isoDate(start + (index - offset) * 86400000);
    return { value, inMonth: value.slice(0, 7) === month.slice(0, 7) };
  });
  const navigate = (delta) => {
    const next = isoDate(Date.UTC(
      new Date(start).getUTCFullYear(),
      new Date(start).getUTCMonth() + delta, 1,
    ));
    if (next >= '2000-01-01' && next <= '2099-12-01') setMonth(next);
  };
  return (
    <details className="shared-delivery-calendar" key={date ? date.slice(0, 7) : 'empty'}>
      <summary className="shared-delivery-calendar-summary">
        <span>
          <strong>Kalender pengiriman</strong>
          <small>{date ? 'Periode aktif: ' + date.split('-').reverse().join('/') : 'Pilih periode pengiriman'}</small>
        </span>
        <span className="shared-delivery-calendar-action">Lihat kalender</span>
      </summary>
      <div className="shared-delivery-calendar-content">
        <div className="shared-delivery-calendar-nav">
          <button type="button" aria-label="Bulan sebelumnya" disabled={disabled || month <= '2000-01-01'}
            onClick={() => navigate(-1)}>‹</button>
          <strong>{monthName.format(new Date(start))}</strong>
          <button type="button" aria-label="Bulan berikutnya" disabled={disabled || month >= '2099-12-01'}
            onClick={() => navigate(1)}>›</button>
        </div>
        <div className="shared-delivery-calendar-grid" role="group" aria-label="Pilih tanggal pengiriman">
          {dayNames.map((name) => <span className="shared-calendar-weekday" key={name}>{name}</span>)}
          {days.map(({ value, inMonth }) => {
            const eligible = inMonth && isStoreDeliveryDate(schedule, value);
            const selected = date === value;
            return (
              <button key={value} type="button" className={[
                'shared-calendar-date',
                !inMonth ? 'is-outside' : '',
                eligible ? 'is-eligible' : '',
                selected ? 'is-selected' : '',
              ].filter(Boolean).join(' ')}
                aria-label={'Tanggal ' + value.split('-').reverse().join('/')}
                aria-pressed={selected}
                title={!eligible && schedule ? 'Bukan jadwal tetap toko' : undefined}
                disabled={disabled || !eligible || selected}
                onClick={() => onChoose(value)}>
                {Number(value.slice(-2))}
              </button>
            );
          })}
        </div>
        <p>{schedule
          ? 'Hanya tanggal sesuai jadwal tetap toko yang dapat dipilih.'
          : 'Pilih tanggal rencana pengiriman untuk melihat keranjang periode tersebut.'}
        </p>
      </div>
    </details>
  );
}
