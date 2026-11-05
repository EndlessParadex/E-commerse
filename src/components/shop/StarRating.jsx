import './StarRating.css';

/** Read-only stars, e.g. "★★★★☆ 4,0". Screen readers hear "4 dari 5 bintang". */
export default function StarRating({ value, count, showValue = true, className = '' }) {
  const rounded = Math.round(value);
  const label =
    value.toLocaleString('id-ID', { maximumFractionDigits: 1 }) +
    ' dari 5 bintang' +
    (count ? ', ' + count + ' ulasan' : '');
  return (
    <span className={'star-rating ' + className} role="img" aria-label={label}>
      <span className="star-rating-stars" aria-hidden="true">
        {'★'.repeat(rounded)}
        <span className="star-rating-empty">{'★'.repeat(5 - rounded)}</span>
      </span>
      {showValue && (
        <span className="star-rating-value" aria-hidden="true">
          {value.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          {count ? ' (' + count + ')' : ''}
        </span>
      )}
    </span>
  );
}
