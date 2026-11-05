import { useEffect, useState } from 'react';
import { workflowUsesServer } from '../../data/adminStore';
import { fetchProductReviews } from '../../state/reviewsApi';
import StarRating from './StarRating';

const reviewDate = (value) =>
  new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });

/** Average rating and the latest written reviews of one product (all its sizes). */
export default function ProductReviews({ groupId }) {
  const [state, setState] = useState({ loading: workflowUsesServer });
  useEffect(() => {
    if (!workflowUsesServer || !groupId) return undefined;
    let active = true;
    fetchProductReviews(groupId)
      .then((data) => active && setState({ data }))
      .catch(() => active && setState({ failed: true }));
    return () => {
      active = false;
    };
  }, [groupId]);
  const data = state.data;
  return (
    <section className="detail-reviews" id="detail-reviews" aria-labelledby="detail-reviews-title">
      <h2 id="detail-reviews-title">Penilaian dan ulasan</h2>
      {state.loading ? (
        <p role="status">Memuat ulasan…</p>
      ) : state.failed ? (
        <p role="alert">Ulasan belum dapat dimuat. Coba muat ulang halaman.</p>
      ) : data?.count ? (
        <>
          <p className="detail-review-score">
            <StarRating value={data.average} count={data.count} />
            <span>dari pembeli yang pesanannya sudah selesai</span>
          </p>
          <ul className="detail-review-list">
            {data.reviews.map((review) => (
              <li key={review.id}>
                <div className="detail-review-head">
                  <strong>{review.authorName}</strong>
                  <time dateTime={new Date(review.updatedAt).toISOString()}>
                    {reviewDate(review.updatedAt)}
                  </time>
                </div>
                <StarRating value={review.rating} showValue={false} />
                <span className="detail-review-variant">{review.productName}</span>
                {review.comment && <p>{review.comment}</p>}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>
          Belum ada ulasan untuk produk ini. Pembeli dapat memberi ulasan dari halaman Pesanan saya
          setelah pesanan selesai.
        </p>
      )}
    </section>
  );
}
