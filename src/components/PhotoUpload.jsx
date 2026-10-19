import { useEffect, useRef, useState } from 'react';
import './PhotoUpload.css';

export default function PhotoUpload({
  id,
  value,
  onChange,
  disabled = false,
  onBusyChange,
  label = 'Unggah foto',
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const pending = useRef(false);
  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );

  const change = async (file, remove = false) => {
    if (pending.current || disabled || (!file && !remove)) return;
    setError('');
    if (
      file &&
      (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1048576)
    ) {
      setError('Pilih JPG, PNG, atau WebP, maksimal 1 MB.');
      return;
    }
    const current = ++request.current;
    pending.current = true;
    setBusy(true);
    onBusyChange?.(true);
    try {
      let src = '';
      if (file) {
        src = await new Promise((resolve, reject) => {
          const reader = new window.FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reader.onabort = () => reject(new Error('Foto tidak dapat dibaca.'));
          reader.readAsDataURL(file);
        });
        await new Promise((resolve, reject) => {
          const image = new window.Image();
          image.onload = resolve;
          image.onerror = () =>
            reject(new Error('Foto tidak dapat dibaca. Pilih file gambar lain.'));
          image.src = src;
        });
      }
      if (request.current === current) await onChange(src);
    } catch (failure) {
      if (request.current === current) setError(failure.message || 'Foto belum dapat disimpan.');
    } finally {
      if (request.current === current) {
        pending.current = false;
        setBusy(false);
        onBusyChange?.(false);
      }
    }
  };

  return (
    <div className="photo-upload" aria-busy={busy}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || busy}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
        aria-invalid={Boolean(error)}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          change(file);
        }}
      />
      <p id={`${id}-help`}>JPG, PNG, atau WebP. Maksimal 1 MB.</p>
      {value && (
        <button type="button" disabled={disabled || busy} onClick={() => change(null, true)}>
          Hapus foto
        </button>
      )}
      {busy && <p role="status">Memproses foto…</p>}
      {error && (
        <p className="photo-upload-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
