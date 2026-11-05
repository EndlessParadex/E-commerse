import { useEffect, useState } from 'react';
import { orderItemPresentation } from '../../data/orderItemPresentation';
import { fetchOrderReviews, saveOrderReview } from '../../state/reviewsApi';
import StarRating from './StarRating';
import './OrderReviews.css';

const COMMENT_LIMIT = 500;
const ratingWords = ['', 'Buruk', 'Kurang', 'Cukup', 'Baik', 'Sangat baik'];

function ReviewForm({ orderId, item, name, current, onSaved, onCancel }) {
  const [rating, setRating] = useState(current?.rating || 0);
  const [comment, setComment] = useState(current?.comment || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const groupName = 'review-rating-' + item.id;
  const submit = async (event) => {
    event.preventDefault();
    if (!rating) {
      setError('Pilih 1 sampai 5 bintang.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      onSaved(await saveOrderReview(orderId, { productId: item.id, rating, comment }));
    } catch (reason) {
      setError(reason.message);
      setSaving(false);
    }
  };
  return (
    <form className="order-review-form" onSubmit={submit} noValidate>
      <fieldset>
        <legend>Nilai untuk {name}</legend>
        <div className="order-review-stars">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className={value <= rating ? 'is-on' : ''}>
              <input
                type="radio"
                name={groupName}
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
              />
              <span aria-hidden="true">★</span>
              <span className="visually-hidden">
                {value} bintang, {ratingWords[value]}
              </span>
            </label>
          ))}
          <span className="order-review-word" aria-hidden="true">
            {ratingWords[rating] || 'Pilih bintang'}
          </span>
        </div>
      </fieldset>
      <label className="order-review-comment">
        <span>Komentar (opsional)</span>
        <textarea
          value={comment}
          maxLength={COMMENT_LIMIT}
          rows={3}
          placeholder="Contoh: kemasan rapi, rasa sesuai."
          onChange={(event) => setComment(event.target.value)}
        />
        <small>
          {comment.length}/{COMMENT_LIMIT}
        </small>
      </label>
      {error && (
        <p className="order-review-error" role="alert">
          {error}
        </p>
      )}
      <div className="order-review-actions">
        <button type="submit" className="shop-primary" disabled={saving}>
          {saving ? 'Menyimpan…' : 'Simpan ulasan'}
        </button>
        <button type="button" className="order-review-cancel" onClick={onCancel} disabled={saving}>
          Batal
        </button>
      </div>
    </form>
  );
}

/**
 * Lets the buyer rate each item of a completed order. Sales and Admin accounts
 * get a 403 from the server, so the section simply stays hidden for them.
 */
export default function OrderReviews({ order }) {
  const [state, setState] = useState({ loading: true });
  const [editing, setEditing] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    fetchOrderReviews(order.id)
      .then((data) => active && setState({ data }))
      .catch((error) => active && setState({ error }));
    return () => {
      active = false;
    };
  }, [order.id]);

  if (state.loading || state.error?.status === 403 || state.error?.status === 404) return null;
  if (state.error)
    return (
      <section className="confirmation-card order-reviews" aria-labelledby="order-reviews-title">
        <h2 id="order-reviews-title">Ulasan barang</h2>
        <p role="alert">{state.error.message}</p>
      </section>
    );
  const { data } = state;
  if (!data.canReview) return null;
  return (
    <section className="confirmation-card order-reviews" aria-labelledby="order-reviews-title">
      <h2 id="order-reviews-title">Ulasan barang</h2>
      <p className="order-reviews-intro">
        Bagaimana barang yang Anda terima? Ulasan membantu pembeli lain memilih produk.
      </p>
      {notice && (
        <p className="order-reviews-notice" role="status">
          {notice}
        </p>
      )}
      <ul className="order-reviews-list">
        {order.items.map((item) => {
          const display = orderItemPresentation(item);
          const name = [display.name, display.sizeLabel].filter(Boolean).join(' · ');
          const current = data.reviews[item.id];
          return (
            <li key={item.id}>
              <div className="order-reviews-row">
                <div>
                  <strong>{name}</strong>
                  {current ? (
                    <span className="order-reviews-current">
                      <StarRating value={current.rating} />
                      {current.hidden && (
                        <em className="order-reviews-hidden">Disembunyikan oleh Admin</em>
                      )}
                    </span>
                  ) : (
                    <span className="order-reviews-pending">Belum diulas</span>
                  )}
                  {current?.comment && editing !== item.id && (
                    <p className="order-reviews-comment">“{current.comment}”</p>
                  )}
                </div>
                {editing !== item.id && (
                  <button
                    type="button"
                    className={current ? 'order-reviews-edit' : 'shop-primary'}
                    onClick={() => {
                      setNotice('');
                      setEditing(item.id);
                    }}
                  >
                    {current ? 'Ubah ulasan' : 'Beri ulasan'}
                  </button>
                )}
              </div>
              {editing === item.id && (
                <ReviewForm
                  orderId={order.id}
                  item={item}
                  name={name}
                  current={current}
                  onCancel={() => setEditing('')}
                  onSaved={(next) => {
                    setState({ data: next });
                    setEditing('');
                    setNotice('Terima kasih, ulasan untuk ' + name + ' tersimpan.');
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
