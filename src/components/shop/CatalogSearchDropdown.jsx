import { useEffect, useId, useRef, useState } from 'react';
import './CatalogSearchDropdown.css';

/**
 * An accessible searchable list of existing catalog choices.
 * Filtering product results and URL routing remain owned by the parent catalog page.
 */
export default function CatalogSearchDropdown({
  label, value = '', options, onChange, placeholder = 'Cari pilihan...',
  searchable = true, showCounts = true, compact = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapper = useRef(null);
  const trigger = useRef(null);
  const input = useRef(null);
  const choices = useRef(null);
  const id = useId();
  const panelId = id + '-panel';
  const selected = options.find((item) => item.id === value) || options[0];
  const matches = options.filter((item) =>
    item.name.toLocaleLowerCase('id').includes(search.trim().toLocaleLowerCase('id')),
  );

  useEffect(() => {
    if (!open) return undefined;
    if (searchable) input.current?.focus();
    else choices.current?.querySelector('.catalog-search-option[aria-pressed="true"]')?.focus();
    const closeOnOutside = (event) => {
      if (!wrapper.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, searchable]);

  const choose = (item) => {
    setOpen(false);
    setSearch('');
    onChange(item.id);
  };
  const moveToOption = (direction) => {
    const available = choices.current?.querySelectorAll('.catalog-search-option');
    if (!available?.length) return;
    const active = Array.from(available).indexOf(document.activeElement);
    const next = active < 0
      ? direction === 1 ? 0 : available.length - 1
      : (active + direction + available.length) % available.length;
    available[next].focus();
  };

  return (
    <div className={'catalog-search-dropdown' + (open ? ' is-open' : '') +
      (compact ? ' is-compact' : '')} ref={wrapper}>
      <span className="catalog-search-label">{label}</span>
      <button type="button" ref={trigger}
        className="catalog-search-trigger"
        aria-label={label + ': ' + (selected?.name || 'Pilih')}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={panelId}
        onClick={() => {
          if (!open) setSearch('');
          setOpen((previous) => !previous);
        }}
        onKeyDown={(event) => {
          if (!open && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault();
            setSearch('');
            setOpen(true);
          }
        }}>
        <span className="catalog-search-current">
          <span className="catalog-search-symbol" aria-hidden="true">
            {selected?.icon || '▦'}
          </span>
          <span className="catalog-search-current-name">{selected?.name || 'Pilih'}</span>
        </span>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div id={panelId} className="catalog-search-panel"
          role="dialog" aria-label={'Pilih ' + label.toLowerCase()}>
          {searchable && (
            <label className="catalog-search-input-wrap">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/>
              </svg>
              <input ref={input} type="search" value={search} autoComplete="off"
                placeholder={placeholder} aria-label={'Cari ' + label.toLowerCase()}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    moveToOption(event.key === 'ArrowDown' ? 1 : -1);
                  }
                }}/>
            </label>
          )}
          <div className="catalog-search-options" ref={choices}
            role="group" aria-label={'Pilihan ' + label.toLowerCase()}>
            {matches.length ? matches.map((item) => (
              <button type="button" className="catalog-search-option" key={item.id || '__all'}
                aria-pressed={item.id === value}
                onClick={() => choose(item)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    moveToOption(event.key === 'ArrowDown' ? 1 : -1);
                  }
                }}>
                <span className="catalog-search-option-icon" aria-hidden="true">
                  {item.icon || '▦'}
                </span>
                <span className="catalog-search-option-content">
                  <span className="catalog-search-option-name">{item.name}</span>
                  {showCounts && <small>{item.count} produk</small>}
                </span>
                {item.id === value && <span className="catalog-search-check" aria-hidden="true">✓</span>}
              </button>
            )) : (
              <p className="catalog-search-empty" role="status">
                Tidak ada pilihan yang cocok dengan pencarian.
              </p>
            )}
          </div>
          {searchable && (
            <div className="catalog-search-footer">{matches.length} pilihan ditampilkan</div>
          )}
        </div>
      )}
    </div>
  );
}
