import { useCallback, useEffect, useRef, useState } from 'react';
import { accountApi } from '../components/account/accountApi';
import './CommerceReadiness.css';

const deliveryLabels = {
  sent: 'Terkirim',
  queued: 'Menunggu kirim',
  sending: 'Sedang dikirim',
  configuration_required: 'Menunggu pengaturan',
  failed: 'Perlu diperiksa',
  skipped: 'Dilewati',
};
const skipReasons = {
  email_unverified: [
    'Email pembeli belum dikonfirmasi',
    'Minta pembeli membuka tautan konfirmasi email. Status pesanan tetap dapat dilihat di akun pembeli.',
  ],
  order_changed: [
    'Status pesanan sudah berubah',
    'Pemberitahuan lama dilewati agar pelanggan tidak menerima informasi yang sudah tidak berlaku.',
  ],
  too_old: [
    'Pemberitahuan sudah terlalu lama',
    'Email yang berumur lebih dari 7 hari dilewati. Periksa status terbaru di daftar pesanan.',
  ],
  recipient_inactive: [
    'Akun penerima dinonaktifkan',
    'Pemberitahuan untuk akun admin ini dihentikan. Pemilik dapat memeriksa aksesnya di Kelola akun.',
  ],
  recipient_role_changed: [
    'Akses penerima sudah berubah',
    'Akun ini sudah tidak memiliki akses admin untuk menerima pemberitahuan tersebut.',
  ],
  recipient_deleted: [
    'Akun penerima sudah dihapus',
    'Pemberitahuan yang masih menunggu untuk akun ini dihentikan.',
  ],
  recipient_missing: [
    'Akun penerima tidak ditemukan',
    'Periksa pesanan terkait sebelum menghubungi pelanggan melalui saluran lain.',
  ],
  order_missing: [
    'Pesanan tidak ditemukan',
    'Pemberitahuan tidak dikirim karena data pesanan terkait tidak tersedia.',
  ],
};
const unknownReason = [
  'Alasan belum tercatat',
  'Riwayat lama belum menyimpan alasan. Penyebabnya tidak bisa dipastikan dari status ini.',
];

export default function CommerceReadiness() {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const active = useRef(true),
    request = useRef({ sequence: 0 }),
    pending = useRef(false);
  const refresh = useCallback(async () => {
    const tracker = request.current;
    const sequence = ++tracker.sequence;
    try {
      const value = await accountApi('/api/admin/readiness');
      if (active.current && sequence === tracker.sequence) {
        setData(value);
        setError('');
      }
    } catch {
      if (active.current && sequence === tracker.sequence)
        setError('Status toko belum dapat dimuat. Coba muat ulang.');
    }
  }, []);
  useEffect(() => {
    const tracker = request.current;
    active.current = true;
    Promise.resolve().then(() => {
      if (active.current) refresh();
    });
    const timer = setInterval(() => {
      if (!pending.current) refresh();
    }, 30000);
    return () => {
      active.current = false;
      tracker.sequence++;
      clearInterval(timer);
    };
  }, [refresh]);
  const retry = async (id) => {
    if (pending.current) return;
    pending.current = true;
    request.current.sequence++;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await accountApi(
        '/api/admin/notifications/' + encodeURIComponent(id) + '/retry',
        {},
      );
      if (!active.current) return;
      setNotice(
        result.retried
          ? 'Permintaan kirim ulang sudah masuk antrean. Status akan diperbarui setelah diproses.'
          : 'Status pemberitahuan sudah berubah. Daftar diperbarui; pengiriman ulang tidak dijalankan.',
      );
      await refresh();
    } catch (e) {
      if (active.current) setError(e.message);
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };
  const delivery = (data?.delivery || []).filter((row) => row.count > 0);
  const skippedCount = delivery.find((row) => row.status === 'skipped')?.count || 0;
  const reasons = data?.skippedReasons?.length
    ? data.skippedReasons
    : [{ reason: '', count: skippedCount }];
  return (
    <section className="commerce-readiness" aria-label="Kesiapan transaksi toko">
      <div className="commerce-readiness-heading">
        <div>
          <h3>Kesiapan toko</h3>
          <p>Lihat yang sudah siap dan yang perlu ditangani.</p>
        </div>
        <button type="button" className="admin-text-button" disabled={busy} onClick={refresh}>
          Muat ulang status
        </button>
      </div>
      {error && (
        <p className="workflow-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="commerce-readiness-notice" role="status">
          {notice}
        </p>
      )}
      {!data ? (
        <p>Memeriksa layanan…</p>
      ) : (
        <>
          <div className="commerce-readiness-grid">
            <div className="commerce-readiness-card">
              <span className="commerce-readiness-label">Email toko</span>
              <h4>{data.emailReady ? 'Pengaturan tersimpan' : 'Perlu disiapkan'}</h4>
              <p>
                {data.emailReady
                  ? 'Kirim email uji untuk memastikan layanan dapat mengirim.'
                  : 'Pembeli dapat mendaftar. Email harus dikonfirmasi sebelum bisa memesan.'}
              </p>
              {data.canManageEmail ? (
                <a href="#/admin/email">Buka pengaturan email →</a>
              ) : (
                <p className="commerce-readiness-owner-note">
                  Minta Pemilik untuk{' '}
                  {data.emailReady ? 'menguji pengiriman email.' : 'menyiapkan layanan email.'}
                </p>
              )}
            </div>
            <div className="commerce-readiness-card">
              <span className="commerce-readiness-label">Transfer bank</span>
              <h4>{data.transferReady ? 'Rekening sudah diisi' : 'Rekening belum diisi'}</h4>
              <p>
                {data.transferReady
                  ? 'Pembeli mendapat rincian rekening setelah toko menyetujui pesanan.'
                  : 'Isi rekening toko agar pembeli dapat memilih transfer bank.'}
              </p>
              <a href="#/admin/perusahaan">
                {data.transferReady ? 'Lihat rekening toko' : 'Isi rekening toko'} →
              </a>
            </div>
            <div className="commerce-readiness-card">
              <span className="commerce-readiness-label">Pesanan baru</span>
              <h4>
                {data.pendingOrders > 0
                  ? data.pendingOrders + ' pesanan perlu diperiksa'
                  : 'Tidak ada permintaan baru'}
              </h4>
              <p>
                {data.pendingOrders > 0
                  ? 'Periksa stok dan tentukan ongkir sebelum menyetujui pesanan.'
                  : 'Pesanan yang sudah diproses tetap dapat dicari di daftar pesanan.'}
              </p>
              <a href="#/admin/pesanan">Buka daftar pesanan →</a>
            </div>
          </div>
          <div className="commerce-readiness-delivery">
            <div>
              <h4>Email pesanan</h4>
              <p>Angka berikut menghitung pemberitahuan email, bukan jumlah pesanan.</p>
            </div>
            {delivery.length ? (
              <ul className="commerce-delivery-counts" aria-label="Jumlah email menurut status">
                {delivery.map((row) => (
                  <li key={row.status} className={'delivery-count is-' + row.status}>
                    <strong>{row.count}</strong>
                    <span>{deliveryLabels[row.status] || 'Status lainnya'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="commerce-delivery-empty">Belum ada pemberitahuan pesanan.</p>
            )}
            {delivery.some((row) => row.status === 'sent') && (
              <p className="commerce-delivery-hint">
                Terkirim berarti diterima layanan email. Penerima mungkin perlu memeriksa folder
                spam.
              </p>
            )}
            {delivery.some((row) => row.status === 'configuration_required') && (
              <p className="commerce-delivery-hint">
                Pemberitahuan menunggu Pemilik melengkapi pengaturan email.
              </p>
            )}
            {skippedCount > 0 && (
              <details className="commerce-readiness-details">
                <summary>{skippedCount} pemberitahuan dilewati — lihat alasan</summary>
                <div className="commerce-readiness-details-body">
                  <p>
                    Email ini tidak dikirim ulang otomatis. Periksa daftar pesanan untuk melihat
                    status terbaru.
                  </p>
                  <ul className="commerce-skip-reasons">
                    {reasons.map((row) => {
                      const [title, help] = skipReasons[row.reason] || unknownReason;
                      return (
                        <li key={row.reason}>
                          <strong>
                            {row.count} · {title}
                          </strong>
                          <p>{help}</p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </details>
            )}
            {data.failedMessages?.length > 0 && (
              <details className="commerce-readiness-details">
                <summary>
                  {data.failedMessages.length} pemberitahuan perlu diperiksa
                  {data.failedMessages.length === 20 ? ' (20 terbaru)' : ''}
                </summary>
                <div className="commerce-readiness-details-body">
                  <p>
                    Jika masalah berulang, minta Pemilik memeriksa pengaturan dan mengirim email
                    uji.
                  </p>
                  {data.failedMessages.map((row) => (
                    <div className="commerce-delivery-failure" key={row.id}>
                      <div>
                        <strong>{row.order_id}</strong>
                        <p>
                          {row.status === 'queued'
                            ? 'Pengiriman akan dicoba lagi otomatis.'
                            : 'Percobaan otomatis sudah berhenti.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="admin-secondary"
                        disabled={busy || !row.canRetry}
                        onClick={() => retry(row.id)}
                      >
                        {row.canRetry ? 'Coba kirim ulang' : 'Sedang diproses'}
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
          {(data.accountDelivery?.queued > 0 || data.accountDelivery?.retrying > 0) && (
            <p className="commerce-account-delivery">
              <strong>Email akun: {data.accountDelivery.queued || 0} menunggu.</strong> Untuk
              konfirmasi email atau pemulihan kata sandi.
              {data.accountDelivery.retrying > 0 &&
                ' Sebagian pengiriman belum berhasil dan akan dicoba lagi. Minta Pemilik memeriksa layanan email jika terus tertunda.'}
            </p>
          )}
        </>
      )}
    </section>
  );
}
