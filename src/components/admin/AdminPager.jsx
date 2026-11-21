import { pageNumbers } from '../../data/adminProductGroups';

/** Numbered pagination with previous/next, the shown range, and a jump to any page. */
export default function AdminPager({ page, pages, total, pageSize, unit, label, onPage }) {
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="admin-pager" aria-label={label}>
      <p className="admin-pager-range" role="status">
        <strong>
          {from}–{to}
        </strong>{' '}
        dari {total} {unit}
      </p>
      <div className="admin-pager-pages">
        <button
          type="button"
          className="admin-pager-step"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Halaman sebelumnya"
        >
          ‹ <span>Sebelumnya</span>
        </button>
        {pageNumbers(page, pages).map((value, index) =>
          value === null ? (
            <span key={'gap-' + index} className="admin-pager-gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              type="button"
              key={value}
              className="admin-pager-number"
              aria-current={value === page ? 'page' : undefined}
              aria-label={`Halaman ${value}`}
              onClick={() => onPage(value)}
            >
              {value}
            </button>
          ),
        )}
        <button
          type="button"
          className="admin-pager-step"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Halaman berikutnya"
        >
          <span>Berikutnya</span> ›
        </button>
      </div>
      <p className="admin-pager-total">
        Halaman {page} dari {pages}
      </p>
    </nav>
  );
}
