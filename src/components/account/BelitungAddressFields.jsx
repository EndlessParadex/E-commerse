import { useState } from 'react';
import {
  DISTRICTS,
  REGENCIES,
  STREET_MAX,
  composeAddress,
  districtsIn,
  findVillage,
  villageKind,
  villagesIn,
} from '../../data/belitungRegions.js';
import './BelitungAddressFields.css';

const regencyEntries = Object.entries(REGENCIES);
const districtLabel = (code) => DISTRICTS.find((district) => district.code === code)?.name || '';

/**
 * Address on Pulau Belitung: the street is typed, the desa/kelurahan is chosen from the official
 * list. Choosing a kecamatan first narrows the list; choosing a desa fills the kecamatan. Names
 * repeat across kecamatan (e.g. Dukong), so every option shows where it is.
 *
 * `classes` lets each form keep its own field, error and hint styles.
 */
export default function BelitungAddressFields({
  idPrefix,
  value,
  errors = {},
  onChange,
  disabled = false,
  classes = {},
  streetRef,
  villageRef,
}) {
  const village = findVillage(value.desa);
  const [filter, setFilter] = useState(() => village?.districtCode || '');
  const district = village?.districtCode || filter;
  const field = classes.field || 'address-area-field';
  const errorClass = classes.error || 'address-area-error';
  const hintClass = classes.hint || 'address-area-hint';
  const id = (name) => `${idPrefix}-${name}`;
  const described = (name, hint) =>
    [hint ? id(name + '-hint') : '', errors[name] ? id(name + '-error') : '']
      .filter(Boolean)
      .join(' ') || undefined;
  const choices = villagesIn(district);
  const grouped = !district;
  const preview = composeAddress(value.jalan, value.desa);
  const streetInput = (
    <input
      id={id('jalan')}
      ref={streetRef}
      name="jalan"
      type="text"
      autoComplete="address-line1"
      maxLength={STREET_MAX}
      value={value.jalan}
      disabled={disabled}
      placeholder="Contoh: Jl. Sudirman No. 12, RT 03/RW 01"
      onChange={(event) => onChange('jalan', event.target.value)}
      aria-invalid={Boolean(errors.jalan)}
      aria-describedby={described('jalan')}
      required
    />
  );

  return (
    <div className="address-area">
      <div className={field}>
        <label htmlFor={id('jalan')}>Nama jalan, nomor rumah, RT/RW</label>
        {classes.wrap ? (
          <div className={classes.wrap + (errors.jalan ? ' has-error' : '')}>{streetInput}</div>
        ) : (
          streetInput
        )}
        {errors.jalan && (
          <p className={errorClass} id={id('jalan-error')}>
            {errors.jalan}
          </p>
        )}
      </div>
      <div className="address-area-row">
        <div className={field}>
          <label htmlFor={id('kecamatan')}>Kecamatan</label>
          <select
            id={id('kecamatan')}
            name="kecamatan"
            value={district}
            disabled={disabled}
            aria-describedby={id('kecamatan-hint')}
            onChange={(event) => {
              const next = event.target.value;
              setFilter(next);
              if (village && village.districtCode !== next) onChange('desa', '');
            }}
          >
            <option value="">Semua kecamatan</option>
            {regencyEntries.map(([code, name]) => (
              <optgroup key={code} label={name}>
                {districtsIn(code).map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className={hintClass} id={id('kecamatan-hint')}>
            Opsional: mempersempit daftar kelurahan/desa.
          </p>
        </div>
        <div className={field}>
          <label htmlFor={id('desa')}>Kelurahan / desa</label>
          <select
            id={id('desa')}
            ref={villageRef}
            name="desa"
            value={village ? value.desa : ''}
            disabled={disabled}
            onChange={(event) => {
              const next = findVillage(event.target.value);
              if (next) setFilter(next.districtCode);
              onChange('desa', event.target.value);
            }}
            aria-invalid={Boolean(errors.desa)}
            aria-describedby={described('desa')}
            required
          >
            <option value="">Pilih kelurahan/desa</option>
            {grouped
              ? districtsIn().map((entry) => (
                  <optgroup
                    key={entry.code}
                    label={`Kec. ${entry.name} · ${REGENCIES[entry.code.slice(0, 5)]}`}
                  >
                    {villagesIn(entry.code).map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.name} ({villageKind(option.code)}, Kec. {entry.name})
                      </option>
                    ))}
                  </optgroup>
                ))
              : choices.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.name} ({villageKind(option.code)})
                  </option>
                ))}
          </select>
          {errors.desa && (
            <p className={errorClass} id={id('desa-error')}>
              {errors.desa}
            </p>
          )}
          <p className={'address-area-summary ' + hintClass} aria-live="polite">
            {village
              ? preview
                ? `Alamat tersimpan sebagai: ${preview}`
                : `Kec. ${districtLabel(village.districtCode)}, ${village.regency}, Kepulauan Bangka Belitung`
              : 'Pengiriman hanya untuk Pulau Belitung (Kab. Belitung dan Kab. Belitung Timur).'}
          </p>
        </div>
      </div>
    </div>
  );
}
