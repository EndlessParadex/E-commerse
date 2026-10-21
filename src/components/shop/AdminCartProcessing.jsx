import { useEffect, useState } from 'react';
import { accountApi } from '../account/accountApi';
import ConfirmDialog from './ConfirmDialog';
import PackagingSummary from './PackagingSummary';
import { rupiah } from './shopPresentation';
import './AdminCartProcessing.css';

const statusLabel = { open: 'Terbuka', locked: 'Dikunci Admin', finalized: 'Sudah jadi pesanan' };
const dateLabel = (value) =>
  new Date(value + 'T00:00:00+07:00').toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });
const admin = (shared) => ['admin', 'owner'].includes(shared.role);
export function AdminCartQueue({ shared, onOpenCart }) {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);
  const key = JSON.stringify([
    search,
    status,
    page,
    attempt,
    shared.cart?.revision,
    shared.cart?.id,
  ]);
  useEffect(() => {
    let active = true;
    accountApi(
      '/api/admin/b2b/carts?' + new URLSearchParams({ q: search, status, page: String(page) }),
    ).then(
      (data) => {
        if (active) setResult({ key, data });
      },
      (error) => {
        if (active) setResult({ key, error: error.message });
      },
    );
    return () => {
      active = false;
    };
  }, [key, search, status, page]);
  const current = result?.key === key ? result : null;
  const frozen = shared.busy || shared.uncertain || shared.reading;
  return (
    <section className="admin-cart-queue" aria-labelledby="cart-queue-title">
      <div className="admin-cart-heading">
        <h2 id="cart-queue-title">Antrean keranjang toko</h2>
        <button
          type="button"
          className="bam-button-secondary"
          disabled={frozen}
          onClick={() => setAttempt((value) => value + 1)}
        >
          Muat antrean
        </button>
      </div>
      <div className="admin-cart-filters">
        <label htmlFor="cart-queue-query">
          Cari toko, kode, atau tanggal
          <input
            id="cart-queue-query"
            type="search"
            value={q}
            maxLength={200}
            onChange={(event) => setQ(event.target.value)}
          />
        </label>
        <label htmlFor="cart-queue-status">
          Status
          <select
            id="cart-queue-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="pending">Belum difinalisasi</option>
            <option value="open">Terbuka</option>
            <option value="locked">Dikunci Admin</option>
            <option value="finalized">Sudah jadi pesanan</option>
            <option value="all">Semua</option>
          </select>
        </label>
      </div>
      {!current && <p role="status">Memuat antrean…</p>}
      {current?.error && (
        <p className="shop-warning" role="alert">
          {current.error} Tekan Muat antrean untuk mencoba kembali.
        </p>
      )}
      {current?.data && (
        <>
          <p>{current.data.total} keranjang ditemukan</p>
          <ul className="admin-cart-queue-list">
            {current.data.carts.map((cart) => (
              <li key={cart.storeId + cart.date}>
                <div>
                  <strong>{cart.storeName}</strong>
                  <span>
                    {cart.storeCode} · {dateLabel(cart.date)}
                  </span>
                  <span>
                    {cart.itemCount} SKU · {statusLabel[cart.status]}
                  </span>
                </div>
                <button
                  type="button"
                  className="bam-button-secondary"
                  disabled={frozen}
                  onClick={() => (onOpenCart || shared.choose)({ storeId: cart.storeId, date: cart.date })}
                >
                  Periksa keranjang
                </button>
              </li>
            ))}
          </ul>
          {!current.data.total && <p>Belum ada keranjang yang sesuai pilihan ini.</p>}
          {current.data.pages > 1 && (
            <nav className="admin-cart-pagination" aria-label="Halaman antrean keranjang">
              <button
                type="button"
                className="bam-button-secondary"
                disabled={frozen || current.data.page <= 1}
                onClick={() => setPage(current.data.page - 1)}
              >
                Sebelumnya
              </button>
              <span>
                Halaman {current.data.page} dari {current.data.pages}
              </span>
              <button
                type="button"
                className="bam-button-secondary"
                disabled={frozen || current.data.page >= current.data.pages}
                onClick={() => setPage(current.data.page + 1)}
              >
                Berikutnya
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

export function AdminB2BBanks() {
  const [banks, setBanks] = useState(null);
  const [bank, setBank] = useState('BCA');
  const [account, setAccount] = useState('');
  const [holder, setHolder] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let alive = true;
    accountApi('/api/admin/b2b/banks').then(
      (value) => {
        if (!alive) return;
        setBanks(value.banks);
        const initial = value.banks.find((entry) => entry.bank === 'BCA');
        setAccount(initial?.account || '');
        setHolder(initial?.holder || '');
      },
      (failure) => { if (alive) setError(failure.message); },
    );
    return () => { alive = false; };
  }, []);
  const current = banks?.find((item) => item.bank === bank);
  const select = (value) => {
    const next = banks?.find((item) => item.bank === value);
    setBank(value);
    setAccount(next?.account || '');
    setHolder(next?.holder || '');
    setCurrentPassword('');
    setError('');
    setNotice('');
  };
  const save = async (event) => {
    event.preventDefault();
    if (busy || !current) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await accountApi('/api/admin/b2b/banks', {
        bank, account, holder, revision: current.revision, currentPassword,
      }, 15000, 'PUT');
      setBanks(result.banks);
      setCurrentPassword('');
      setNotice('Rekening resmi ' + bank + ' berhasil disimpan.');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="admin-cart-queue" aria-labelledby="b2b-bank-title">
      <h2 id="b2b-bank-title">Rekening transfer BAM</h2>
      <p>
        Hanya Pemilik BAM yang dapat menyimpan rekening resmi. Pembeli toko dan Sales hanya
        memilih metode pembayaran; Admin memeriksanya saat finalisasi.
      </p>
        <form className="shared-admin-add-fields" onSubmit={save}>
          <label htmlFor="b2b-bank-selector">Bank
            <select id="b2b-bank-selector" value={bank} onChange={(event) => select(event.target.value)}>
              <option value="BCA">BCA</option>
              <option value="BRI">BRI</option>
              <option value="Mandiri">Mandiri</option>
            </select>
          </label>
          <label htmlFor="b2b-bank-account">Nomor rekening
            <input id="b2b-bank-account" inputMode="numeric" required
              pattern="[0-9]{8,25}" minLength={8} maxLength={25}
              value={account} onChange={(event) => setAccount(event.target.value)} />
          </label>
          <label htmlFor="b2b-bank-holder">Nama pemilik rekening
            <input id="b2b-bank-holder" required maxLength={100}
              value={holder} onChange={(event) => setHolder(event.target.value)} />
          </label>
          <label htmlFor="b2b-bank-password">Kata sandi Pemilik BAM
            <input id="b2b-bank-password" type="password" autoComplete="current-password"
              required value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)} />
          </label>
          <button className="bam-button-secondary" disabled={busy || !current || !currentPassword}>
            {busy ? 'Menyimpan…' : 'Simpan rekening transfer'}
          </button>
        </form>
        {error && <p className="shop-warning" role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
    </section>
  );
}
export default function AdminCartProcessing({ shared }) {
  const cart = shared.cart;
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const frozen = shared.busy || shared.uncertain || shared.reading;
  useEffect(() => {
    if (dialog?.action !== 'finalize') return;
    let active = true;
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true);
    setError('');
    setReview(null);
    setAccepted(false);
    accountApi(
      '/api/admin/b2b/stores/' +
        encodeURIComponent(dialog.storeId) +
        '/cart/review?date=' +
        encodeURIComponent(dialog.date),
    ).then(
      (result) => {
        if (active) {
          setReview(result.review);
          setLoading(false);
        }
      },
      (failure) => {
        if (active) {
          setError(failure.message);
          setLoading(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [dialog, attempt]);
  const open = (action) => {
    shared.clearError();
    setError('');
    setAccepted(false);
    setReason('');
    setDialog({ action, storeId: cart.store.id, date: cart.date, revision: cart.revision });
  };
  const confirm = async () => {
    if (frozen || loading) return;
    if (dialog.action === 'finalize' && (!review?.ready || !accepted)) return;
    const success = await shared.adminAction(dialog.action, {
      revision: dialog.action === 'finalize' ? review.revision : dialog.revision,
      ...(dialog.action === 'unlock' ? { reason } : {}),
      ...(dialog.action === 'finalize' ? { reviewToken: review.token, accepted } : {}),
    });
    if (success) setDialog(null);
  };
  if (!admin(shared) || !cart) return null;
  return (
    <section className="admin-cart-processing" aria-labelledby="cart-processing-title">
      <h2 id="cart-processing-title">Pemrosesan Admin</h2>
      <p>
        Status: <strong>{statusLabel[cart.status]}</strong>
      </p>
      {cart.status === 'open' && (
        <>
          <p>
            Admin, Pemilik, pembeli, dan Sales berizin dapat mengubah keranjang selama terbuka.
            Kunci isi keranjang saat mulai memeriksa. Setelah dikunci, semua perubahan ditahan
            sampai Admin membuka kembali dengan alasan.
          </p>
          <button
            type="button"
            className="shop-primary"
            disabled={frozen || !cart.items.length}
            onClick={() => open('lock')}
          >
            Kunci untuk diperiksa
          </button>
        </>
      )}
      {cart.status === 'locked' && (
        <div className="admin-cart-actions">
          <button
            type="button"
            className="shop-primary"
            disabled={frozen}
            onClick={() => open('finalize')}
          >
            Periksa dan finalisasi
          </button>
          <button
            type="button"
            className="bam-button-secondary"
            disabled={frozen}
            onClick={() => open('unlock')}
          >
            Buka kembali untuk diperbaiki
          </button>
        </div>
      )}
      {cart.orderId && (
        <p className="shared-final-order">
          Pesanan telah dibuat.{' '}
          <a href={'#/pesanan/' + encodeURIComponent(cart.orderId)}>Lihat pesanan →</a>
        </p>
      )}
      {dialog && (
        <ConfirmDialog
          title={
            dialog.action === 'lock'
              ? 'Kunci keranjang toko?'
              : dialog.action === 'unlock'
                ? 'Buka kembali keranjang?'
                : 'Periksa dan finalisasi pesanan'
          }
          confirmLabel={
            dialog.action === 'lock'
              ? 'Kunci keranjang'
              : dialog.action === 'unlock'
                ? 'Buka kembali keranjang'
                : 'Finalisasi dan cadangkan stok'
          }
          danger={false}
          busy={shared.busy || loading}
          busyLabel={loading ? 'Memeriksa…' : 'Menyimpan…'}
          confirmDisabled={
            shared.uncertain || (dialog.action === 'finalize' && (!review?.ready || !accepted))
          }
          error={error || shared.error}
          onClose={() => {
            if (!shared.busy) setDialog(null);
          }}
          onConfirm={confirm}
        >
          <p>
            <strong>{cart.store.storeName}</strong> · {cart.store.storeCode}
            <br />
            Rencana pengiriman {dateLabel(dialog.date)}
          </p>
          {dialog.action === 'lock' && (
            <p>
              Keranjang versi {dialog.revision} akan dikunci untuk pemeriksaan. Penguncian belum
              mencadangkan stok dan belum membuat pesanan.
            </p>
          )}
          {dialog.action === 'unlock' && (
            <label className="admin-cart-reason" htmlFor="cart-unlock-reason">
              Alasan dibuka kembali
              <textarea
                id="cart-unlock-reason"
                rows={3}
                minLength={5}
                maxLength={200}
                value={reason}
                disabled={shared.busy}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          )}
          {dialog.action === 'finalize' && (
            <>
              {loading && <p role="status">Memeriksa katalog dan stok terbaru…</p>}
              <button
                type="button"
                className="bam-button-secondary"
                disabled={shared.busy || loading || shared.uncertain}
                onClick={() => {
                  shared.clearError();
                  setAttempt((value) => value + 1);
                }}
              >
                Muat pemeriksaan terbaru
              </button>
              {review && (
                <div className="admin-cart-review">
                  <ul>
                    {review.items.map((item) => {
                      const stock = review.stock.find((row) => row.key === item.stockKey);
                      return (
                        <li key={item.id}>
                          <strong>{item.current?.name || item.name}</strong>
                          <small>SKU: {item.id}</small>
                          {item.unavailable ? (
                            <p className="shop-warning">
                              SKU tidak tersedia. Buka kembali keranjang dan keluarkan barang ini.
                            </p>
                          ) : (
                            <>
                              <PackagingSummary
                                packaging={item.current.packaging}
                                quantity={item.quantity}
                              />
                              <p>
                                {item.quantity} × {rupiah(item.current.price)} ={' '}
                                <strong>{rupiah(item.total)}</strong>
                              </p>
                              {item.changed && (
                                <p className="shop-warning">
                                  Harga atau informasi berubah. Isian sebelumnya: {item.name},{' '}
                                  {rupiah(item.price)} per kemasan. Finalisasi menggunakan informasi
                                  terbaru di atas.
                                </p>
                              )}
                              <p className={stock?.sufficient ? '' : 'shop-warning'}>
                                Stok bersama ukuran ini: perlu{' '}
                                {stock?.required.toLocaleString('id-ID')} satuan, tersedia{' '}
                                {stock?.available.toLocaleString('id-ID')} satuan.
                              </p>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <p>
                    Pengiriman: <strong>Gratis</strong> · Pembayaran:{' '}
                    <strong>{review.payment?.label || 'Belum dipilih'}</strong>
                  </p>
                  {review.payment?.groupId === 'transfer' && (
                    <p className={review.destination ? '' : 'shop-warning'}>
                      {review.destination
                        ? `Rekening tujuan: ${review.destination.bank} · ${review.destination.account} · a.n. ${review.destination.holder}`
                        : 'Rekening bank pilihan belum dikonfigurasi oleh Pemilik BAM. Finalisasi belum tersedia.'}
                    </p>
                  )}
                  <p className="admin-cart-total">
                    Total akhir <strong>{rupiah(review.total)}</strong>
                  </p>
                  {!review.ready && (
                    <p className="shop-warning">
                      Pemeriksaan belum lulus. Perbaiki barang atau stok sebelum finalisasi.
                    </p>
                  )}
                  <label className="admin-cart-accept">
                    <input
                      type="checkbox"
                      checked={accepted}
                      disabled={!review.ready || frozen}
                      onChange={(event) => setAccepted(event.target.checked)}
                    />
                    Saya sudah memeriksa barang, harga terbaru dan stok. Pesanan akan diproses
                    dengan total di atas.
                  </label>
                </div>
              )}
              <p>
                Finalisasi membuat satu pesanan, mencadangkan stok, dan menutup perubahan keranjang
                periode ini.
              </p>
            </>
          )}
          {shared.uncertain && (
            <p>
              Tutup dialog ini lalu tekan Pastikan penyimpanan untuk memeriksa hasil permintaan yang
              sama.
            </p>
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}
