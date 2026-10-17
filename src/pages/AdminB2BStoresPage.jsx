import { useEffect, useRef, useState } from 'react';
import { accountApi } from '../components/account/accountApi';
import { useDelivery } from '../state/useDelivery';
import useUnsavedChanges from '../state/useUnsavedChanges';
import ConfirmDialog from '../components/shop/ConfirmDialog';
import './AdminB2BStoresPage.css';

const emptyStore = { storeName: '', phone: '', address: '' };

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

function AccountList({ accounts, empty }) {
  return accounts.length ? (
    <ul className="b2b-people">
      {accounts.map((account) => (
        <li key={account.id}>
          <strong>{account.name}</strong>
          <span>{account.email}</span>
          {!account.active && <small>Akun tidak aktif</small>}
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
  useUnsavedChanges(Object.values(form).some(Boolean) || Boolean(salesId), undefined, busy);

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

  const mutate = async (path, body, message, onSuccess) => {
    if (pending.current || !owner) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await accountApi(path, body);
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
      {error && !appointment && (
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
                form,
                'Toko berhasil dibuat dan disimpan.',
                (result) => {
                  setForm(emptyStore);
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
              <div className="b2b-actions b2b-full">
                <button className="admin-primary" type="submit">
                  {busy ? 'Menyimpan…' : 'Simpan toko'}
                </button>
                <button
                  className="admin-secondary"
                  type="button"
                  onClick={() => setForm(emptyStore)}
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
              <div className="b2b-assignment-grid">
                <section>
                  <h3>Akun pembeli</h3>
                  <AccountList
                    accounts={current.members}
                    empty="Belum ada pembeli yang dihubungkan."
                  />
                </section>
                <section>
                  <h3>Sales yang ditugaskan</h3>
                  <AccountList accounts={current.sales} empty="Belum ada Sales yang ditugaskan." />
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
                      { userId: salesId },
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
                              { userId: account.id },
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
