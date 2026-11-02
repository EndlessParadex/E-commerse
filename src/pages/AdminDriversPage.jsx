import { useCallback, useEffect, useRef, useState } from 'react';
import { useDelivery } from '../state/useDelivery';
import { accountApi } from '../components/account/accountApi';
import AdminSectionIcon from '../components/admin/AdminSectionIcon';
import ConfirmDialog from '../components/shop/ConfirmDialog';

// The server pages this list, but a dropdown must offer every eligible account.
async function eligibleAccounts() {
  const users = [];
  for (let page = 1, pages = 1; page <= pages; page++) {
    const params = new URLSearchParams({ purpose: 'owner', page: String(page) });
    const payload = await accountApi('/api/b2b/accounts?' + params);
    users.push(...payload.users);
    pages = payload.pages;
  }
  return users;
}

export default function AdminDriversPage() {
  const { user } = useDelivery();
  const owner = user?.isOwner === true;
  const [drivers, setDrivers] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [candidates, setCandidates] = useState(null);
  const [selectedId, setSelectedId] = useState('');
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
  const loadCandidates = useCallback(
    () =>
      eligibleAccounts()
        .then(setCandidates)
        .catch((failure) => setError(failure.message)),
    [],
  );
  useEffect(() => {
    load();
    if (owner) loadCandidates();
  }, [load, loadCandidates, owner]);
  const save = async (path, userId, message, close) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await accountApi(path, { userId });
      close();
      setSelectedId('');
      setNotice(message);
      await Promise.all([load(), loadCandidates()]);
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
            Sopir memakai akun sendiri. Minta sopir mendaftar di website, setujui akunnya, lalu
            pilih di sini.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setDialogError('');
              setAppointment(candidates.find((account) => account.id === selectedId));
            }}
          >
            <label htmlFor="driver-account">Akun sopir</label>
            <div>
              <select
                id="driver-account"
                value={selectedId}
                disabled={!candidates?.length}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                <option value="">
                  {!candidates
                    ? 'Memuat akun…'
                    : candidates.length
                      ? 'Pilih akun'
                      : 'Tidak ada akun yang bisa dijadikan sopir'}
                </option>
                {(candidates || []).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.email}
                  </option>
                ))}
              </select>
              <button type="submit" className="admin-primary" disabled={!selectedId}>
                Jadikan sopir
              </button>
            </div>
          </form>
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
