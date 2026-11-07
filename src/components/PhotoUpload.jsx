import { useEffect, useRef, useState } from 'react';
import './PhotoUpload.css';
import {
  MAX_PHOTO_UPLOAD_BYTES,
  SMALL_PHOTO_MAX_SIDE,
  SMALL_PHOTO_TARGET_LENGTH,
  shrinkPhoto,
} from '../data/photoCompression';

export default function PhotoUpload({
  id,
  value,
  onChange,
  disabled = false,
  onBusyChange,
  label = 'Unggah foto',
  // Logos keep a transparent background; profile photos become JPEG.
  keepTransparency = false,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const pending = useRef(false);
  const input = useRef(null);
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
      (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > MAX_PHOTO_UPLOAD_BYTES)
    ) {
      setError('Pilih JPG, PNG, atau WebP, maksimal 5 MB.');
      return;
    }
    const current = ++request.current;
    pending.current = true;
    setBusy(true);
    onBusyChange?.(true);
    try {
      let src = '';
      if (file) {
        const original = await new Promise((resolve, reject) => {
          const reader = new window.FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reader.onabort = () => reject(new Error('Foto tidak dapat dibaca.'));
          reader.readAsDataURL(file);
        });
        // Phone photos are resized to 512 px here so the saved data stays small.
        src = await shrinkPhoto(original, {
          maxSide: SMALL_PHOTO_MAX_SIDE,
          targetLength: SMALL_PHOTO_TARGET_LENGTH,
          keepTransparency,
          ImageClass: window.Image,
          documentRef: window.document,
        }).catch(() => {
          throw new Error('Foto tidak dapat dibaca. Pilih file gambar lain.');
        });
        if (!src)
          throw new Error(
            'Foto terlalu besar dan tidak dapat dikecilkan di browser ini. Kecilkan foto di bawah 1 MB lalu coba lagi.',
          );
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
        ref={input}
        className="photo-upload-input"
        tabIndex={-1}
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
      <button
        type="button"
        className="photo-upload-select"
        disabled={disabled || busy}
        aria-label={`${value ? 'Ganti' : 'Pilih'} ${label.toLocaleLowerCase('id')}`}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
        onClick={() => input.current?.click()}
      >
        {value ? 'Ganti foto' : 'Pilih foto'}
      </button>
      <p id={`${id}-help`}>JPG, PNG, atau WebP. Maksimal 5 MB; foto besar otomatis dikecilkan.</p>
      {value && (
        <button
          type="button"
          className="photo-upload-remove"
          disabled={disabled || busy}
          onClick={() => change(null, true)}
        >
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
