import { useEffect, useState } from 'react';
import { fetchAdminReviews, setReviewHidden } from '../state/reviewsApi';
import { shortOrderNumber } from '../data/orderListPresentation';
import StarRating from '../components/shop/StarRating';
import './AdminReviewsPage.css';

const filters = [
  ['all', 'Semua'],
  ['visible', 'Tampil'],
  ['hidden', 'Disembunyikan'],
];
const dateLabel = (value) =>
  new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });

/** Admin can read every buyer review and hide or show it again. */
export default function AdminReviewsPage() {
  const [filter, setFilter] = useState('all');
  const [state, setState] = useState({});
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    fetchAdminReviews(filter)
      .then((data) => active && setState({ data, filter }))
      .catch((error) => active && setState({ error: error.message, filter }));
    return () => {
      active = false;
    };
  }, [filter, reload]);
  const toggle = async (review) => {
    setBusy(review.id);
    setMessage('');
    try {
      await setReviewHidden(review.id, !review.hidden);
      setMessage(
        review.hidden
          ? 'Ulasan dari ' + review.authorName + ' kembali ditampilkan.'
          : 'Ulasan dari ' + review.authorName + ' disembunyikan dari halaman produk.',
      );
      setReload((value) => value + 1);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  };
  // Keep showing the previous list while another filter loads.
  const data = state.data;
  return (
    <section className="admin-panel admin-reviews" aria-labelledby="admin-reviews-title">
      <div className="admin-panel-heading">
        <div>
          <h2 id="admin-reviews-title">Ulasan pembeli</h2>
          <p>
            Ulasan ditulis pembeli setelah pesanan selesai. Sembunyikan ulasan yang tidak pantas;
            ulasan tersembunyi tidak dihitung dalam nilai bintang produk.
          </p>
        </div>
        {data && (
          <span className="admin-result-pill">
            {data.total} ulasan · {data.hidden} disembunyikan
          </span>
        )}
      </div>
      <div className="admin-reviews-filters" role="group" aria-label="Filter ulasan">
        {filters.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            className={filter === id ? 'is-active' : ''}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {message && (
        <p className="admin-reviews-message" role="status">
          {message}
        </p>
      )}
      {state.error ? (
        <p className="admin-reviews-empty" role="alert">
          {state.error}
        </p>
      ) : !data ? (
        <p className="admin-reviews-empty" role="status">
          Memuat ulasan…
        </p>
      ) : data.reviews.length === 0 ? (
        <p className="admin-reviews-empty">
          {filter === 'hidden'
            ? 'Tidak ada ulasan yang disembunyikan.'
            : 'Belum ada ulasan dari pembeli.'}
        </p>
      ) : (
        <ul className="admin-reviews-list">
          {data.reviews.map((review) => (
            <li key={review.id} className={review.hidden ? 'is-hidden' : ''}>
              <div className="admin-reviews-main">
                <div className="admin-reviews-head">
                  <strong>{review.productName}</strong>
                  {review.hidden && <span className="admin-reviews-badge">Disembunyikan</span>}
                </div>
                <StarRating value={review.rating} showValue={false} />
                {review.comment ? (
                  <p>{review.comment}</p>
                ) : (
                  <p className="admin-reviews-nocomment">Tanpa komentar</p>
                )}
                <small>
                  {review.authorName} · {dateLabel(review.updatedAt)} · Pesanan{' '}
                  <span title={review.orderId}>{shortOrderNumber(review.orderId)}</span>
                </small>
              </div>
              <button
                type="button"
                className="admin-secondary"
                disabled={busy === review.id}
                onClick={() => toggle(review)}
              >
                {busy === review.id ? 'Menyimpan…' : review.hidden ? 'Tampilkan' : 'Sembunyikan'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
