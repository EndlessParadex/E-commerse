import useCompany from '../../state/useCompany';
import { appearanceAccents, appearanceBackgrounds, appearanceModes, appearanceTextSizes, defaultAppearance } from '../../state/appearanceModel';
import { useAppearance } from '../../state/useAppearance';
import './AppearanceSettings.css';

export default function AppearanceSettings() {
  const { profile } = useCompany();
  const { preferences, effectiveMode, update, reset, notice } = useAppearance();
  return <section className="appearance-settings" aria-labelledby="appearance-title">
    <div className="appearance-heading"><div><span className="section-eyebrow">Sesuai selera Anda</span><h2 id="appearance-title">Tampilan</h2></div><span className="appearance-current">{effectiveMode === 'dark' ? 'Mode gelap aktif' : 'Mode terang aktif'}</span></div>
    <p className="appearance-description">Atur kenyamanan tampilan {profile.shortName}. Pilihan diterapkan langsung dan disimpan untuk akun Anda di perangkat ini.</p>
    <fieldset><legend>Ukuran teks</legend><div className="appearance-text-options">{appearanceTextSizes.map((size) => <label className="appearance-option" key={size.id}>
      <input type="radio" name="appearance-text-size" value={size.id} checked={preferences.textSize === size.id} onChange={() => update({ textSize: size.id })} />
      <span className={'appearance-text-sample sample-' + size.id} aria-hidden="true">Aa</span><span className="appearance-option-copy"><strong>{size.label}</strong><small>{size.description}</small></span>
    </label>)}</div><p className="appearance-field-help">Berlaku untuk teks di toko dan halaman admin.</p></fieldset>
    <fieldset><legend>Mode tampilan</legend><div className="appearance-mode-options">{appearanceModes.map((mode) => <label className="appearance-option" key={mode.id}>
      <input type="radio" name="appearance-mode" value={mode.id} checked={preferences.mode === mode.id} onChange={() => update({ mode: mode.id })} />
      <span className="appearance-mode-icon" aria-hidden="true">{mode.icon}</span><span className="appearance-option-copy"><strong>{mode.label}</strong><small>{mode.description}</small></span>
    </label>)}</div></fieldset>
    <fieldset><legend>Warna latar</legend><div className="appearance-background-options">{appearanceBackgrounds.map((background) => <label className="appearance-option appearance-background-option" key={background.id}>
      <input type="radio" name="appearance-background" value={background.id} checked={preferences.background === background.id} onChange={() => update({ background: background.id })} />
      <span className="appearance-swatch" style={{ backgroundColor: background[effectiveMode] }} aria-hidden="true"><span /><span /></span><strong>{background.label}</strong>
    </label>)}</div></fieldset>
    <fieldset><legend>Warna aksen</legend><div className="appearance-accent-options">{appearanceAccents.map((accent) => <label className="appearance-option appearance-accent-option" key={accent.id}>
      <input type="radio" name="appearance-accent" value={accent.id} checked={preferences.accent === accent.id} onChange={() => update({ accent: accent.id })} />
      <span className="appearance-accent-swatch" style={{ backgroundColor: accent[effectiveMode] }} aria-hidden="true" /><strong>{accent.label}</strong>
    </label>)}</div><p className="appearance-field-help">Mengubah warna tombol, tautan, dan penanda pilihan.</p></fieldset>
    <section className="appearance-preview" aria-labelledby="appearance-preview-title"><span className="appearance-preview-label">Pratinjau langsung</span><h3 id="appearance-preview-title">Nyaman dibaca, mudah digunakan.</h3><p>Contoh teks mengikuti ukuran, warna, dan mode yang Anda pilih.</p><dl className="appearance-preview-stock"><div><dt>Dus</dt><dd>2</dd></div><div><dt>Pack</dt><dd>3</dd></div><div><dt>Satuan</dt><dd>9</dd></div></dl><span className="appearance-preview-action">Contoh tombol</span></section>
    <div className="appearance-footer"><p>Pilihan tersimpan untuk akun Anda di perangkat ini. Foto dan warna produk mengikuti katalog.</p><button type="button" className="appearance-reset" disabled={Object.keys(defaultAppearance).every((key) => preferences[key] === defaultAppearance[key])} onClick={reset}>Kembali ke tampilan awal</button></div>
    {notice && <p className="appearance-notice" role="status">{notice}</p>}
  </section>;
}
