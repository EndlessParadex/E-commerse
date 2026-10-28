import { useEffect, useRef } from 'react';
import { catalogColor, catalogColors, productColorStyle } from '../../data/catalogColors';

/**
 * Native select options cannot reliably display icons or color swatches.
 * Use a compact, keyboard-accessible details picker with real color previews.
 */
export default function AdminColorPicker({ value, onChange, error }) {
  const picker = useRef(null);
  const selected = catalogColor(value);
  useEffect(() => {
    const dismissOutside = (event) => {
      if (picker.current?.open && !picker.current.contains(event.target))
        picker.current.open = false;
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, []);

  const choose = (id) => {
    onChange(id);
    if (picker.current) picker.current.open = false;
    picker.current?.querySelector('summary')?.focus();
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape' && picker.current?.open) {
      event.preventDefault();
      picker.current.open = false;
      picker.current.querySelector('summary')?.focus();
    }
  };

  return (
    <div className="admin-field admin-color-field">
      <span id="product-color-label" className="admin-color-label">
        Warna kartu *
      </span>
      <details ref={picker} className="admin-color-picker" onKeyDown={onKeyDown}>
        <summary
          id="product-color"
          aria-labelledby="product-color-label product-color-value"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'error-color' : undefined}
        >
          <span
            className="admin-color-swatch"
            style={productColorStyle(selected.id)}
            aria-hidden="true"
          />
          <span id="product-color-value">{selected.name}</span>
          <span className="admin-color-chevron" aria-hidden="true">
            ▾
          </span>
        </summary>
        <div className="admin-color-options" role="group" aria-label="Pilihan warna kartu">
          {catalogColors.map((color) => (
            <button
              key={color.id}
              type="button"
              data-color-id={color.id}
              className="admin-color-option"
              aria-pressed={value === color.id}
              onClick={() => choose(color.id)}
            >
              <span
                className="admin-color-swatch"
                style={productColorStyle(color.id)}
                aria-hidden="true"
              />
              <span className="admin-color-option-name">{color.name}</span>
              {value === color.id && (
                <span className="admin-color-selected" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      </details>
      {error && (
        <small id="error-color" className="admin-error">
          {error}
        </small>
      )}
    </div>
  );
}
