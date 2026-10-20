import { useEffect, useRef, useState } from 'react';
import { useDelivery } from '../state/useDelivery';
import useUnsavedChanges from '../state/useUnsavedChanges';
import { accountApi } from '../components/account/accountApi';
import ConfirmDialog from '../components/shop/ConfirmDialog';
import './AdminAccountsPage.css';
import { customerRoles } from '../data/customerRoles';
import ContactStatus from '../components/account/ContactStatus';

const roles = { owner: 'Pemilik toko', admin: 'Admin', user: 'Pembeli' };
const actions = {
  disable: 'Nonaktifkan akun',
  reactivate: 'Aktifkan kembali',
  delete: 'Hapus akun',
  'customer-access': 'Atur akses daftar pembeli',
};
export default function AdminAccountsPage() {
  const { user } = useDelivery(),
    owner = user?.isOwner === true;
  const [query, setQuery] = useState(''),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('all'),
    [role, setRole] = useState('all'),
    [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0),
    [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(''),
    [notice, setNotice] = useState(''),
    [target, setTarget] = useState(null),
    [reason, setReason] = useState(''),
    [currentPassword, setCurrentPassword] = useState(''),
    [confirmEmail, setConfirmEmail] = useState(''),
    [customerRole, setCustomerRole] = useState(''),
    [actionError, setActionError] = useState(''),
    [busy, setBusy] = useState(false);
  const pending = useRef(false),
    active = useRef(true);
  useUnsavedChanges(false, undefined, busy);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      const value = query.trim();
      if (value !== search) {
        setSearch(value);
        setPage(1);
        setLoading(true);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, search]);
  useEffect(() => {
    let current = true;
    if (owner) {
      const params = new URLSearchParams({ q: search, status, role, page: String(page) });
      accountApi('/api/admin/accounts?' + params)
        .then((value) => {
          if (!current) return;
          if (value.page > value.pages) {
            setPage(value.pages);
            return;
          }
          setData(value);
          setLoadError('');
        })
        .catch((error) => {
          if (current) setLoadError(error.message);
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }
    return () => {
      current = false;
    };
  }, [owner, search, status, role, page, refresh]);
  const reload = () => {
    setLoading(true);
    setRefresh((value) => value + 1);
  };
  const open = (account, action) => {
    setTarget({ account, action });
    setReason(
      action === 'customer-access' ? 'Mengatur akses tim untuk melihat daftar pembeli.' : '',
    );
    setCustomerRole(account.customerRole || '');
    setConfirmEmail('');
    setCurrentPassword('');
    setActionError('');
  };
  const close = () => {
    if (pending.current) return;
    setTarget(null);
    setCurrentPassword('');
    setActionError('');
  };
  const confirm = async () => {
    if (pending.current || !target) return;
    setActionError('');
    if (reason.trim().length < 5 || reason.trim().length > 300) {
      setActionError('Isi alasan sepanjang 5–300 karakter.');
      return;
    }
    if (!currentPassword) {
      setActionError('Masukkan kata sandi akun pemilik.');
      return;
    }
    if (
      target.action === 'delete' &&
      confirmEmail.trim().toLowerCase() !== target.account.email.toLowerCase()
    ) {
      setActionError('Ketik alamat email akun yang akan dihapus untuk mengonfirmasi.');
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const result = await accountApi(
        '/api/admin/accounts/' + encodeURIComponent(target.account.id),
        {
          action: target.action,
          revision: target.account.revision,
          reason: reason.trim(),
          currentPassword,
          confirmEmail,
          ...(target.action === 'customer-access' ? { customerRole } : {}),
        },
      );
      if (!active.current) return;
      setTarget(null);
      setNotice(result.message);
      reload();
    } catch (error) {
      if (active.current)
        setActionError(
          error.name === 'TimeoutError'
            ? 'Hasil belum dapat dikonfirmasi. Tutup dialog dan muat ulang daftar sebelum mengulangi.'
            : error.message,
        );
    } finally {
      pending.current = false;
      if (active.current) {
        setBusy(false);
        setCurrentPassword('');
      }
    }
  };
  if (!owner)
    return (
      <section className="admin-panel accounts-page">
        <div className="accounts-content">
          <h2>Kelola akun khusus pemilik toko</h2>
          <p>Gunakan akun pemilik toko untuk melihat dan mengelola akun pengguna.</p>
          <a href="#/admin">Kembali ke ringkasan</a>
        </div>
      </section>
    );
  return (
    <section className="admin-panel accounts-page">
      <div className="admin-panel-heading">
        <div>
          <h2>Kelola akun</h2>
          <p>Cari akun pengguna dan atur aksesnya ke toko.</p>
        </div>
        <span className="admin-result-pill">{data?.total ?? '…'} akun</span>
      </div>
      <div className="accounts-content">
        <p className="accounts-explanation">
          <strong>Aktif</strong> berarti akun bisa masuk setelah disetujui. Pendaftaran baru
          diperiksa Admin atau Pemilik pada menu Persetujuan akun. Pembeli perlu mengonfirmasi email
          sebelum memesan. Pengelolaan akun hanya oleh Pemilik. Status kontak terkonfirmasi
          membuktikan penerimaan tautan atau kode pada waktu konfirmasi, bukan jaminan kontak akan
          selalu aktif.
        </p>
        <div className="accounts-team-help">
          <details>
            <summary>Cara menambahkan Ketua, Wakil, atau staf</summary>
            <ol>
              <li>Minta rekan mendaftar dan mengonfirmasi emailnya.</li>
              <li>
                Cari namanya di bawah, lalu pilih <strong>Atur akses</strong>.
              </li>
              <li>Pilih peran dan simpan dengan kata sandi Pemilik.</li>
            </ol>
            <p>Izin ini hanya untuk melihat daftar pembeli.</p>
          </details>
          <a className="admin-secondary" href="#/pelanggan">
            Lihat daftar pembeli →
          </a>
        </div>
        <div className="accounts-filters">
          <div className="admin-field">
            <label htmlFor="accounts-search">Cari nama, email, atau nomor HP</label>
            <input
              id="accounts-search"
              type="search"
              maxLength={200}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nama, alamat email, atau nomor HP"
            />
          </div>
          <div className="admin-field">
            <label htmlFor="accounts-role">Peran</label>
            <select
              id="accounts-role"
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
                setLoading(true);
              }}
            >
              <option value="all">Semua peran</option>
              <option value="owner">Pemilik toko</option>
              <option value="admin">Admin</option>
              <option value="user">Pembeli</option>
              {Object.entries(customerRoles)
                .filter(([value]) => value)
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="accounts-status">Status akses</label>
            <select
              id="accounts-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
                setLoading(true);
              }}
            >
              <option value="all">Semua status</option>
              <option value="active">Aktif</option>
              <option value="disabled">Nonaktif</option>
              <option value="pending">Menunggu persetujuan</option>
              <option value="rejected">Ditolak</option>
            </select>
          </div>
        </div>
        <div className="accounts-list-toolbar">
          <p role="status">
            {loading
              ? 'Memuat daftar akun…'
              : data
                ? `${data.total} akun ditemukan`
                : 'Daftar akun belum tersedia.'}
          </p>
          <button
            className="admin-secondary"
            type="button"
            disabled={busy || loading}
            onClick={reload}
          >
            Muat ulang
          </button>
        </div>
        {loadError && (
          <p className="accounts-error" role="alert">
            {loadError}
          </p>
        )}
        {notice && (
          <p className="accounts-notice" role="status">
            {notice}
          </p>
        )}
        {data && (
          <>
            <div className="accounts-table-wrap">
              <table className="accounts-table">
                <caption className="accounts-screen-reader">Daftar akun pengguna toko</caption>
                <thead>
                  <tr>
                    <th>Akun</th>
                    <th>Peran</th>
                    <th>Status</th>
                    <th>Pesanan</th>
                    <th>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((account) => (
                    <tr key={account.id} data-account-id={account.id}>
                      <td data-label="Akun">
                        <strong>{account.name}</strong>
                        <span className="accounts-secondary">{account.email}</span>
                        {account.phone && (
                          <span className="accounts-secondary">{account.phone}</span>
                        )}
                        {account.phone && (
                          <a
                            className="accounts-secondary"
                            href={'https://wa.me/' + account.phone.replace(/\D/g, '')}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Buka WhatsApp ↗
                          </a>
                        )}
                      </td>
                      <td data-label="Peran">
                        <strong>
                          {account.role === 'owner'
                            ? roles.owner
                            : customerRoles[account.customerRole] && account.customerRole
                              ? customerRoles[account.customerRole]
                              : roles[account.role] || account.role}
                        </strong>
                        {account.customerRole && (
                          <span className="accounts-secondary">
                            {account.role === 'admin'
                              ? 'Admin + melihat daftar pembeli'
                              : 'Hanya melihat daftar pembeli'}
                          </span>
                        )}
                      </td>
                      <td data-label="Status">
                        <span
                          className={
                            'accounts-status ' + (account.active ? 'is-active' : 'is-disabled')
                          }
                        >
                          {account.approvalStatus === 'pending'
                            ? 'Menunggu persetujuan'
                            : account.approvalStatus === 'rejected'
                              ? 'Ditolak'
                              : account.active
                                ? 'Aktif'
                                : 'Nonaktif'}
                        </span>
                        <ContactStatus
                          channel="Email"
                          verified={account.emailVerified}
                          at={account.emailVerifiedAt}
                        />
                        <ContactStatus
                          channel="Nomor HP"
                          verified={account.phoneVerified}
                          at={account.phoneVerifiedAt}
                          missing={!account.phone}
                        />
                        {!account.active && (
                          <span className="accounts-secondary">Alasan: {account.reason}</span>
                        )}
                      </td>
                      <td data-label="Pesanan">{account.orderCount} pesanan</td>
                      <td data-label="Tindakan">
                        <div className="accounts-row-actions">
                          {account.canSetCustomerAccess &&
                            account.approvalStatus === 'approved' && (
                              <button
                                className="admin-secondary"
                                type="button"
                                disabled={busy || loading}
                                onClick={() => open(account, 'customer-access')}
                              >
                                Atur akses
                              </button>
                            )}
                          {account.canDisable && (
                            <button
                              className="admin-text-button"
                              type="button"
                              disabled={busy || loading}
                              onClick={() => open(account, 'disable')}
                            >
                              Nonaktifkan
                            </button>
                          )}
                          {account.canReactivate && (
                            <button
                              className="admin-text-button"
                              type="button"
                              disabled={busy || loading}
                              onClick={() => open(account, 'reactivate')}
                            >
                              Aktifkan kembali
                            </button>
                          )}
                          {account.canDelete && (
                            <button
                              className="admin-text-button accounts-delete"
                              type="button"
                              disabled={busy || loading || !account.canDelete}
                              title={account.deleteBlockedReason || undefined}
                              onClick={() => open(account, 'delete')}
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                        {account.deleteBlockedReason && (
                          <span className="accounts-secondary">
                            {account.protectedReason || account.deleteBlockedReason}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.users.length && (
              <div className="accounts-empty">
                <h3>Akun tidak ditemukan</h3>
                <p>Ubah kata pencarian atau filter untuk melihat akun lain.</p>
              </div>
            )}
            <nav className="accounts-pagination" aria-label="Halaman daftar akun">
              <button
                className="admin-secondary"
                type="button"
                disabled={busy || loading || page <= 1}
                onClick={() => {
                  setPage((value) => value - 1);
                  setLoading(true);
                }}
              >
                Sebelumnya
              </button>
              <span>
                Halaman {data.page} dari {data.pages}
              </span>
              <button
                className="admin-secondary"
                type="button"
                disabled={busy || loading || page >= data.pages}
                onClick={() => {
                  setPage((value) => value + 1);
                  setLoading(true);
                }}
              >
                Berikutnya
              </button>
            </nav>
          </>
        )}
      </div>
      {target && (
        <ConfirmDialog
          title={actions[target.action]}
          confirmLabel={actions[target.action]}
          danger={target.action === 'disable' || target.action === 'delete'}
          busy={busy}
          error={actionError}
          onClose={close}
          onConfirm={confirm}
        >
          <p>
            <strong>{target.account.name}</strong>
            <br />
            {target.account.email}
          </p>
          <p>
            {target.action === 'customer-access'
              ? 'Ketua, Wakil, dan staf dapat melihat daftar pembeli. Mereka menggunakan akun dan kata sandinya sendiri. Izin ini tidak memberi akses mengubah atau menghapus akun.'
              : target.action === 'delete'
                ? 'Akun ini akan dihapus permanen dan tidak dapat dipulihkan melalui website.'
                : target.action === 'disable'
                  ? 'Akses akun dihentikan dan sesi lama diakhiri. Pesanan serta stok tetap dikelola seperti sebelumnya.'
                  : 'Akun dapat masuk kembali. Sesi dan tautan pemulihan lama tetap tidak berlaku.'}
          </p>
          <div className="accounts-action-fields">
            {target.action === 'customer-access' && (
              <>
                <label htmlFor="account-customer-role">Peran untuk melihat daftar pembeli</label>
                <select
                  id="account-customer-role"
                  value={customerRole}
                  onChange={(event) => setCustomerRole(event.target.value)}
                  disabled={busy}
                  aria-describedby="account-customer-help"
                >
                  {Object.entries(customerRoles).map(([value, label]) => (
                    <option
                      key={value}
                      value={value}
                      disabled={
                        Boolean(value) && (!target.account.active || !target.account.emailVerified)
                      }
                    >
                      {label}
                    </option>
                  ))}
                </select>
                <p id="account-customer-help" className="accounts-secondary">
                  {target.account.active && target.account.emailVerified
                    ? 'Ketiga peran memiliki akses melihat yang sama. Pilih Tanpa akses untuk mencabut izin.'
                    : 'Akun harus aktif dan emailnya dikonfirmasi sebelum diberi izin. Izin yang sudah ada tetap dapat dicabut.'}
                </p>
              </>
            )}
            <label htmlFor="account-action-reason">Alasan</label>
            <textarea
              id="account-action-reason"
              rows={2}
              maxLength={300}
              minLength={5}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
            />
            {target.action === 'delete' && (
              <>
                <label htmlFor="account-confirm-email">Ketik email akun yang akan dihapus</label>
                <input
                  id="account-confirm-email"
                  type="email"
                  autoComplete="off"
                  value={confirmEmail}
                  onChange={(event) => setConfirmEmail(event.target.value)}
                  disabled={busy}
                />
              </>
            )}
            <label htmlFor="account-owner-password">Kata sandi akun pemilik</label>
            <input
              id="account-owner-password"
              type="password"
              autoComplete="current-password"
              maxLength={128}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={busy}
            />
          </div>
        </ConfirmDialog>
      )}
    </section>
  );
}
