import { useCallback, useEffect, useRef, useState } from 'react';
import { useDelivery } from '../state/useDelivery';
import { accountApi } from '../components/account/accountApi';
import AdminSectionIcon from '../components/admin/AdminSectionIcon';
import ConfirmDialog from '../components/shop/ConfirmDialog';

export default function AdminDriversPage() {
  const { user } = useDelivery();
  const owner = user?.isOwner === true;
  const [drivers, setDrivers] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [removal, setRemoval] = useState(null);
  const [dialogError, setDialogError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const load = useCallback(
    () =>
      accountApi('/api/drivers')
        .then((payload) => setDrivers(payload.drivers))
        .catch((failure) => setError(failure.message)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  const search = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const params = new URLSearchParams({ q: query.trim(), purpose: 'owner' });
      setCandidates((await accountApi('/api/b2b/accounts?' + params)).users);
    } catch (failure) {
      setError(failure.message);
    }
  };
  const save = async (path, userId, message, close) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await accountApi(path, { userId });
      close();
      setCandidates(null);
      setNotice(message);
      await load();
    } catch (failure) {
      setDialogError(failure.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      {notice && (
        <p className="admin-save-notice" role="status">
          ✓ {notice}
        </p>
      )}
      {error && (
        <p className="admin-form-alert" role="alert">
          {error}
        </p>
      )}
      <section className="admin-panel admin-ops-orders" aria-labelledby="admin-drivers-title">
        <div className="admin-panel-heading">
          <AdminSectionIcon name="drivers" />
          <div>
            <h2 id="admin-drivers-title">Daftar sopir</h2>
            <p>Sopir melihat tugasnya sendiri setelah masuk dengan akunnya.</p>
          </div>
        </div>
        {!drivers ? (
          !error && (
            <p className="admin-ops-placeholder" role="status">
              Memuat sopir…
            </p>
          )
        ) : drivers.length ? (
          <div className="admin-ops-table-wrap">
            <table className="admin-ops-table">
              <thead>
                <tr>
                  <th scope="col">Sopir</th>
                  <th scope="col">Email</th>
                  <th scope="col">Sedang dibawa</th>
                  {owner && <th scope="col">Tindakan</th>}
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver) => (
                  <tr key={driver.id}>
                    <td>{driver.name}</td>
                    <td>{driver.email}</td>
                    <td>{driver.activeDeliveries} pesanan</td>
                    {owner && (
                      <td>
                        <button
                          type="button"
                          className="admin-ops-action"
                          onClick={() => {
                            setDialogError('');
                            setRemoval(driver);
                          }}
                        >
                          Lepas
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-ops-placeholder">Belum ada sopir.</p>
        )}
      </section>
      {owner && (
        <section className="admin-panel admin-driver-add" aria-labelledby="admin-driver-add-title">
          <h2 id="admin-driver-add-title">Daftarkan sopir</h2>
          <p>
            Sopir memakai akun sendiri. Minta sopir mendaftar di website, setujui akunnya, lalu cari
            di sini.
          </p>
          <form onSubmit={search}>
            <label htmlFor="driver-search">Nama atau email akun</label>
            <div>
              <input
                id="driver-search"
                type="search"
                maxLength={200}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="submit" className="admin-secondary">
                Cari akun
              </button>
            </div>
          </form>
          {candidates &&
            (candidates.length ? (
              <ul>
                {candidates.map((account) => (
                  <li key={account.id}>
                    <span>
                      <strong>{account.name}</strong>
                      <small>{account.email}</small>
                    </span>
                    <button
                      type="button"
                      className="admin-primary"
                      onClick={() => {
                        setDialogError('');
                        setAppointment(account);
                      }}
                    >
                      Jadikan sopir
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Tidak ada akun yang bisa dijadikan sopir.</p>
            ))}
        </section>
      )}
      {appointment && (
        <ConfirmDialog
          title="Daftarkan akun sebagai sopir"
          confirmLabel="Daftarkan sopir"
          danger={false}
          busy={busy}
          error={dialogError}
          onClose={() => setAppointment(null)}
          onConfirm={() =>
            save(
              '/api/drivers/appoint',
              appointment.id,
              appointment.name + ' terdaftar sebagai sopir.',
              () => setAppointment(null),
            )
          }
        >
          <p>
            <strong>{appointment.name}</strong>
            <br />
            {appointment.email}
          </p>
          <p>Akun ini dapat melihat pesanan yang ditugaskan dan menandainya sudah sampai.</p>
        </ConfirmDialog>
      )}
      {removal && (
        <ConfirmDialog
          title="Lepas sopir?"
          confirmLabel="Lepas sopir"
          busy={busy}
          error={dialogError}
          onClose={() => setRemoval(null)}
          onConfirm={() =>
            save(
              '/api/drivers/remove',
              removal.id,
              removal.name + ' tidak lagi menjadi sopir.',
              () => setRemoval(null),
            )
          }
        >
          <p>
            <strong>{removal.name}</strong> tidak akan bisa ditugaskan lagi. Riwayat pengirimannya
            tetap tersimpan.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
