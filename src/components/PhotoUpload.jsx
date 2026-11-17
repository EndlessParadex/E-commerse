import { useEffect, useRef, useState } from 'react';
import './PhotoUpload.css';
import PhotoCropDialog from './PhotoCropDialog';
import {
  MAX_PHOTO_UPLOAD_BYTES,
  SMALL_PHOTO_MAX_SIDE,
  SMALL_PHOTO_TARGET_LENGTH,
  cropPhoto,
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
  // { fit: 'cover' | 'contain', shape: 'square' | 'circle' } opens the cropper after choosing.
  crop = null,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cropping, setCropping] = useState('');
  const [cropError, setCropError] = useState('');
  const request = useRef(0);
  const pending = useRef(false);
  const input = useRef(null);
  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );

  const readFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new window.FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reader.onabort = () => reject(new Error('Foto tidak dapat dibaca.'));
      reader.readAsDataURL(file);
    });
  const imageOptions = {
    keepTransparency,
    ImageClass: window.Image,
    documentRef: window.document,
  };

  // `source` is a data URL, or '' to remove the photo. `area` is the cropper's choice.
  // Returns '' when saved, else the error message.
  const save = async (source, area = null) => {
    const current = ++request.current;
    pending.current = true;
    setBusy(true);
    onBusyChange?.(true);
    try {
      let src = '';
      if (source) {
        const framed = area
          ? await cropPhoto(source, area, { maxSide: SMALL_PHOTO_MAX_SIDE, ...imageOptions })
          : source;
        // Phone photos are resized to 512 px here so the saved data stays small.
        src = await shrinkPhoto(framed, {
          maxSide: SMALL_PHOTO_MAX_SIDE,
          targetLength: SMALL_PHOTO_TARGET_LENGTH,
          ...imageOptions,
        }).catch(() => {
          throw new Error('Foto tidak dapat dibaca. Pilih file gambar lain.');
        });
        if (!src)
          throw new Error(
            'Foto terlalu besar dan tidak dapat dikecilkan di browser ini. Kecilkan foto di bawah 1 MB lalu coba lagi.',
          );
      }
      if (request.current === current) await onChange(src);
      return '';
    } catch (failure) {
      const message = failure.message || 'Foto belum dapat disimpan.';
      if (request.current === current) setError(message);
      return message;
    } finally {
      if (request.current === current) {
        pending.current = false;
        setBusy(false);
        onBusyChange?.(false);
      }
    }
  };

  const change = async (file, remove = false) => {
    if (pending.current || disabled || (!file && !remove)) return;
    setError('');
    if (remove) {
      await save('');
      return;
    }
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > MAX_PHOTO_UPLOAD_BYTES
    ) {
      setError('Pilih JPG, PNG, atau WebP, maksimal 5 MB.');
      return;
    }
    let original;
    try {
      original = await readFile(file);
    } catch (failure) {
      setError(failure.message);
      return;
    }
    if (!crop) {
      await save(original);
      return;
    }
    setCropError('');
    setCropping(original);
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
      {busy && !cropping && <p role="status">Memproses foto…</p>}
      {cropping && (
        <PhotoCropDialog
          src={cropping}
          title={`Atur ${label.toLocaleLowerCase('id')}`}
          fit={crop.fit}
          shape={crop.shape}
          busy={busy}
          error={cropError}
          onCancel={() => setCropping('')}
          onApply={async (area) => {
            setCropError('');
            const failure = await save(cropping, area);
            if (failure) setCropError(failure);
            else {
              setError('');
              setCropping('');
            }
          }}
        />
      )}
      {error && (
        <p className="photo-upload-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
