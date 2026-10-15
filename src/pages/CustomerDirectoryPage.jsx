import { useEffect, useState } from 'react';
import { useDelivery } from '../state/useDelivery';
import { accountApi } from '../components/account/accountApi';
import { customerRoles } from '../data/customerRoles';
import './CustomerDirectoryPage.css';

export default function CustomerDirectoryPage() {
  const { user, authLoading, authError } = useDelivery();
  const allowed = user?.canViewCustomers === true;
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [verification, setVerification] = useState('all');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState(null);
  const params = new URLSearchParams({
    q: search,
    status,
    verification,
    page: String(page),
  }).toString();
  const requestKey = JSON.stringify([user?.id, allowed, params, refresh]);
  const settled = result?.key === requestKey;
  const data = settled ? result.data : null;
  const error = settled ? result.error : '';
  const loading = allowed && !settled;
  useEffect(() => {
    if (!allowed) return;
    const reload = () => setRefresh((value) => value + 1);
    window.addEventListener('focus', reload);
    return () => window.removeEventListener('focus', reload);
  }, [allowed]);
  useEffect(() => {
    let current = true;
    if (allowed) {
      accountApi('/api/team/customers?' + params)
        .then((payload) => {
          if (!current) return;
          if (payload.page > payload.pages) {
            setPage(payload.pages);
            return;
          }
          setResult({ key: requestKey, data: payload, error: '' });
        })
        .catch((failure) => {
          if (current) setResult({ key: requestKey, data: null, error: failure.message });
        });
    }
    return () => {
      current = false;
    };
  }, [allowed, params, requestKey]);
  if (authLoading)
    return (
      <div className="customer-directory" role="status">
        Memeriksa akses…
      </div>
    );
  if (!allowed)
    return (
      <section className="customer-directory customer-access-message">
        <h1>
          {user ? 'Izin melihat daftar pembeli diperlukan' : 'Masuk untuk melihat daftar pembeli'}
        </h1>
        <p>
          {authError ||
            (user
              ? 'Pemilik toko dapat memberikan izin melalui Kelola akun → Atur akses.'
              : 'Gunakan akun yang sudah diberi izin oleh pemilik toko.')}
        </p>
        <a className="shop-primary" href={user ? '#/akun' : '#/login'}>
          {user ? 'Kembali ke akun' : 'Masuk'}
        </a>
      </section>
    );
  return (
    <section className="customer-directory">
      <header className="customer-directory-heading">
        <div>
          <p className="customer-directory-eyebrow">
            {user.isOwner ? 'Pemilik toko' : customerRoles[user.customerRole]} · Akses lihat
          </p>
          <h1>Daftar pembeli</h1>
          <p>Akun pembeli yang sudah terdaftar di toko, termasuk yang menunggu konfirmasi email.</p>
        </div>
        <a href={user.isOwner ? '#/admin/akun' : '#/akun'}>
          {user.isOwner ? 'Kelola akun →' : 'Kembali ke akun →'}
        </a>
      </header>
      <p className="customer-directory-note">
        Anda dapat melihat nama, email, tanggal daftar, dan status akun. Perubahan serta penghapusan
        akun dilakukan oleh Pemilik.
      </p>
      <div className="customer-directory-panel">
        <form
          className="customer-directory-filters"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(query.trim());
            setPage(1);
            setRefresh((value) => value + 1);
          }}
        >
          <div className="customer-directory-field customer-directory-search">
            <label htmlFor="customer-query">Cari nama atau email</label>
            <div>
              <input
                id="customer-query"
                type="search"
                maxLength={200}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nama atau email pembeli"
              />
              <button type="submit">Cari</button>
            </div>
          </div>
          <div className="customer-directory-field">
            <label htmlFor="customer-status">Status akun</label>
            <select
              id="customer-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Semua status</option>
              <option value="active">Aktif</option>
              <option value="disabled">Nonaktif</option>
            </select>
          </div>
          <div className="customer-directory-field">
            <label htmlFor="customer-verification">Konfirmasi email</label>
            <select
              id="customer-verification"
              value={verification}
              onChange={(event) => {
                setVerification(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Semua email</option>
              <option value="verified">Terkonfirmasi</option>
              <option value="unverified">Belum dikonfirmasi</option>
            </select>
          </div>
        </form>
        <div className="customer-directory-toolbar">
          <p>{data ? `${data.total} pembeli ditemukan` : 'Daftar pembeli'}</p>
          <button type="button" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>
            Muat ulang
          </button>
        </div>
        {loading && (
          <p className="customer-directory-message" role="status">
            Memuat daftar pembeli…
          </p>
        )}
        {error && (
          <p className="customer-directory-error" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && data && (
          <>
            {data.users.length ? (
              <div className="customer-directory-table-wrap">
                <table className="customer-directory-table">
                  <caption>Daftar akun pembeli</caption>
                  <thead>
                    <tr>
                      <th>Pembeli</th>
                      <th>Status akun</th>
                      <th>Email</th>
                      <th>Tanggal daftar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((account) => (
                      <tr key={account.id} data-customer-id={account.id}>
                        <td data-label="Pembeli">
                          <strong>{account.name}</strong>
                          <span>{account.email}</span>
                        </td>
                        <td data-label="Status akun">
                          <span
                            className={
                              'customer-account-status ' +
                              (account.active ? 'is-active' : 'is-disabled')
                            }
                          >
                            {account.active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td data-label="Email">
                          {account.emailVerified ? 'Terkonfirmasi' : 'Belum dikonfirmasi'}
                        </td>
                        <td data-label="Tanggal daftar">
                          {new Date(account.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="customer-directory-empty">
                <h2>Belum ada pembeli yang cocok</h2>
                <p>
                  Coba kata pencarian atau filter lain. Akun pembeli baru akan muncul setelah
                  mendaftar dan daftar dimuat ulang.
                </p>
              </div>
            )}
            <nav className="customer-directory-pagination" aria-label="Halaman daftar pembeli">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Sebelumnya
              </button>
              <span>
                Halaman {data.page} dari {data.pages}
              </span>
              <button
                type="button"
                disabled={page >= data.pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Berikutnya
              </button>
            </nav>
          </>
        )}
      </div>
    </section>
  );
}
