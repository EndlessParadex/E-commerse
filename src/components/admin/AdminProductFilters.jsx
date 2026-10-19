import { Children, useEffect, useId, useRef, useState } from 'react';

export default function AdminProductFilters({ children, activeCount = 0 }) {
  const anchorRef = useRef(null);
  const filtersRef = useRef(null);
  const [stuck, setStuck] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const optionsId = useId();
  const [search, ...options] = Children.toArray(children);

  useEffect(() => {
    const anchor = anchorRef.current;
    const filters = filtersRef.current;
    let frame = null;
    const update = () => {
      frame = null;
      const top = Number.parseFloat(window.getComputedStyle(filters).top) || 0;
      setStuck(
        window.getComputedStyle(filters).position === 'sticky' &&
          anchor.getBoundingClientRect().top < top &&
          Math.abs(filters.getBoundingClientRect().top - top) < 1,
      );
    };
    const schedule = () => {
      if (frame === null) frame = window.requestAnimationFrame(update);
    };
    const observer = window.ResizeObserver ? new window.ResizeObserver(schedule) : null;
    observer?.observe(filters);
    observer?.observe(anchor.parentElement);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div className="admin-filter-anchor" ref={anchorRef} aria-hidden="true" />
      <div className={'admin-filters' + (stuck ? ' is-stuck' : '')} ref={filtersRef}>
        {search}
        <button
          className="admin-filter-toggle"
          type="button"
          aria-expanded={expanded}
          aria-controls={optionsId}
          onClick={() => setExpanded((current) => !current)}
        >
          Filter{activeCount ? ` (${activeCount})` : ''}{' '}
          <span aria-hidden="true">{expanded ? '−' : '+'}</span>
        </button>
        <div className={'admin-filter-options' + (expanded ? ' is-open' : '')} id={optionsId}>
          {options}
        </div>
      </div>
    </>
  );
}
