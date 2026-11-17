import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './PhotoCropDialog.css';
import {
  FRAME,
  MAX_ZOOM,
  clampCrop,
  drawnSize,
  initialCrop,
  minZoom,
  panCrop,
  zoomCrop,
} from '../data/photoCrop';

const KEY_STEP = 20; // frame units per arrow key press
const KEY_ZOOM = 1.1;

/**
 * Square cropper: drag (mouse or finger) to move, slider / wheel / two-finger pinch / + and -
 * to zoom. `onApply(crop, size)` receives the crop in frame units and the photo's pixel size.
 * - fit "cover" starts filled (profile photos); "contain" starts with the whole photo (products).
 * - shape "circle" outlines where a round avatar will be cut.
 */
export default function PhotoCropDialog({
  src,
  title = 'Atur foto',
  fit = 'cover',
  shape = 'square',
  busy = false,
  error = '',
  onApply,
  onCancel,
}) {
  const dialogRef = useRef(null);
  const frameRef = useRef(null);
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const titleId = useId();
  const zoomId = useId();
  const [photo, setPhoto] = useState(null);
  const [crop, setCrop] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog.showModal && !dialog.open) dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => dialog.close?.();
  }, []);

  useEffect(() => {
    let active = true;
    const image = new window.Image();
    image.onload = () => {
      if (!active) return;
      const size = { width: image.naturalWidth || 1, height: image.naturalHeight || 1 };
      setPhoto(size);
      setCrop(initialCrop(size.width, size.height, fit));
    };
    image.onerror = () => active && setLoadError('Foto tidak dapat dibuka.');
    image.src = src;
    return () => {
      active = false;
    };
  }, [src, fit]);

  // Screen pixels → frame units, so the math works at any frame size.
  const toFrame = (value) => (value * FRAME) / (frameRef.current?.clientWidth || FRAME);
  const pointInFrame = (clientX, clientY) => {
    const box = frameRef.current.getBoundingClientRect();
    return { x: toFrame(clientX - box.left), y: toFrame(clientY - box.top) };
  };
  const update = (change) =>
    setCrop((current) => (current && photo ? change(current, photo.width, photo.height) : current));

  // React registers wheel listeners as passive; zooming must stop the page from scrolling.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !photo) return undefined;
    const wheel = (event) => {
      event.preventDefault();
      const focus = pointInFrame(event.clientX, event.clientY);
      const factor = Math.exp(-event.deltaY * 0.0015);
      setCrop((current) =>
        zoomCrop(current, current.zoom * factor, photo.width, photo.height, focus.x, focus.y),
      );
    };
    frame.addEventListener('wheel', wheel, { passive: false });
    return () => frame.removeEventListener('wheel', wheel);
  }, [photo]);

  const pointerDown = (event) => {
    if (busy || !crop) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinch.current = null;
  };
  const pointerMove = (event) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous || busy) return;
    const next = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, next);
    if (pointers.current.size === 1) {
      update((current, width, height) =>
        panCrop(current, toFrame(next.x - previous.x), toFrame(next.y - previous.y), width, height),
      );
      return;
    }
    // Two fingers: zoom by the change in distance, around the midpoint.
    const [a, b] = [...pointers.current.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const middle = pointInFrame((a.x + b.x) / 2, (a.y + b.y) / 2);
    if (pinch.current) {
      const factor = distance / pinch.current;
      update((current, width, height) =>
        zoomCrop(current, current.zoom * factor, width, height, middle.x, middle.y),
      );
    }
    pinch.current = distance || null;
  };
  const pointerUp = (event) => {
    pointers.current.delete(event.pointerId);
    pinch.current = null;
  };
  const keyDown = (event) => {
    const moves = {
      ArrowLeft: [KEY_STEP, 0],
      ArrowRight: [-KEY_STEP, 0],
      ArrowUp: [0, KEY_STEP],
      ArrowDown: [0, -KEY_STEP],
    };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      update((current, width, height) => panCrop(current, dx, dy, width, height));
    } else if (['+', '=', '-', '_'].includes(event.key)) {
      event.preventDefault();
      const factor = ['+', '='].includes(event.key) ? KEY_ZOOM : 1 / KEY_ZOOM;
      update((current, width, height) => zoomCrop(current, current.zoom * factor, width, height));
    }
  };

  const lowest = photo ? minZoom(photo.width, photo.height) : 1;
  const drawn = crop &&
    photo && {
      left: `${(crop.x / FRAME) * 100}%`,
      top: `${(crop.y / FRAME) * 100}%`,
      width: `${(drawnSize(photo.width, photo.height, crop.zoom).width / FRAME) * 100}%`,
    };

  // Rendered at page level: a modal inside a collapsed <details> section would stay hidden.
  return createPortal(
    <dialog
      ref={dialogRef}
      className="photo-crop-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="photo-crop-content">
        <h2 id={titleId}>{title}</h2>
        <p className="photo-crop-help">
          Geser foto untuk memilih bagian yang tampil. Perbesar dengan penggeser, roda mouse, atau
          dua jari.
        </p>
        <div
          ref={frameRef}
          className={`photo-crop-frame photo-crop-frame--${shape}`}
          tabIndex={0}
          role="group"
          aria-label="Area foto. Tombol panah untuk menggeser, plus dan minus untuk memperbesar."
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onKeyDown={keyDown}
        >
          {drawn && <img src={src} alt="" draggable={false} style={drawn} />}
          {!crop && !loadError && <span className="photo-crop-loading">Membuka foto…</span>}
          <span className="photo-crop-guide" aria-hidden="true" />
        </div>
        <div className="photo-crop-zoom">
          <label htmlFor={zoomId}>Perbesar</label>
          <input
            id={zoomId}
            type="range"
            min={lowest}
            max={MAX_ZOOM}
            step="0.01"
            value={crop?.zoom ?? 1}
            disabled={!crop || busy || lowest >= MAX_ZOOM}
            onChange={(event) =>
              update((current, width, height) =>
                zoomCrop(current, Number(event.target.value), width, height),
              )
            }
          />
        </div>
        {(loadError || error) && (
          <p className="photo-crop-error" role="alert">
            {loadError || error}
          </p>
        )}
        <div className="photo-crop-actions">
          <button
            type="button"
            className="bam-button-secondary"
            disabled={!crop || busy}
            onClick={() => photo && setCrop(initialCrop(photo.width, photo.height, fit))}
          >
            Atur ulang
          </button>
          <button type="button" className="bam-button-secondary" disabled={busy} onClick={onCancel}>
            Batal
          </button>
          <button
            type="button"
            className="shop-primary"
            disabled={!crop || busy}
            onClick={() => onApply(clampCrop(crop, photo.width, photo.height), photo)}
          >
            {busy ? 'Memproses…' : 'Pakai foto'}
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
