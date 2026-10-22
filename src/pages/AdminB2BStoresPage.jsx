import { useEffect, useRef, useState } from 'react';
import { accountApi } from '../components/account/accountApi';
import { useDelivery } from '../state/useDelivery';
import useUnsavedChanges from '../state/useUnsavedChanges';
import ConfirmDialog from '../components/shop/ConfirmDialog';
import { nextStoreDelivery } from '../data/b2bDeliverySchedule';
import './AdminB2BStoresPage.css';

const emptyStore = { storeName: '', phone: '', address: '' };

const weekdayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const blankDelivery = { weekday: '1', intervalWeeks: '1', anchorDate: '' };
const scheduleLabel = (schedule) => schedule
  ? weekdayNames[schedule.weekday] + ' · setiap ' + schedule.intervalWeeks +
    ' minggu · mulai ' + schedule.anchorDate
  : 'Jadwal belum ditetapkan';
const isoDate = (year, month, day) =>
  String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' +
  String(day).padStart(2, '0');
// Capture the local date once when this module loads, not during React render.
const calendarToday = (() => {
  const date = new Date();
  return isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
})();
const parseDeliveryDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date : null;
};
const calendarDateLabel = (value) => {
  const date = parseDeliveryDate(value);
  return date ? new Intl.DateTimeFormat('id-ID', {
    timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date) : value;
};
const calendarMonthLabel = (year, month) => new Intl.DateTimeFormat('id-ID', {
  timeZone: 'UTC', month: 'long', year: 'numeric',
}).format(new Date(Date.UTC(year, month, 1)));
const validAnchorWeekday = (schedule) => {
  const date = parseDeliveryDate(schedule?.anchorDate);
  return Boolean(date && date.getUTCDay() === Number(schedule.weekday));
};
function DeliveryCalendar({ schedule, onChange, prefix, readOnly = false }) {
  const anchor = parseDeliveryDate(schedule?.anchorDate);
  const [month, setMonth] = useState(() => {
    const date = (readOnly ? null : anchor) || parseDeliveryDate(calendarToday);
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
  });
  const firstDay = new Date(Date.UTC(month.year, month.month, 1));
  const offset = (firstDay.getUTCDay() + 6) % 7; // Monday is the first calendar column.
  const dayCount = new Date(Date.UTC(month.year, month.month + 1, 0)).getUTCDate();
  const cellCount = Math.ceil((offset + dayCount) / 7) * 7;
  const stepDays = Number(schedule?.intervalWeeks) * 7;
  const validAnchor = validAnchorWeekday(schedule);
  const moveMonth = (direction) => {
    const next = new Date(Date.UTC(month.year, month.month + direction, 1));
    setMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  };
  const isScheduled = (date) => {
    if (!validAnchor || !Number.isInteger(stepDays) || stepDays < 7) return false;
    const days = Math.round((date.getTime() - anchor.getTime()) / 86400000);
    return days >= 0 && days % stepDays === 0;
  };
  const today = calendarToday;
  const startPreviewDate = readOnly && validAnchor
    ? nextStoreDelivery(schedule, today) : schedule?.anchorDate;
  const startPreview = parseDeliveryDate(startPreviewDate);
  const exampleDates = startPreview
    ? Array.from({ length: 3 }, (_, index) => {
      const next = new Date(startPreview.getTime() + index * stepDays * 86400000);
      return next.toISOString().slice(0, 10);
    }) : [];
  return (
    <div className="b2b-calendar-panel" aria-label={readOnly ? 'Kalender jadwal pengiriman tetap' : 'Kalender pilih tanggal acuan'}>
      <div className="b2b-calendar-top">
        <div>
          <strong>{calendarMonthLabel(month.year, month.month)}</strong>
          <small>{readOnly ? 'Tanggal pengiriman rutin' : 'Pilih tanggal pada hari ' + weekdayNames[Number(schedule.weekday)]}</small>
        </div>
        <div className="b2b-calendar-navigation">
          <button type="button" className="admin-secondary"
            aria-label={'Bulan sebelumnya - ' + prefix} onClick={() => moveMonth(-1)}>‹</button>
          <button type="button" className="admin-secondary"
            aria-label={'Bulan berikutnya - ' + prefix} onClick={() => moveMonth(1)}>›</button>
        </div>
      </div>
      <div className="b2b-calendar-grid" aria-label={calendarMonthLabel(month.year, month.month)}>
        {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((name) => (
          <span key={name} className="b2b-calendar-weekday">{name}</span>
        ))}
        {Array.from({ length: cellCount }, (_, index) => {
          const day = index - offset + 1;
          if (day < 1 || day > dayCount)
            return <span className="b2b-calendar-empty" key={'empty-' + index} aria-hidden="true" />;
          const date = new Date(Date.UTC(month.year, month.month, day));
          const value = isoDate(month.year, month.month + 1, day);
          const chosen = value === schedule.anchorDate;
          const eligible = date.getUTCDay() === Number(schedule.weekday);
          const recurring = isScheduled(date);
          const className = 'b2b-calendar-date' +
            (chosen ? ' is-selected' : '') +
            (recurring ? ' is-scheduled' : '') +
            (value === today ? ' is-today' : '');
          return readOnly
            ? <span className={className + (recurring ? '' : ' is-unavailable')}
                key={value} aria-label={calendarDateLabel(value) + (recurring ? ', pengiriman tetap' : '')}
                data-calendar-date={value}>{day}</span>
            : <button type="button" key={value} className={className}
                data-calendar-date={value} aria-pressed={chosen}
                aria-label={'Pilih ' + calendarDateLabel(value)}
                title={eligible ? 'Pilih tanggal acuan' : 'Hanya hari ' + weekdayNames[Number(schedule.weekday)] + ' yang dapat dipilih'}
                disabled={!eligible}
                onClick={() => onChange({ ...schedule, anchorDate: value })}>{day}</button>;
        })}
      </div>
      <div className="b2b-calendar-legend">
        <span><i className="b2b-calendar-key eligible" />{readOnly ? 'Tanggal pengiriman' : 'Hari yang dapat dipilih'}</span>
        <span><i className="b2b-calendar-key selected" />{readOnly ? 'Tanggal acuan' : 'Pilihan Anda'}</span>
      </div>
      {validAnchor && (
        <div className="b2b-calendar-preview">
          <strong>{readOnly ? 'Tiga jadwal pengiriman berikutnya' : 'Pratinjau jadwal berdasarkan tanggal acuan'}</strong>
          <div>{exampleDates.map((date) => <span key={date}>{calendarDateLabel(date)}</span>)}</div>
          <small>Tanggal berikutnya akan dihitung otomatis setiap {stepDays} hari.</small>
        </div>
      )}
      {!validAnchor && !readOnly && (
        <p className="b2b-calendar-help">Tanggal acuan belum dipilih. Pilih salah satu tanggal yang tersedia pada kalender.</p>
      )}
    </div>
  );
}
function DeliveryScheduleInputs({ schedule, onChange, prefix }) {
  const isValid = !schedule.anchorDate || validAnchorWeekday(schedule);
  return (
    <div className="b2b-delivery-fields">
      <div className="admin-field">
        <label htmlFor={prefix + '-weekday'}>Hari pengiriman tetap</label>
        <select id={prefix + '-weekday'} value={schedule.weekday}
          onChange={(event) => {
            const weekday = event.target.value;
            const matches = parseDeliveryDate(schedule.anchorDate)?.getUTCDay() === Number(weekday);
            onChange({ ...schedule, weekday, anchorDate: matches ? schedule.anchorDate : '' });
          }}>
          {weekdayNames.map((day, index) => (
            <option key={day} value={index}>{day}</option>
          ))}
        </select>
      </div>
      <div className="admin-field">
        <label htmlFor={prefix + '-frequency'}>Frekuensi pengiriman</label>
        <select id={prefix + '-frequency'} value={schedule.intervalWeeks}
          onChange={(event) => onChange({ ...schedule, intervalWeeks: event.target.value })}>
          <option value="1">Setiap 1 minggu</option>
          <option value="2">Setiap 2 minggu</option>
        </select>
      </div>
      <div className="b2b-full">
        <DeliveryCalendar key={prefix + ':' + schedule.anchorDate}
          schedule={schedule} onChange={onChange} prefix={prefix} />
      </div>
      <div className="b2b-date-fallback b2b-full">
        <label htmlFor={prefix + '-anchor'}>Atau masukkan tanggal acuan secara manual</label>
        <input id={prefix + '-anchor'} type="date" required value={schedule.anchorDate}
          aria-invalid={!isValid}
          aria-describedby={prefix + '-date-help'}
          onChange={(event) => onChange({ ...schedule, anchorDate: event.target.value })} />
        <small id={prefix + '-date-help'} className={!isValid ? 'b2b-calendar-error' : ''}>
          {!isValid ? 'Tanggal harus sesuai hari ' + weekdayNames[Number(schedule.weekday)] + '.' :
            'Tanggal hanya dapat ditetapkan satu kali. Setelah disimpan, jadwal terkunci.'}
        </small>
      </div>
    </div>
  );
}

function useResource(path, revision) {
  const [state, setState] = useState({ path: null, revision: -1 });
  useEffect(() => {
    if (!path) return;
    let active = true;
    accountApi(path).then(
      (data) => {
        if (active) setState({ path, revision, data });
      },
      (error) => {
        if (active) setState({ path, revision, error: error.message });
      },
    );
    return () => {
      active = false;
    };
  }, [path, revision]);
  return state.path === path && state.revision === revision ? state : { loading: Boolean(path) };
}

function Pagination({ data, onPage, busy, label }) {
  if (!data || data.pages <= 1) return null;
  const page = data.page;
  return (
    <nav className="b2b-pagination" aria-label={label}>
      <button
        type="button"
        className="admin-secondary"
        disabled={busy || page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Sebelumnya
      </button>
      <span>
        Halaman {page} dari {data.pages}
      </span>
      <button
        type="button"
        className="admin-secondary"
        disabled={busy || page >= data.pages}
        onClick={() => onPage(page + 1)}
      >
        Berikutnya
      </button>
    </nav>
  );
}

function AccountList({ accounts, empty, onRemove, onReplace, busy }) {
  return accounts.length ? (
    <ul className="b2b-people">
      {accounts.map((account) => (
        <li key={account.id}>
          <strong>{account.name}</strong>
          <span>{account.email}</span>
          {!account.active && <small>Akun tidak aktif</small>}
          {(onRemove || onReplace) && (
            <div className="b2b-actions">
              {onReplace && (
                <button
                  type="button"
                  className="admin-secondary"
                  disabled={busy}
                  onClick={() => onReplace(account)}
                >
                  Ganti Sales
                </button>
              )}
              {onRemove && (
                <button
                  type="button"
                  className="bam-button-danger"
                  disabled={busy}
                  onClick={() => onRemove(account)}
                >
                  {onReplace ? 'Cabut penugasan' : 'Lepas pembeli'}
                </button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  ) : (
    <p className="b2b-muted">{empty}</p>
  );
}

export default function AdminB2BStoresPage() {
  const { user } = useDelivery();
  const owner = user?.isOwner === true;
  const staff = user?.role === 'admin';
  const [form, setForm] = useState(emptyStore);
  const [deliveryForm, setDeliveryForm] = useState(blankDelivery);
  const [legacyDelivery, setLegacyDelivery] = useState(blankDelivery);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState('');
  const [accountQuery, setAccountQuery] = useState('');
  const [accountPage, setAccountPage] = useState(1);
  const [salesId, setSalesId] = useState('');
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [appointment, setAppointment] = useState(null);
  const [change, setChange] = useState(null);
  const [replacement, setReplacement] = useState('');
  const [editForm, setEditForm] = useState(emptyStore);
  const pending = useRef(false);
  const mounted = useRef(false);
  const [storeSearch, setStoreSearch] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      setStoreSearch(query.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setAccountSearch(accountQuery.trim());
      setAccountPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [accountQuery]);
  useUnsavedChanges(
    Object.values(form).some(Boolean) || deliveryForm.anchorDate !== '' ||
      legacyDelivery.anchorDate !== '' || Boolean(salesId) || Boolean(change),
    undefined,
    busy,
  );

  const stores = useResource(
    staff ? '/api/b2b/stores?' + new URLSearchParams({ q: storeSearch, page: String(page) }) : null,
    revision,
  );
  const selectedId = selected || stores.data?.stores[0]?.id || '';
  const details = useResource(
    staff && selectedId ? '/api/b2b/stores/' + encodeURIComponent(selectedId) : null,
    revision,
  );
  const sales = useResource(staff ? '/api/b2b/sales' : null, revision);
  const candidates = useResource(
    owner
      ? '/api/b2b/accounts?' + new URLSearchParams({ q: accountSearch, page: String(accountPage) })
      : null,
    revision,
  );

  const mutate = async (path, body, message, onSuccess, method) => {
    if (pending.current || !owner) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await accountApi(path, body, 15000, method);
      if (!mounted.current) return;
      onSuccess?.(result);
      setNotice(message);
      setRevision((value) => value + 1);
    } catch (err) {
      if (mounted.current) setError(err.message);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const current = details.data;
  const openChange = (kind, account) => {
    setError('');
    setReplacement('');
    setEditForm({
      storeName: current.store.storeName,
      phone: current.store.phone,
      address: current.store.address,
    });
    setChange({
      kind,
      account,
      store: current.store,
      otherAccess:
        account &&
        (kind === 'members' ? current.sales : current.members).some((row) => row.id === account.id),
    });
  };
  const saveChange = () => {
    const path = '/api/b2b/stores/' + encodeURIComponent(change.store.id);
    const revision = change.store.revision;
    if (change.kind === 'edit')
      return mutate(
        path,
        { ...editForm, revision },
        'Data toko berhasil diperbarui.',
        () => setChange(null),
        'PUT',
      );
    if (change.kind === 'replace') {
      if (!replacement) {
        setError('Pilih Sales pengganti.');
        return;
      }
      return mutate(
        path + '/sales',
        { userId: replacement, replaceUserId: change.account.id, revision },
        'Sales pengganti tersimpan. Penugasan Sales sebelumnya telah dicabut dari toko ini.',
        () => setChange(null),
      );
    }
    return mutate(
      path + '/' + change.kind + '/remove',
      { userId: change.account.id, revision },
      change.kind === 'sales'
        ? 'Penugasan Sales berhasil dicabut dari toko ini.'
        : 'Pembeli berhasil dilepas dari toko ini.',
      () => setChange(null),
    );
  };
  const availableSales =
    sales.data?.sales.filter(
      (account) => !current?.sales.some((assigned) => assigned.id === account.id),
    ) || [];
  const reload = () => setRevision((value) => value + 1);
  const loadMessage = (resource, label) => (
    <>
      {resource.loading && <p role="status">Memuat {label}…</p>}
      {resource.error && (
        <div className="b2b-error" role="alert">
          <p>{resource.error}</p>
          <button className="admin-secondary" type="button" disabled={busy} onClick={reload}>
            Coba lagi
          </button>
        </div>
      )}
    </>
  );
  if (!staff)
    return (
      <section className="admin-panel b2b-panel">
        <h2>Akses admin diperlukan</h2>
      </section>
    );
  return (
    <div className="b2b-page">
      {notice && (
        <p className="b2b-notice" role="status">
          {notice}
        </p>
      )}
      {error && !appointment && !change && (
        <p className="b2b-error" role="alert">
          {error}
        </p>
      )}
      {!owner && (
        <p className="b2b-readonly">
          Anda dapat melihat toko dan penugasan. Perubahan dikelola oleh Pemilik BAM.
        </p>
      )}

      {owner && (
        <details className="admin-panel b2b-panel b2b-create">
          <summary>Tambah toko</summary>
          <form
            id="b2b-create-form"
            onSubmit={(event) => {
              event.preventDefault();
              mutate(
                '/api/b2b/stores/create',
                {
                  ...form,
                  deliverySchedule: {
                    weekday: Number(deliveryForm.weekday),
                    intervalWeeks: Number(deliveryForm.intervalWeeks),
                    anchorDate: deliveryForm.anchorDate,
                  },
                },
                'Toko beserta jadwal pengiriman tetap berhasil dibuat.',
                (result) => {
                  setForm(emptyStore);
                  setDeliveryForm(blankDelivery);
                  setSelected(result.store.id);
                  setQuery('');
                  setStoreSearch('');
                  setPage(1);
                },
              );
            }}
          >
            <fieldset disabled={busy} className="b2b-form-grid">
              <div className="admin-field">
                <label htmlFor="b2b-store-name">Nama toko</label>
                <input
                  id="b2b-store-name"
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.storeName}
                  onChange={(event) => setForm({ ...form, storeName: event.target.value })}
                />
              </div>
              <div className="admin-field">
                <label htmlFor="b2b-store-phone">Nomor HP toko</label>
                <input
                  id="b2b-store-phone"
                  type="tel"
                  required
                  maxLength={30}
                  placeholder="08xxxxxxxxxx"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </div>
              <div className="admin-field b2b-full">
                <label htmlFor="b2b-store-address">Alamat toko</label>
                <textarea
                  id="b2b-store-address"
                  rows={3}
                  required
                  minLength={10}
                  maxLength={500}
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                />
              </div>
              <div className="b2b-full b2b-schedule-section">
                <h3>Jadwal pengiriman tetap</h3>
                <DeliveryScheduleInputs
                  schedule={deliveryForm}
                  onChange={setDeliveryForm}
                  prefix="b2b-create-delivery"
                />
              </div>
              <div className="b2b-actions b2b-full">
                <button className="admin-primary" type="submit"
                  disabled={busy || !validAnchorWeekday(deliveryForm)}>
                  {busy ? 'Menyimpan…' : 'Simpan toko'}
                </button>
                <button
                  className="admin-secondary"
                  type="button"
                  onClick={() => { setForm(emptyStore); setDeliveryForm(blankDelivery); }}
                >
                  Kosongkan form
                </button>
              </div>
            </fieldset>
          </form>
        </details>
      )}

      <div className="b2b-workspace">
        <section className="admin-panel b2b-panel" aria-labelledby="b2b-list-heading">
          <div className="b2b-heading">
            <h2 id="b2b-list-heading">Daftar toko</h2>
            <button className="admin-secondary" type="button" disabled={busy} onClick={reload}>
              Muat ulang
            </button>
          </div>
          <div className="admin-field">
            <label htmlFor="b2b-store-search">Cari nama, kode, atau nomor HP</label>
            <input
              id="b2b-store-search"
              type="search"
              maxLength={200}
              disabled={busy}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {loadMessage(stores, 'toko')}
          {stores.data && (
            <>
              <p className="b2b-muted">{stores.data.total} toko ditemukan</p>
              <ul className="b2b-store-list">
                {stores.data.stores.map((store) => (
                  <li key={store.id}>
                    <button
                      type="button"
                      data-store-id={store.id}
                      aria-pressed={selectedId === store.id}
                      disabled={busy}
                      onClick={() => {
                        setSelected(store.id);
                        setSalesId('');
                      }}
                    >
                      <strong>{store.storeName}</strong>
                      <span>{store.storeCode}</span>
                      <span>{store.phone}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {!stores.data.total && <p className="b2b-muted">Belum ada toko yang sesuai.</p>}
              <Pagination data={stores.data} onPage={setPage} busy={busy} label="Halaman toko" />
            </>
          )}
        </section>

        <section className="admin-panel b2b-panel" aria-label="Detail dan penugasan toko">
          {!selectedId && (
            <div className="b2b-empty">
              <h2>Pilih toko</h2>
              <p>Pilih toko untuk melihat akun pembeli dan Sales yang ditugaskan.</p>
            </div>
          )}
          {loadMessage(details, 'detail toko')}
          {current && (
            <>
              <span className="b2b-code">{current.store.storeCode}</span>
              <h2>{current.store.storeName}</h2>
              <p className="b2b-muted">{current.store.phone}</p>
              <p className="b2b-address">{current.store.address}</p>
              <div className="b2b-schedule-section">
                <h3>Jadwal pengiriman tetap</h3>
                <p>{scheduleLabel(current.store.deliverySchedule)}</p>
                {current.store.deliverySchedule && (
                  <DeliveryCalendar
                    key={current.store.id + ':' + current.store.deliverySchedule.anchorDate}
                    schedule={current.store.deliverySchedule}
                    prefix="b2b-saved-delivery"
                    readOnly
                  />
                )}
                {!current.store.deliverySchedule && owner && (
                  <form
                    className="b2b-form-grid b2b-schedule-assignment"
                    aria-label="Tetapkan jadwal pengiriman toko"
                    onSubmit={(event) => {
                      event.preventDefault();
                      mutate(
                        '/api/b2b/stores/' + encodeURIComponent(current.store.id) + '/schedule',
                        {
                          ...legacyDelivery,
                          weekday: Number(legacyDelivery.weekday),
                          intervalWeeks: Number(legacyDelivery.intervalWeeks),
                          revision: current.store.revision,
                        },
                        'Jadwal pengiriman toko ditetapkan dan dikunci.',
                        () => setLegacyDelivery(blankDelivery),
                      );
                    }}
                  >
                    <DeliveryScheduleInputs
                      schedule={legacyDelivery}
                      onChange={setLegacyDelivery}
                      prefix="b2b-legacy-delivery"
                    />
                    <button type="submit" className="admin-primary"
                      disabled={busy || !validAnchorWeekday(legacyDelivery)}>
                      Tetapkan jadwal sekali
                    </button>
                  </form>
                )}
              </div>
              {owner && (
                <button
                  type="button"
                  className="admin-secondary"
                  disabled={busy}
                  onClick={() => openChange('edit')}
                >
                  Ubah data toko
                </button>
              )}
              <div className="b2b-assignment-grid">
                <section>
                  <h3>Akun pembeli</h3>
                  <AccountList
                    accounts={current.members}
                    empty="Belum ada pembeli yang dihubungkan."
                    busy={busy}
                    onRemove={owner ? (account) => openChange('members', account) : undefined}
                  />
                </section>
                <section>
                  <h3>Sales yang ditugaskan</h3>
                  <AccountList
                    accounts={current.sales}
                    empty="Belum ada Sales yang ditugaskan."
                    busy={busy}
                    onRemove={owner ? (account) => openChange('sales', account) : undefined}
                    onReplace={owner ? (account) => openChange('replace', account) : undefined}
                  />
                </section>
              </div>
              {owner && (
                <form
                  id="b2b-assign-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!salesId) return;
                    mutate(
                      '/api/b2b/stores/' + encodeURIComponent(selectedId) + '/sales',
                      { userId: salesId, revision: current.store.revision },
                      'Sales berhasil ditugaskan ke toko.',
                      () => setSalesId(''),
                    );
                  }}
                >
                  <fieldset
                    disabled={busy || sales.loading || Boolean(sales.error)}
                    className="b2b-inline-form"
                  >
                    <div className="admin-field">
                      <label htmlFor="b2b-sales-choice">Tugaskan Sales ke toko ini</label>
                      <select
                        id="b2b-sales-choice"
                        required
                        value={salesId}
                        onChange={(event) => setSalesId(event.target.value)}
                      >
                        <option value="">Pilih Sales</option>
                        {availableSales.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} · {account.email}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button className="admin-primary" type="submit" disabled={!salesId}>
                      Tugaskan Sales
                    </button>
                  </fieldset>
                </form>
              )}
            </>
          )}
        </section>
      </div>

      <section className="admin-panel b2b-panel" aria-labelledby="b2b-sales-heading">
        <h2 id="b2b-sales-heading">Sales terdaftar</h2>
        {loadMessage(sales, 'Sales')}
        {sales.data &&
          (sales.data.sales.length ? (
            <ul className="b2b-sales-list">
              {sales.data.sales.map((account) => (
                <li key={account.id}>
                  <strong>{account.name}</strong>
                  <span>{account.email}</span>
                  <span>{account.assignedStores} toko ditugaskan</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="b2b-muted">Belum ada Sales terdaftar.</p>
          ))}
      </section>

      {owner && (
        <section className="admin-panel b2b-panel" aria-labelledby="b2b-accounts-heading">
          <h2 id="b2b-accounts-heading">Hubungkan akun</h2>
          <p className="b2b-muted">
            Cari akun aktif yang sudah disetujui. Hubungkan pembeli ke toko yang dipilih, atau
            daftarkan akun staf sebagai Sales.
          </p>
          <div className="admin-field">
            <label htmlFor="b2b-account-search">Cari nama atau email akun</label>
            <input
              id="b2b-account-search"
              type="search"
              maxLength={200}
              disabled={busy}
              value={accountQuery}
              onChange={(event) => setAccountQuery(event.target.value)}
            />
          </div>
          {loadMessage(candidates, 'akun')}
          {candidates.data && (
            <>
              <p className="b2b-muted">{candidates.data.total} akun ditemukan</p>
              <ul className="b2b-candidates">
                {candidates.data.users.map((account) => {
                  const linked = current?.members.some((member) => member.id === account.id);
                  return (
                    <li key={account.id} data-b2b-account={account.id}>
                      <div>
                        <strong>{account.name}</strong>
                        <span>{account.email}</span>
                        {account.memberStores > 0 && (
                          <small>Terhubung ke {account.memberStores} toko sebagai pembeli</small>
                        )}
                      </div>
                      <div className="b2b-actions">
                        <button
                          className="admin-secondary"
                          type="button"
                          disabled={busy || !current || linked}
                          onClick={() =>
                            mutate(
                              '/api/b2b/stores/' + encodeURIComponent(selectedId) + '/members',
                              { userId: account.id, revision: current.store.revision },
                              'Pembeli berhasil dihubungkan ke toko.',
                            )
                          }
                        >
                          {linked ? 'Sudah terhubung' : 'Hubungkan pembeli'}
                        </button>
                        <button
                          className="admin-text-button"
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setAppointment(account);
                            setError('');
                          }}
                        >
                          Daftarkan sebagai Sales
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {!candidates.data.total && (
                <p className="b2b-muted">
                  Tidak ada akun yang sesuai. Periksa status akun di Kelola akun atau Persetujuan
                  akun.
                </p>
              )}
              <Pagination
                data={candidates.data}
                onPage={setAccountPage}
                busy={busy}
                label="Halaman akun B2B"
              />
            </>
          )}
        </section>
      )}
      {change && (
        <ConfirmDialog
          title={
            change.kind === 'edit'
              ? 'Ubah data toko'
              : change.kind === 'replace'
                ? 'Ganti Sales toko'
                : change.kind === 'sales'
                  ? 'Cabut penugasan Sales?'
                  : 'Lepas pembeli dari toko?'
          }
          confirmLabel={
            change.kind === 'edit' || change.kind === 'replace'
              ? 'Simpan perubahan'
              : change.kind === 'sales'
                ? 'Cabut penugasan'
                : 'Lepas hubungan pembeli'
          }
          danger={['sales', 'members'].includes(change.kind)}
          busy={busy}
          error={error}
          onClose={() => {
            if (!pending.current) {
              setChange(null);
              setError('');
            }
          }}
          onConfirm={saveChange}
        >
          <p>
            <strong>{change.store.storeName}</strong> · {change.store.storeCode}
          </p>
          {change.account && (
            <p>
              {change.account.name}
              <br />
              {change.account.email}
            </p>
          )}
          {change.kind === 'edit' ? (
            <fieldset disabled={busy} className="b2b-edit-fields">
              <label htmlFor="b2b-edit-name">
                Nama toko
                <input
                  id="b2b-edit-name"
                  maxLength={100}
                  value={editForm.storeName}
                  onChange={(event) => setEditForm({ ...editForm, storeName: event.target.value })}
                />
              </label>
              <label htmlFor="b2b-edit-phone">
                Nomor HP toko
                <input
                  id="b2b-edit-phone"
                  type="tel"
                  maxLength={30}
                  value={editForm.phone}
                  onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })}
                />
              </label>
              <label htmlFor="b2b-edit-address">
                Alamat toko
                <textarea
                  id="b2b-edit-address"
                  rows={3}
                  maxLength={500}
                  value={editForm.address}
                  onChange={(event) => setEditForm({ ...editForm, address: event.target.value })}
                />
              </label>
            </fieldset>
          ) : (
            <>
              <p>
                {change.kind === 'members'
                  ? 'Hubungan pembeli dengan toko ini akan dilepas.'
                  : 'Penugasan Sales pada toko ini akan dicabut.'}{' '}
                Riwayat keranjang dan pesanan tetap tersimpan. Penugasan pada toko lain tetap
                berlaku.
              </p>
              {change.otherAccess && (
                <p>
                  {change.kind === 'members'
                    ? 'Akun ini masih mempunyai penugasan Sales di toko yang sama. Cabut penugasan Sales juga untuk menghentikan seluruh aksesnya ke toko ini.'
                    : 'Akun ini juga terhubung sebagai pembeli di toko yang sama. Hubungan pembeli tetap memberi akses; lepas hubungan tersebut juga untuk menghentikan seluruh aksesnya ke toko ini.'}
                </p>
              )}
              {change.kind === 'replace' && (
                <label htmlFor="b2b-replacement">
                  Sales pengganti
                  <select
                    id="b2b-replacement"
                    disabled={busy}
                    value={replacement}
                    onChange={(event) => setReplacement(event.target.value)}
                  >
                    <option value="">Pilih Sales</option>
                    {availableSales.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {account.email}
                      </option>
                    ))}
                  </select>
                  {!availableSales.length && (
                    <span>
                      Belum ada Sales lain yang tersedia. Tutup formulir ini dan daftarkan akun staf
                      lain sebagai Sales pada bagian Hubungkan akun.
                    </span>
                  )}
                </label>
              )}
            </>
          )}
          {error && (
            <p>
              Tutup formulir ini lalu tekan Muat ulang bila data sudah berubah. Periksa kembali
              sebelum menyimpan.
            </p>
          )}
        </ConfirmDialog>
      )}
      {appointment && (
        <ConfirmDialog
          title="Daftarkan akun sebagai Sales"
          confirmLabel="Daftarkan Sales"
          busy={busy}
          error={error}
          onClose={() => {
            if (!pending.current) {
              setAppointment(null);
              setError('');
            }
          }}
          onConfirm={() =>
            mutate(
              '/api/b2b/sales/appoint',
              { userId: appointment.id },
              'Akun berhasil didaftarkan sebagai Sales.',
              () => setAppointment(null),
            )
          }
        >
          <p>
            <strong>{appointment.name}</strong>
            <br />
            {appointment.email}
          </p>
          <p>
            Akun ini akan menjadi Sales dan dapat ditugaskan ke toko. Pastikan akun yang dipilih
            adalah akun staf.
          </p>
          {appointment.memberStores > 0 && (
            <p>
              Akun ini sudah terhubung sebagai pembeli ke {appointment.memberStores} toko. Akses
              toko tersebut tetap berlaku.
            </p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
