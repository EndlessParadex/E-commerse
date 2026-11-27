import { useEffect, useState } from 'react';
import { accountApi } from '../account/accountApi';

const PATH = '/api/admin/registration-settings';

/**
 * Manual or automatic approval of new registrations. The owner switches it; other admins
 * see which mode is on. Accounts that already exist are never changed by the switch.
 */
export default function RegistrationModeCard({ onChanged }) {
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ tone: '', text: '' });
  useEffect(() => {
    let live = true;
    accountApi(PATH)
      .then((value) => live && setSettings(value))
      .catch((error) => live && setMessage({ tone: 'error', text: error.message }));
    return () => {
      live = false;
    };
  }, []);
  const choose = async (autoApprove) => {
    if (!settings || busy || settings.autoApprove === autoApprove) return;
    setBusy(true);
    setMessage({ tone: '', text: '' });
    try {
      const saved = await accountApi(
        PATH,
        { autoApprove, revision: settings.revision },
        15000,
        'PUT',
      );
      setSettings(saved);
      setMessage({
        tone: 'ok',
        text: autoApprove
          ? 'Otomatis aktif. Pendaftar berikutnya langsung bisa masuk.'
          : 'Manual aktif. Pendaftar berikutnya menunggu persetujuan.',
      });
      onChanged?.();
    } catch (error) {
      setMessage({ tone: 'error', text: error.message });
    } finally {
      setBusy(false);
    }
  };
  const auto = settings?.autoApprove === true;
  const locked = !settings?.canEdit || busy;
  return (
    <section className="registration-mode" aria-labelledby="registration-mode-title">
      <div className="registration-mode-head">
        <h3 id="registration-mode-title">Cara menerima pendaftar baru</h3>
        <span className={'registration-mode-badge' + (auto ? ' is-auto' : '')}>
          {settings ? (auto ? 'Otomatis' : 'Manual') : '…'}
        </span>
      </div>
      <div className="registration-mode-options" role="radiogroup" aria-label="Cara persetujuan">
        <label className={'registration-mode-option' + (!auto ? ' is-selected' : '')}>
          <input
            type="radio"
            name="registration-mode"
            checked={Boolean(settings) && !auto}
            disabled={locked}
            onChange={() => choose(false)}
          />
          <span>
            <strong>Manual</strong>
            <small>Pendaftar baru menunggu Admin atau Pemilik menyetujui sebelum bisa masuk.</small>
          </span>
        </label>
        <label className={'registration-mode-option' + (auto ? ' is-selected' : '')}>
          <input
            type="radio"
            name="registration-mode"
            checked={auto}
            disabled={locked}
            onChange={() => choose(true)}
          />
          <span>
            <strong>Otomatis</strong>
            <small>
              Pendaftar baru langsung bisa masuk dan melihat harga. Pesanan COD tetap dicek di tab
              Cek COD sebelum dikirim.
            </small>
          </span>
        </label>
      </div>
      <p className="registration-mode-note">
        {settings && !settings.canEdit
          ? 'Hanya Pemilik yang dapat mengubah pilihan ini.'
          : 'Berlaku untuk pendaftar berikutnya. Akun yang sudah ada dan pendaftar yang sedang menunggu tidak berubah. Email pemberitahuan ke admin tetap dikirim.'}
      </p>
      {message.text && (
        <p
          className={'registration-mode-message' + (message.tone === 'error' ? ' is-error' : '')}
          role={message.tone === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
