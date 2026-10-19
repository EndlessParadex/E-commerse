import { useEffect, useRef, useState } from 'react';

export default function AdminProductFilters({ children }) {
  const anchorRef = useRef(null);
  const filtersRef = useRef(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const anchor = anchorRef.current;
    const filters = filtersRef.current;
    let frame = null;
    const update = () => {
      frame = null;
      const top = Number.parseFloat(window.getComputedStyle(filters).top) || 0;
      setStuck(
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
        {children}
      </div>
    </>
  );
}
