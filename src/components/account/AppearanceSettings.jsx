import { appearanceBackgrounds, appearanceModes, defaultAppearance } from '../../state/appearanceModel';
import { useAppearance } from '../../state/useAppearance';
import './AppearanceSettings.css';

export default function AppearanceSettings() {
  const { preferences, effectiveMode, update, reset, notice } = useAppearance();
  return <section className="appearance-settings" aria-labelledby="appearance-title">
    <div className="appearance-heading"><div><span className="section-eyebrow">Sesuai selera Anda</span><h2 id="appearance-title">Tampilan</h2></div><span className="appearance-current">{effectiveMode === 'dark' ? 'Mode gelap aktif' : 'Mode terang aktif'}</span></div>
    <p className="appearance-description">Atur kenyamanan tampilan BAM. Pilihan diterapkan langsung dan disimpan untuk akun Anda di perangkat ini.</p>
    <fieldset><legend>Mode tampilan</legend><div className="appearance-mode-options">{appearanceModes.map((mode) => <label className="appearance-option" key={mode.id}>
      <input type="radio" name="appearance-mode" value={mode.id} checked={preferences.mode === mode.id} onChange={() => update({ mode: mode.id })} />
      <span className="appearance-mode-icon" aria-hidden="true">{mode.icon}</span><span className="appearance-option-copy"><strong>{mode.label}</strong><small>{mode.description}</small></span>
    </label>)}</div></fieldset>
    <fieldset><legend>Warna latar</legend><div className="appearance-background-options">{appearanceBackgrounds.map((background) => <label className="appearance-option appearance-background-option" key={background.id}>
      <input type="radio" name="appearance-background" value={background.id} checked={preferences.background === background.id} onChange={() => update({ background: background.id })} />
      <span className="appearance-swatch" style={{ backgroundColor: background[effectiveMode] }} aria-hidden="true"><span /><span /></span><strong>{background.label}</strong>
    </label>)}</div></fieldset>
    <div className="appearance-footer"><p>Warna produk tetap mengikuti katalog. Mode gelap menyesuaikan warna latar agar tetap nyaman dibaca.</p><button type="button" className="appearance-reset" disabled={preferences.mode === defaultAppearance.mode && preferences.background === defaultAppearance.background} onClick={reset}>Kembali ke tampilan awal</button></div>
    {notice && <p className="appearance-notice" role="status">{notice}</p>}
  </section>;
}
