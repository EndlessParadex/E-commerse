import { useEffect, useRef, useState } from 'react';
import AdminSectionIcon from '../components/admin/AdminSectionIcon';
import { accountApi } from '../components/account/accountApi';
import { useDelivery } from '../state/useDelivery';
import useUnsavedChanges from '../state/useUnsavedChanges';
import ConfirmDialog from '../components/shop/ConfirmDialog';
import './AdminAccountsPage.css';
import './AdminApprovalsPage.css';

const statuses = {
  pending: 'Menunggu persetujuan',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  any: 'Semua pendaftaran',
  all: 'Semua perlu ditinjau',
};
const dateLabel = (value) => {
  if (value == null || !Number.isFinite(new Date(value).getTime())) return 'Belum tercatat';
  return (
    new Date(value).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }) + ' WIB'
  );
};
function StatusBadge({ status }) {
  return (
    <span className={'accounts-status approval-status is-' + status}>
      {statuses[status] || 'Belum diketahui'}
    </span>
  );
}
function RegistrationDetails({ account, titleRef, onClose }) {
  return (
    <section
      id="approval-detail"
      className="approval-detail"
      aria-labelledby="approval-detail-title"
    >
      <header>
        <div>
          <p>Detail pendaftaran</p>
          <h3 id="approval-detail-title" tabIndex={-1} ref={titleRef}>
            {account.name}
          </h3>
        </div>
        <button className="admin-secondary" type="button" onClick={onClose}>
          Tutup detail
        </button>
      </header>
      <dl>
        <div>
          <dt>Email</dt>
          <dd>{account.email}</dd>
        </div>
        <div>
          <dt>Nomor HP</dt>
          <dd>
            {account.phone || 'Belum ditambahkan'}
            {account.phone && (
              <small>
                {account.phoneVerified ? 'Nomor terkonfirmasi' : 'Nomor belum dikonfirmasi'}
              </small>
            )}
          </dd>
        </div>
        <div className="approval-detail-wide">
          <dt>Alamat pendaftaran</dt>
          <dd>{account.address || 'Belum diisi'}</dd>
        </div>
        <div>
          <dt>Tanggal daftar</dt>
          <dd>{dateLabel(account.createdAt)}</dd>
        </div>
        <div>
          <dt>Persetujuan</dt>
          <dd>
            <StatusBadge status={account.approvalStatus} />
          </dd>
        </div>
        <div>
          <dt>Verifikasi email</dt>
          <dd>
            {account.emailVerified ? 'Terkonfirmasi' : 'Belum dikonfirmasi'}
            {account.emailVerifiedAt != null && <small>{dateLabel(account.emailVerifiedAt)}</small>}
          </dd>
        </div>
        <div>
          <dt>Keputusan terakhir</dt>
          <dd>
            {account.decidedAt == null
              ? account.approvalStatus === 'pending'
                ? 'Belum ada keputusan'
                : 'Rincian keputusan belum tercatat'
              : dateLabel(account.decidedAt)}
            {account.decidedByName && <small>Oleh {account.decidedByName}</small>}
          </dd>
        </div>
        {account.decisionReason && (
          <div className="approval-detail-wide">
            <dt>Alasan keputusan</dt>
            <dd>{account.decisionReason}</dd>
          </div>
        )}
      </dl>
      <p className="approval-detail-note">
        {account.approvalStatus === 'approved'
          ? 'Persetujuan telah selesai. Email tetap harus dikonfirmasi sebelum pelanggan memesan.'
          : 'Periksa identitas dan kontak sebelum memberi keputusan. Persetujuan tidak menggantikan verifikasi email.'}
      </p>
    </section>
  );
}
export default function AdminApprovalsPage() {
  const { user } = useDelivery();
  const [status, setStatus] = useState('pending');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [target, setTarget] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const pending = useRef(false),
    mounted = useRef(true),
    detailTitleRef = useRef(null),
    detailTriggerRef = useRef(null);
  const requestKey = JSON.stringify([user?.id, user?.role, status, query.trim(), page, reload]);
  const current = result?.key === requestKey;
  const data = current ? result.data : null;
  const loadError = current ? result.error : '';
  const loading = !current;
  useUnsavedChanges(
    Boolean(
      target &&
      (password ||
        reason !== (target.action === 'approve' ? 'Pendaftaran pelanggan telah diperiksa.' : '')),
    ),
    undefined,
    busy,
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (user?.role !== 'admin') return;
    let active = true;
    const params = new URLSearchParams({ status, q: query.trim(), page: String(page) });
    accountApi('/api/admin/approvals?' + params)
      .then((value) => {
        if (active) setResult({ key: requestKey, data: value, error: '' });
      })
      .catch((err) => {
        if (active) setResult({ key: requestKey, data: null, error: err.message });
      });
    return () => {
      active = false;
    };
  }, [requestKey, user?.role, status, query, page, reload]);
  useEffect(() => {
    if (detail) detailTitleRef.current?.focus();
  }, [detail]);
  const filter = (value) => {
    setStatus(value);
    setPage(1);
    setDetail(null);
    setNotice('');
  };
  const closeDetail = () => {
    setDetail(null);
    detailTriggerRef.current?.focus();
  };
  const refresh = () => {
    setDetail(null);
    setReload((value) => value + 1);
  };
  const open = (account, action) => {
    if (pending.current) return;
    setTarget({ account, action });
    setReason(action === 'approve' ? 'Pendaftaran pelanggan telah diperiksa.' : '');
    setPassword('');
    setActionError('');
    setConflict(false);
  };
  const close = () => {
    if (pending.current) return;
    setTarget(null);
    setPassword('');
    setReason('');
    setActionError('');
    setConflict(false);
  };
  const confirm = async () => {
    if (pending.current || !target || conflict) return;
    if (reason.trim().length < 5 || reason.trim().length > 300 || !password) {
      setActionError('Isi alasan 5–300 karakter dan kata sandi akun pengelola.');
      return;
    }
    pending.current = true;
    setBusy(true);
    setActionError('');
    try {
      const saved = await accountApi(
        '/api/admin/approvals/' + encodeURIComponent(target.account.id),
        {
          action: target.action,
          revision: target.account.revision,
          reason: reason.trim(),
          currentPassword: password,
        },
      );
      if (!mounted.current) return;
      setTarget(null);
      setPassword('');
      setReason('');
      setDetail(null);
      setNotice(saved.message);
      setReload((value) => value + 1);
    } catch (err) {
      if (!mounted.current) return;
      setActionError(err.message);
      if (err.status === 409) {
        setConflict(true);
        setPassword('');
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  if (user?.role !== 'admin')
    return (
      <section className="admin-panel accounts-page">
        <h2>Akses admin diperlukan.</h2>
      </section>
    );
  const summary = data?.summary;
  const shownPage = data?.page || page;
  const first = data?.total ? (shownPage - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(shownPage * data.pageSize, data.total) : 0;
  const emptyText = query.trim()
    ? 'Tidak ada pendaftaran yang cocok dengan pencarian Anda.'
    : status === 'pending'
      ? 'Tidak ada pendaftaran yang menunggu persetujuan.'
      : status === 'approved'
        ? 'Belum ada pendaftaran yang disetujui.'
        : status === 'rejected'
          ? 'Tidak ada pendaftaran yang ditolak.'
          : 'Belum ada pendaftaran pada daftar ini.';
  return (
    <section
      className="admin-panel accounts-page approvals-page"
      aria-labelledby="approval-heading"
    >
      <div className="admin-panel-heading">
        <AdminSectionIcon name="accounts" />
        <div>
          <h2 id="approval-heading">Persetujuan akun baru</h2>
          <p>Periksa data pendaftar, berikan keputusan, dan lihat hasil persetujuannya.</p>
        </div>
        <span className="admin-result-pill">{data ? data.total : '…'} hasil</span>
      </div>
      <div className="accounts-content">
        <div className="approval-summary" aria-label="Ringkasan status pendaftaran">
          {['pending', 'approved', 'rejected', 'any'].map((key) => (
            <button
              type="button"
              key={key}
              className={'approval-summary-card is-' + key}
              aria-pressed={status === key}
              disabled={busy || !summary}
              onClick={() => filter(key)}
            >
              <span>{statuses[key]}</span>
              <strong>{summary ? (key === 'any' ? summary.total : summary[key]) : '…'}</strong>
            </button>
          ))}
        </div>
        <p className="approval-summary-caption">
          {query.trim()
            ? 'Ringkasan status mengikuti pencarian Anda.'
            : 'Ringkasan seluruh pendaftaran pelanggan yang tercatat.'}
        </p>
        <div className="accounts-filters accounts-filters--approvals">
          <div className="admin-field">
            <label htmlFor="approval-search">Cari pendaftar</label>
            <div className="accounts-filter-search">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m16 16 4 4" />
              </svg>
              <input
                id="approval-search"
                type="search"
                value={query}
                maxLength={200}
                disabled={busy}
                placeholder="Nama, email, atau nomor HP"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                  setDetail(null);
                  setNotice('');
                }}
              />
            </div>
          </div>
          <div className="admin-field">
            <label htmlFor="approval-status">Status persetujuan</label>
            <div className="approval-status-select">
              <select
                id="approval-status"
                value={status}
                disabled={busy}
                onChange={(event) => filter(event.target.value)}
              >
                {['pending', 'approved', 'rejected', 'any', 'all'].map((key) => (
                  <option key={key} value={key}>
                    {statuses[key]}
                  </option>
                ))}
              </select>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>
          <button
            className="admin-secondary accounts-approvals-refresh"
            type="button"
            disabled={busy || loading}
            onClick={refresh}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 11a8 8 0 0 0-14.9-4M4 4v4h4M4 13a8 8 0 0 0 14.9 4M20 20v-4h-4" />
            </svg>
            {loading ? 'Memuat…' : 'Muat ulang'}
          </button>
        </div>
        <div className="approval-help">
          <strong>Persetujuan dan verifikasi email diperiksa terpisah.</strong>
          <p>
            Admin atau Pemilik memberi keputusan setelah memeriksa data. Pelanggan tetap perlu
            mengonfirmasi email sebelum memesan.
          </p>
        </div>
        {notice && (
          <p className="accounts-notice" role="status">
            {notice}
          </p>
        )}
        {loadError && (
          <div className="accounts-error" role="alert">
            <p>{loadError}</p>
            <button type="button" className="admin-secondary" onClick={refresh}>
              Coba muat ulang
            </button>
          </div>
        )}
        {detail && data && (
          <RegistrationDetails account={detail} titleRef={detailTitleRef} onClose={closeDetail} />
        )}
        {loading && (
          <p className="approval-loading" role="status">
            Memuat pendaftaran…
          </p>
        )}
        {data && (
          <p className="approval-results" role="status">
            Menampilkan {first}–{last} dari {data.total} pendaftaran · {statuses[status]}.
          </p>
        )}
        {data?.users.length > 0 && (
          <div className="accounts-table-wrap" aria-busy={loading}>
            <table className="accounts-table approvals-table">
              <caption className="accounts-screen-reader">
                Pendaftaran pelanggan · {statuses[status]}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Pendaftar</th>
                  <th scope="col">Kontak</th>
                  <th scope="col">Persetujuan</th>
                  <th scope="col">Verifikasi email</th>
                  <th scope="col">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((account) => (
                  <tr key={account.id} data-approval-id={account.id}>
                    <td data-label="Pendaftar">
                      <strong>{account.name}</strong>
                      <span className="accounts-secondary">{account.email}</span>
                      <span className="accounts-secondary">
                        Daftar{' '}
                        <time dateTime={account.createdAt}>{dateLabel(account.createdAt)}</time>
                      </span>
                    </td>
                    <td data-label="Kontak">
                      <span className="approval-phone">{account.phone || 'Belum ditambahkan'}</span>
                      {account.phone && (
                        <small className="accounts-secondary">
                          {account.phoneVerified ? 'Nomor terkonfirmasi' : 'Belum dikonfirmasi'}
                        </small>
                      )}
                    </td>
                    <td data-label="Persetujuan">
                      <StatusBadge status={account.approvalStatus} />
                      {account.decidedAt != null && (
                        <small className="accounts-secondary">{dateLabel(account.decidedAt)}</small>
                      )}
                    </td>
                    <td data-label="Verifikasi email">
                      <span
                        className={'approval-email ' + (account.emailVerified ? 'is-verified' : '')}
                      >
                        {account.emailVerified ? 'Terkonfirmasi' : 'Belum dikonfirmasi'}
                      </span>
                    </td>
                    <td data-label="Tindakan">
                      <div className="accounts-row-actions">
                        <button
                          type="button"
                          className="admin-secondary"
                          disabled={busy}
                          aria-expanded={detail?.id === account.id}
                          aria-controls={detail?.id === account.id ? 'approval-detail' : undefined}
                          onClick={(event) => {
                            detailTriggerRef.current = event.currentTarget;
                            if (detail?.id === account.id) closeDetail();
                            else setDetail(account);
                          }}
                        >
                          Lihat detail
                        </button>
                        {account.canApprove && (
                          <button
                            type="button"
                            className="admin-primary"
                            disabled={busy}
                            onClick={() => open(account, 'approve')}
                          >
                            Setujui
                          </button>
                        )}
                        {account.canReject && (
                          <button
                            type="button"
                            className="admin-text-button accounts-delete"
                            disabled={busy}
                            onClick={() => open(account, 'reject')}
                          >
                            Tolak
                          </button>
                        )}
                        {account.approvalStatus === 'approved' && (
                          <span className="approval-action-note">Persetujuan selesai</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && !data.users.length && (
          <div className="approval-empty">
            <AdminSectionIcon name="accounts" />
            <h3>{emptyText}</h3>
            <p>
              {query.trim()
                ? 'Coba nama, email, atau nomor HP lain; atau hapus pencarian.'
                : status === 'pending'
                  ? 'Pendaftaran baru akan muncul di sini. Pendaftar yang sudah diputuskan dapat dilihat melalui filter status.'
                  : 'Daftar ini hanya mencakup pendaftaran pelanggan. Akun lama yang sudah aktif tetap tersedia pada pengelolaan akun.'}
            </p>
            {(query.trim() || status !== 'any') && (
              <button
                type="button"
                className="admin-secondary"
                onClick={() => {
                  setQuery('');
                  filter('any');
                }}
              >
                Lihat semua pendaftaran
              </button>
            )}
          </div>
        )}
        {data && data.total > 0 && (
          <nav className="accounts-pagination" aria-label="Halaman persetujuan">
            <button
              type="button"
              className="admin-secondary"
              disabled={shownPage <= 1 || busy}
              onClick={() => {
                setPage(shownPage - 1);
                setDetail(null);
              }}
            >
              Sebelumnya
            </button>
            <span>
              Halaman {data.page} dari {data.pages}
            </span>
            <button
              type="button"
              className="admin-secondary"
              disabled={shownPage >= data.pages || busy}
              onClick={() => {
                setPage(shownPage + 1);
                setDetail(null);
              }}
            >
              Berikutnya
            </button>
          </nav>
        )}
        {user.isOwner && (
          <p className="approval-owner-link">
            Untuk mengelola akses akun yang sudah aktif, buka{' '}
            <a href="#/admin/akun">Kelola akun →</a>
          </p>
        )}
      </div>
      {target && (
        <ConfirmDialog
          title={target.action === 'approve' ? 'Setujui akun' : 'Tolak pendaftaran'}
          confirmLabel={target.action === 'approve' ? 'Setujui akun' : 'Tolak pendaftaran'}
          danger={target.action === 'reject'}
          busy={busy}
          error={actionError}
          onClose={close}
          onConfirm={confirm}
          confirmDisabled={conflict || reason.trim().length < 5 || !password}
        >
          <p>
            <strong>{target.account.name}</strong>
            <br />
            {target.account.email}
          </p>
          <StatusBadge status={target.account.approvalStatus} />
          <p className="approval-confirm-help">
            {target.action === 'approve'
              ? 'Pelanggan dapat masuk setelah disetujui. Verifikasi email tetap diperlukan sebelum memesan.'
              : 'Pendaftaran tetap tercatat. Pelanggan tidak dapat masuk selama status ditolak.'}
          </p>
          {conflict ? (
            <button
              type="button"
              className="admin-secondary"
              onClick={() => {
                close();
                refresh();
              }}
            >
              Tutup dan muat daftar terbaru
            </button>
          ) : (
            <div className="accounts-action-fields">
              <label htmlFor="approval-reason">Alasan (5–300 karakter)</label>
              <textarea
                id="approval-reason"
                rows={3}
                maxLength={300}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={busy}
              />
              <label htmlFor="approval-password">Kata sandi Admin atau Pemilik</label>
              <input
                id="approval-password"
                type="password"
                autoComplete="current-password"
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
            </div>
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}
