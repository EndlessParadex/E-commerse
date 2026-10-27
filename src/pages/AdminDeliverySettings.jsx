import { useEffect, useRef, useState } from 'react';
import { useDelivery } from '../state/useDelivery';
import useUnsavedChanges from '../state/useUnsavedChanges';
import { accountApi } from '../components/account/accountApi';
import { deliveryWeekdays } from '../data/deliverySchedule';
import AdminSectionIcon from '../components/admin/AdminSectionIcon';
import '../components/account/DeliverySchedules.css';
const blank = { name: '', weekday: 1, intervalWeeks: 1, anchorDate: '', active: true, revision: 0 };
function Assignment({ account, regions, busy, onAssign }) {
  const [regionId, setRegionId] = useState(account.regionId || '');
  useUnsavedChanges(regionId !== (account.regionId || ''), undefined, busy);
  return (
    <form
      className="delivery-region-assignment"
      onSubmit={(event) => {
        event.preventDefault();
        onAssign(account, regionId);
      }}
    >
      <div>
        <strong>{account.name}</strong>
        <small>{account.email}</small>
        <small>Wilayah saat ini: {account.regionName || 'Belum ditetapkan'}</small>
      </div>
      <div className="admin-field">
        <label htmlFor={'region-account-' + account.id}>Wilayah {account.name}</label>
        <select
          id={'region-account-' + account.id}
          value={regionId}
          disabled={busy}
          onChange={(event) => setRegionId(event.target.value)}
        >
          <option value="">Tanpa wilayah</option>
          {account.regionId &&
            !regions.some((region) => region.id === account.regionId && region.active) && (
              <option value={account.regionId}>{account.regionName} (nonaktif)</option>
            )}
          {regions
            .filter((region) => region.active)
            .map((region) => (
              <option value={region.id} key={region.id}>
                {region.name}
              </option>
            ))}
        </select>
      </div>
      <button
        type="submit"
        className="admin-secondary"
        disabled={busy || regionId === (account.regionId || '')}
      >
        Simpan wilayah
      </button>
    </form>
  );
}
export default function AdminDeliverySettings() {
  const { user } = useDelivery();
  const owner = user?.isOwner === true;
  const [regions, setRegions] = useState([]),
    [draft, setDraft] = useState(blank),
    [baseline, setBaseline] = useState(blank);
  const [accounts, setAccounts] = useState(null),
    [query, setQuery] = useState('');
  const [reloadAttempt, setReloadAttempt] = useState(0);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const active = useRef(true),
    pending = useRef(false),
    searchGeneration = useRef(0);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  useUnsavedChanges(dirty, undefined, busy);
  useEffect(() => {
    active.current = true;
    if (owner)
      accountApi('/api/admin/delivery/regions')
        .then((value) => {
          if (active.current) {
            setRegions(value.regions);
            setLoading(false);
          }
        })
        .catch((failure) => {
          if (active.current) {
            setError(failure.message);
            setLoading(false);
          }
        });
    return () => {
      active.current = false;
      searchGeneration.current += 1;
    };
  }, [owner, reloadAttempt]);
  const edit = (region) => {
    if (dirty && !window.confirm('Buang perubahan wilayah yang belum disimpan?')) return;
    const next = region
      ? {
          id: region.id,
          name: region.name,
          weekday: region.weekday,
          intervalWeeks: region.intervalWeeks,
          anchorDate: region.anchorDate,
          active: Boolean(region.active),
          revision: region.revision,
        }
      : blank;
    setDraft(next);
    setBaseline(next);
    setError('');
    setNotice('');
  };
  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const findAccounts = async (page = 1) => {
    const generation = ++searchGeneration.current;
    try {
      const value = await accountApi(
        '/api/admin/delivery/accounts?q=' + encodeURIComponent(query.trim()) + '&page=' + page,
      );
      if (active.current && generation === searchGeneration.current) {
        setAccounts(value);
        setError('');
      }
    } catch (failure) {
      if (active.current && generation === searchGeneration.current) setError(failure.message);
    }
  };
  const mutate = async (path, body, onSuccess) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const value = await accountApi(path, body);
      if (active.current) {
        onSuccess(value);
        setNotice(
          'Pengaturan wilayah tersimpan. Pesanan lama tetap mengikuti snapshot saat dibuat.',
        );
      }
    } catch (failure) {
      if (active.current) setError(failure.message);
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };
  if (!owner) return null;
  return (
    <section className="admin-panel delivery-settings" aria-labelledby="delivery-settings-title">
      <div className="admin-panel-heading">
        <AdminSectionIcon name="calendar" />
        <div>
          <h2 id="delivery-settings-title">Wilayah & jadwal pengiriman pribadi</h2>
          <p>
            Pemilik BAM menetapkan wilayah akun pembeli. Jadwal tetap toko B2B dikelola pada Toko &
            Sales.
          </p>
        </div>
      </div>
      <div className="delivery-settings-body">
        <p>
          Jadwal baru diterapkan pada pesanan berikutnya. Akun tanpa wilayah tetap memakai alur
          pengiriman yang sudah tersedia.
        </p>
        <div>
          <button
            type="button"
            className="admin-secondary"
            disabled={busy || loading}
            onClick={() => {
              if (dirty && !window.confirm('Buang isian dan muat wilayah terbaru?')) return;
              setDraft(blank);
              setBaseline(blank);
              setError('');
              setNotice('');
              setLoading(true);
              setReloadAttempt((value) => value + 1);
            }}
          >
            Muat ulang wilayah
          </button>
        </div>
        {loading && <p role="status">Memuat wilayah…</p>}
        {error && (
          <p className="admin-form-alert" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="admin-save-notice" role="status">
            {notice}
          </p>
        )}
        <ul className="delivery-region-list">
          {regions.map((region) => (
            <li key={region.id}>
              <div>
                <strong>
                  {region.name} · {region.active ? 'Aktif' : 'Nonaktif'}
                </strong>
                <small>
                  {deliveryWeekdays[region.weekday]} · setiap {region.intervalWeeks} minggu · acuan{' '}
                  {region.anchorDate} · {region.assignedCount} akun
                </small>
              </div>
              <button
                type="button"
                className="admin-secondary"
                disabled={busy}
                onClick={() => edit(region)}
              >
                Ubah wilayah {region.name}
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutate('/api/admin/delivery/regions', draft, (value) => {
              setRegions(value.regions);
              setDraft(blank);
              setBaseline(blank);
            });
          }}
        >
          <h3>{draft.id ? 'Ubah wilayah' : 'Tambah wilayah'}</h3>
          <fieldset className="delivery-region-form" disabled={busy || loading}>
            <div className="admin-field admin-full">
              <label htmlFor="region-name">Nama wilayah</label>
              <input
                id="region-name"
                required
                minLength={2}
                maxLength={100}
                value={draft.name}
                onChange={(event) => update('name', event.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="region-weekday">Hari pengiriman</label>
              <select
                id="region-weekday"
                value={draft.weekday}
                onChange={(event) => update('weekday', Number(event.target.value))}
              >
                {deliveryWeekdays.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="region-interval">Frekuensi</label>
              <select
                id="region-interval"
                value={draft.intervalWeeks}
                onChange={(event) => update('intervalWeeks', Number(event.target.value))}
              >
                <option value="1">Setiap minggu</option>
                <option value="2">Setiap dua minggu</option>
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="region-anchor">Tanggal acuan</label>
              <input
                id="region-anchor"
                type="date"
                required
                min="2000-01-01"
                max="2099-12-31"
                value={draft.anchorDate}
                onChange={(event) => update('anchorDate', event.target.value)}
              />
              <small>Tanggal acuan harus sesuai hari pengiriman.</small>
            </div>
            <label>
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => update('active', event.target.checked)}
              />{' '}
              Wilayah aktif
            </label>
            <div className="admin-heading-actions admin-full">
              <button type="submit" className="admin-primary" disabled={!dirty}>
                {busy ? 'Menyimpan…' : 'Simpan jadwal wilayah'}
              </button>
              <button type="button" className="admin-text-button" onClick={() => edit(null)}>
                Form wilayah baru
              </button>
            </div>
          </fieldset>
        </form>
        <section className="delivery-region-accounts">
          <h3>Hubungkan akun ke wilayah</h3>
          <form
            className="admin-heading-actions"
            onSubmit={(event) => {
              event.preventDefault();
              void findAccounts();
            }}
          >
            <div className="admin-field">
              <label htmlFor="region-account-search">Cari pembeli atau Sales</label>
              <input
                id="region-account-search"
                type="search"
                maxLength={200}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <button type="submit" className="admin-secondary" disabled={busy}>
              Cari akun wilayah
            </button>
          </form>
          {accounts?.accounts.map((account) => (
            <Assignment
              key={account.id + ':' + account.revision}
              account={account}
              regions={regions}
              busy={busy}
              onAssign={(target, regionId) =>
                mutate(
                  '/api/admin/delivery/assignment',
                  { userId: target.id, regionId, revision: target.revision },
                  () => {
                    void findAccounts(accounts.page);
                    setReloadAttempt((value) => value + 1);
                  },
                )
              }
            />
          ))}
          {accounts && (
            <div className="admin-heading-actions">
              <button
                className="admin-secondary"
                disabled={busy || accounts.page <= 1}
                onClick={() => findAccounts(accounts.page - 1)}
              >
                Sebelumnya
              </button>
              <span>
                {accounts.total} akun · {accounts.page}/{accounts.pages}
              </span>
              <button
                className="admin-secondary"
                disabled={busy || accounts.page >= accounts.pages}
                onClick={() => findAccounts(accounts.page + 1)}
              >
                Berikutnya
              </button>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
