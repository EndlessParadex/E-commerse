import { useState } from 'react';
import useCompany from '../../state/useCompany';
import {
  appearanceAccents, appearanceBackgrounds, appearanceModes,
  appearanceTextSizes, defaultAppearance,
} from '../../state/appearanceModel';
import {
  appearancePresets, advancedCssVariables, normalizeHex, defaultAdvancedAppearance,
} from '../../state/appearanceAdvanced';
import { useAppearance } from '../../state/useAppearance';
import './AppearanceSettings.css';

function HexControl({ title, value, fallback, onSave, disabled = false }) {
  const [draft, setDraft] = useState(value || fallback);
  const valid = Boolean(normalizeHex(draft));
  return (
    <label className="appearance-hex-control">
      <span>{title}</span>
      <span className="appearance-hex-inputs">
        <input type="color" aria-label={'Pilih ' + title.toLowerCase()} value={value || fallback}
          disabled={disabled} onChange={(event) => {
            setDraft(event.target.value);
            onSave(event.target.value);
          }} />
        <input type="text" aria-label={title + ' (HEX)'} maxLength={7}
          value={draft} disabled={disabled} spellCheck="false"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (valid) onSave(draft);
            else setDraft(value || fallback);
          }} />
      </span>
      {!valid && !disabled && <small className="appearance-hex-hint">Gunakan #RRGGBB.</small>}
    </label>
  );
}

export default function AppearanceSettings() {
  const { profile } = useCompany();
  const {
    preferences, effectiveMode, update, reset, notice,
    advanced, updateAdvanced,
  } = useAppearance();
  const [panel, setPanel] = useState('simple');
  const overrides = advancedCssVariables(advanced, effectiveMode);
  const demoAccent = overrides['--color-action'] ||
    appearanceAccents.find((item) => item.id === preferences.accent)?.light || '#0369a1';
  const demoBackground = overrides['--color-background'] ||
    appearanceBackgrounds.find((item) => item.id === preferences.background)?.[effectiveMode] ||
    (effectiveMode === 'dark' ? '#0e1726' : '#f8fafc');
  const dark = effectiveMode === 'dark';
  const demoSurface = dark ? '#172438' : '#ffffff';
  const demoText = dark ? '#eef3fb' : '#17243b';
  const demoMuted = dark ? '#a4b5ca' : '#64748b';
  const setAdvanced = (patch) => updateAdvanced({ ...patch, preset: 'default' });
  const choosePreset = (item) => {
    update({ mode: item.mode, background: 'default', accent: 'blue' });
    updateAdvanced({
      preset: item.id, accentHex: item.accent, backgroundHex: item.background,
    });
  };
  const isDefault = Object.keys(defaultAppearance).every((key) =>
    preferences[key] === defaultAppearance[key]) &&
    Object.keys(defaultAdvancedAppearance).every((key) =>
      advanced[key] === defaultAdvancedAppearance[key]);
  return (
    <section className="appearance-settings appearance-studio" aria-labelledby="appearance-title">
      <div className="appearance-heading">
        <div>
          <span className="section-eyebrow">Sesuai selera Anda</span>
          <h2 id="appearance-title">Personalisasi {profile.shortName}</h2>
        </div>
        <span className="appearance-current">
          {effectiveMode === 'dark' ? 'Mode gelap aktif' : 'Mode terang aktif'}
        </span>
      </div>
      <p className="appearance-description">
        Pilih tema siap pakai atau sesuaikan warna, ukuran, font, tata letak, dan animasi.
        Pilihan diterapkan langsung dan disimpan untuk akun ini di perangkat Anda.
      </p>
      <div className="appearance-studio-tabs" role="group" aria-label="Mode kustomisasi">
        <button type="button" aria-pressed={panel === 'simple'}
          className={panel === 'simple' ? 'is-selected' : ''}
          onClick={() => setPanel('simple')}>Sederhana</button>
        <button type="button" aria-pressed={panel === 'advanced'}
          className={panel === 'advanced' ? 'is-selected' : ''}
          onClick={() => setPanel('advanced')}>Advanced</button>
      </div>
      <div className="appearance-studio-grid">
        <div className="appearance-studio-editor">
          <div className="appearance-studio-simple" hidden={panel !== 'simple'}>
            <h3>Tema siap pakai</h3>
            <p>Ubah tampilan website menggunakan palet yang sudah disiapkan.</p>
            <div className="appearance-preset-grid">
              {appearancePresets.map((item) => (
                <button type="button" key={item.id}
                  className={'appearance-preset' + (advanced.preset === item.id ? ' is-active' : '')}
                  aria-pressed={advanced.preset === item.id}
                  onClick={() => choosePreset(item)}>
                  <span className="appearance-preset-scene" aria-hidden="true"
                    style={{ background: item.background }}>
                    <span style={{ background: item.accent }} />
                    <span style={{ background: item.mode === 'dark' ? '#243047' : '#ffffff' }} />
                  </span>
                  <span>{item.name}</span>
                  {advanced.preset === item.id && <span className="appearance-preset-check">✓</span>}
                </button>
              ))}
            </div>
            <p className="appearance-studio-tip">Pilih Advanced jika ingin membuat warna dan tata letak sendiri.</p>
          </div>
          <div className="appearance-studio-advanced" hidden={panel !== 'advanced'}>
            <h3>Editor tema Advanced</h3>
            <p>Setelan di bawah mengikuti akun yang sedang masuk.</p>
            <div className="appearance-custom-colors">
              <HexControl key={'accent-' + advanced.accentHex} title="Warna aksen"
                value={advanced.accentHex} fallback="#0369a1"
                onSave={(value) => setAdvanced({ accentHex: value })}/>
              <HexControl key={'background-' + advanced.backgroundHex} title="Warna latar"
                value={advanced.backgroundHex} fallback={dark ? '#151e32' : '#eef6ff'}
                onSave={(value) => setAdvanced({ backgroundHex: value })}/>
            </div>
            <p className="appearance-field-help">
              Warna tombol dan latar disesuaikan otomatis untuk menjaga keterbacaan teks.
            </p>
            <div className="appearance-extra-controls">
              <label>Jenis huruf
                <select aria-label="Jenis huruf" value={advanced.font}
                  onChange={(event) => setAdvanced({ font: event.target.value })}>
                  <option value="modern">Modern Sans</option>
                  <option value="classic">Klasik Serif</option>
                  <option value="mono">Monospace</option>
                </select>
              </label>
              <label>Sudut kartu <output>{advanced.radius}px</output>
                <input type="range" min="0" max="28" step="2" value={advanced.radius}
                  aria-label="Sudut kartu"
                  onChange={(event) => setAdvanced({ radius: Number(event.target.value) })}/>
              </label>
              <label>Kepadatan tampilan
                <select aria-label="Kepadatan tampilan" value={advanced.density}
                  onChange={(event) => setAdvanced({ density: event.target.value })}>
                  <option value="compact">Ringkas</option>
                  <option value="comfortable">Nyaman</option>
                  <option value="spacious">Luas</option>
                </select>
              </label>
              <label className="appearance-motion-toggle">
                <input type="checkbox" checked={advanced.motion}
                  onChange={(event) => setAdvanced({ motion: event.target.checked })}/>
                Aktifkan animasi antarmuka
              </label>
            </div>
            <fieldset>
              <legend>Ukuran teks</legend>
              <div className="appearance-text-options">
                {appearanceTextSizes.map((size) => (
                  <label className="appearance-option" key={size.id}>
                    <input type="radio" name="appearance-text-size" value={size.id}
                      checked={preferences.textSize === size.id}
                      onChange={() => update({ textSize: size.id })}/>
                    <span className={'appearance-text-sample sample-' + size.id} aria-hidden="true">Aa</span>
                    <span className="appearance-option-copy">
                      <strong>{size.label}</strong><small>{size.description}</small>
                    </span>
                  </label>
                ))}
              </div>
              <p className="appearance-field-help">Berlaku untuk toko dan halaman admin.</p>
            </fieldset>
            <fieldset>
              <legend>Mode tampilan</legend>
              <div className="appearance-mode-options">
                {appearanceModes.map((item) => (
                  <label className="appearance-option" key={item.id}>
                    <input type="radio" name="appearance-mode" value={item.id}
                      checked={preferences.mode === item.id}
                      onChange={() => update({ mode: item.id })}/>
                    <span className="appearance-mode-icon" aria-hidden="true">{item.icon}</span>
                    <span className="appearance-option-copy">
                      <strong>{item.label}</strong><small>{item.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Warna latar bawaan</legend>
              <div className="appearance-background-options">
                {appearanceBackgrounds.map((item) => (
                  <label className="appearance-option appearance-background-option" key={item.id}>
                    <input type="radio" name="appearance-background" value={item.id}
                      checked={preferences.background === item.id}
                      onChange={() => {update({ background: item.id }); setAdvanced({ backgroundHex: '' });}}/>
                    <span className="appearance-swatch" style={{ backgroundColor: item[effectiveMode] }}
                      aria-hidden="true"><span/><span/></span>
                    <strong>{item.label}</strong>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Warna aksen bawaan</legend>
              <div className="appearance-accent-options">
                {appearanceAccents.map((item) => (
                  <label className="appearance-option appearance-accent-option" key={item.id}>
                    <input type="radio" name="appearance-accent" value={item.id}
                      checked={preferences.accent === item.id}
                      onChange={() => {update({ accent: item.id }); setAdvanced({ accentHex: '' });}}/>
                    <span className="appearance-accent-swatch" style={{ backgroundColor: item[effectiveMode] }}
                      aria-hidden="true"/>
                    <strong>{item.label}</strong>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </div>
        <div className="appearance-studio-preview-panel">
          <div className="appearance-studio-preview-heading">
            <h3>Live Preview</h3>
            <span>Contoh tampilan</span>
          </div>
          <section className="appearance-preview appearance-demo" aria-labelledby="appearance-preview-title"
            style={{
              background: demoBackground,
              '--appearance-demo-card': demoSurface,
              '--appearance-demo-text': demoText,
              '--appearance-demo-muted': demoMuted,
              '--appearance-demo-accent': demoAccent,
              '--appearance-demo-radius': advanced.radius + 'px',
              '--appearance-demo-gap': { compact: '9px', comfortable: '14px', spacious: '22px' }[advanced.density],
              fontFamily: advanced.font === 'classic' ? 'Georgia, serif'
                : advanced.font === 'mono' ? 'Consolas, monospace' : 'inherit',
            }}>
            <div className="appearance-demo-nav">
              <strong style={{ color: demoText }}>{profile.shortName}.</strong>
              <span aria-hidden="true">⌕　♧　●</span>
            </div>
            <div className="appearance-demo-banner">
              <span>SELAMAT DATANG</span>
              <h3 id="appearance-preview-title">Kebutuhan toko lebih mudah.</h3>
              <p>Jelajahi produk dan pilih sesuai kebutuhan.</p>
              <span className="appearance-demo-banner-link">Jelajahi produk →</span>
            </div>
            <div className="appearance-demo-section">
              <h4>Contoh kartu produk</h4>
              <div className="appearance-demo-products">
                {['Snack Kentang', 'Snack Cookies'].map((name) => (
                  <div className="appearance-demo-product" key={name}>
                    <div className="appearance-demo-product-image" aria-hidden="true">▣</div>
                    <strong>{name}</strong>
                    <small>Kemasan sesuai katalog</small>
                    <span className="appearance-demo-product-plus">+</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="appearance-demo-stock">
              <span className="appearance-preview-label">Pratinjau langsung</span>
              <p>Contoh hitungan kemasan, bukan stok asli.</p>
              <dl className="appearance-preview-stock">
                <div><dt>Dus</dt><dd>2</dd></div>
                <div><dt>Pack</dt><dd>3</dd></div>
                <div><dt>Satuan</dt><dd>9</dd></div>
              </dl>
              <span className="appearance-preview-action">Contoh tombol</span>
            </div>
          </section>
        </div>
      </div>
      <div className="appearance-footer">
        <p>Preferensi disimpan per akun pada browser ini, belum disinkronkan ke perangkat lain.
          Data produk, stok, pesanan, dan transaksi tidak berubah.</p>
        <button type="button" className="appearance-reset" disabled={isDefault} onClick={reset}>
          Kembali ke tampilan awal
        </button>
      </div>
      {notice && <p className="appearance-notice" role="status">{notice}</p>}
    </section>
  );
}
