import { useEffect, useState } from 'react';
import AdminSectionIcon from '../components/admin/AdminSectionIcon';
import { accountApi } from '../components/account/accountApi';
import { useDelivery } from '../state/useDelivery';
import ConfirmDialog from '../components/shop/ConfirmDialog';
import './AdminAccountsPage.css';

export default function AdminApprovalsPage() {
  const { user } = useDelivery();
  const [status, setStatus] = useState('pending');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user?.role !== 'admin') return;
    let active = true;
    const params = new URLSearchParams({ status, q: query.trim(), page: String(page) });
    accountApi('/api/admin/approvals?' + params).then(value => {
      if (!active) return;
      if (value.page > value.pages) { setPage(value.pages); return; }
      setData(value);
      setError('');
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [user?.role, status, query, page, reload]);
  const open = (account, action) => {
    setTarget({ account, action });
    setReason(action === 'approve' ? 'Pendaftaran pelanggan telah diperiksa.' : '');
    setPassword('');
    setError('');
  };
  const confirm = async () => {
    if (busy || !target) return;
    if (reason.trim().length < 5 || reason.trim().length > 300 || !password) {
      setError('Isi alasan 5–300 karakter dan kata sandi akun pengelola.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await accountApi('/api/admin/approvals/' + encodeURIComponent(target.account.id), {
        action: target.action,
        revision: target.account.revision,
        reason: reason.trim(),
        currentPassword: password,
      });
      setTarget(null);
      setPassword('');
      setNotice(result.message);
      setReload(value => value + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  if (user?.role !== 'admin') return <section className="admin-panel accounts-page"><h2>Akses admin diperlukan.</h2></section>;
  return (
    <section className="admin-panel accounts-page">
      <div className="admin-panel-heading">
        <AdminSectionIcon name="accounts" />
        <div><h2>Persetujuan akun baru</h2><p>Hanya Admin atau Pemilik yang dapat menyetujui pendaftaran. Verifikasi email tetap diperlukan sebelum checkout.</p></div>
        <span className="admin-result-pill">{data?.total ?? '…'} pendaftaran</span>
      </div>
      <div className="accounts-content">
        <div className="accounts-filters accounts-filters--approvals">
          <div className="admin-field">
            <label htmlFor="approval-search">Cari nama atau email</label>
            <div className="accounts-filter-search">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" />
              </svg>
              <input id="approval-search" type="search" value={query} maxLength={200}
                placeholder="Cari nama atau email pendaftar"
                onChange={event => {setQuery(event.target.value);setPage(1);}} />
            </div>
          </div>
          <div className="admin-field"><label htmlFor="approval-status">Status persetujuan</label>
            <select id="approval-status" value={status} onChange={event => {setStatus(event.target.value);setPage(1);}}>
              <option value="pending">Menunggu persetujuan</option>
              <option value="rejected">Ditolak</option>
              <option value="all">Semua perlu ditinjau</option>
            </select>
          </div>
          <button className="admin-secondary accounts-approvals-refresh" type="button"
            onClick={() => setReload(value => value + 1)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 11a8 8 0 0 0-14.9-4M4 4v4h4M4 13a8 8 0 0 0 14.9 4M20 20v-4h-4" />
            </svg>
            Muat ulang
          </button>
        </div>
        {notice && <p className="accounts-notice" role="status">{notice}</p>}
        {error && !target && <p className="accounts-error" role="alert">{error}</p>}
        <div className="accounts-table-wrap"><table className="accounts-table">
          <caption className="accounts-screen-reader">Permintaan persetujuan pelanggan</caption>
          <thead><tr><th>Nama dan email</th><th>Status</th><th>Email</th><th>Tindakan</th></tr></thead>
          <tbody>
            {data?.users.map(account => (
              <tr key={account.id} data-approval-id={account.id}>
                <td data-label="Akun"><strong>{account.name}</strong><span className="accounts-secondary">{account.email}</span></td>
                <td data-label="Status"><span className="accounts-status is-disabled">{account.approvalStatus === 'pending' ? 'Menunggu persetujuan' : 'Ditolak'}</span></td>
                <td data-label="Email">{account.emailVerified ? 'Terkonfirmasi' : 'Belum dikonfirmasi'}</td>
                <td data-label="Tindakan"><div className="accounts-row-actions">
                  <button type="button" className="admin-secondary" disabled={busy} onClick={() => open(account, 'approve')}>Setujui</button>
                  {account.approvalStatus === 'pending' && <button type="button" className="admin-text-button accounts-delete" disabled={busy} onClick={() => open(account, 'reject')}>Tolak</button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {data && !data.users.length && <p className="accounts-empty">Tidak ada pendaftaran untuk status tersebut.</p>}
        {data && <nav className="accounts-pagination" aria-label="Halaman persetujuan">
          <button type="button" className="admin-secondary" disabled={page <= 1 || busy} onClick={() => setPage(value => value - 1)}>Sebelumnya</button>
          <span>Halaman {data.page} dari {data.pages}</span>
          <button type="button" className="admin-secondary" disabled={page >= data.pages || busy} onClick={() => setPage(value => value + 1)}>Berikutnya</button>
        </nav>}
      </div>
      {target && <ConfirmDialog title={target.action === 'approve' ? 'Setujui akun' : 'Tolak pendaftaran'} confirmLabel={target.action === 'approve' ? 'Setujui akun' : 'Tolak pendaftaran'} danger={target.action === 'reject'} busy={busy} error={error} onClose={() => {if(!busy){setTarget(null);setError('');}}} onConfirm={confirm}>
        <p><strong>{target.account.name}</strong><br />{target.account.email}</p>
        <div className="accounts-action-fields">
          <label htmlFor="approval-reason">Alasan (5–300 karakter)</label>
          <textarea id="approval-reason" rows={2} maxLength={300} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} />
          <label htmlFor="approval-password">Kata sandi Admin atau Pemilik</label>
          <input id="approval-password" type="password" autoComplete="current-password" maxLength={128} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
        </div>
      </ConfirmDialog>}
    </section>
  );
}
