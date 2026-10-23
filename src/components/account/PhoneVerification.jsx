import { useEffect, useRef, useState } from 'react';
import { useDelivery } from '../../state/useDelivery';
import useUnsavedChanges from '../../state/useUnsavedChanges';
import { accountApi } from './accountApi';
import ContactStatus from './ContactStatus';

export default function PhoneVerification({ disabled, draftChanged, onBusyChange }) {
  const { user, setUser } = useDelivery();
  const [data, setData] = useState(null),
    [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [time, setTime] = useState(() => Date.now());
  const active = useRef(true),
    pending = useRef(false),
    input = useRef(null);
  useUnsavedChanges(Boolean(code) && !user.phoneVerified, undefined, busy);
  const apply = (value) => {
    if (!active.current || typeof value.phoneRevision !== 'string') return;
    setData(value);
    setUser((current) =>
      current?.id === user.id && (current.phoneRevision || '') === (user.phoneRevision || '')
        ? {
            ...current,
            phone: value.phone,
            phoneRevision: value.phoneRevision,
            phoneVerified: value.phoneVerified === true,
            phoneVerifiedAt: value.phoneVerifiedAt ?? null,
          }
        : current,
    );
  };
  useEffect(() => {
    active.current = true;
    accountApi('/api/profile/phone/verification')
      .then((value) => {
        if (!active.current) return;
        setData(value);
        setUser((current) =>
          current?.id === user.id && (current.phoneRevision || '') === (user.phoneRevision || '')
            ? {
                ...current,
                phone: value.phone,
                phoneRevision: value.phoneRevision,
                phoneVerified: value.phoneVerified === true,
                phoneVerifiedAt: value.phoneVerifiedAt ?? null,
              }
            : current,
        );
      })
      .catch(() => {
        if (active.current) setError('Status nomor HP belum dapat dimuat. Coba Perbarui status.');
      });
    return () => {
      active.current = false;
      onBusyChange(false);
    };
  }, [user.id, user.phoneRevision, setUser, onBusyChange]);
  useEffect(() => {
    if (!data?.challenge) return;
    const timer = setInterval(() => setTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [data?.challenge]);
  const run = async (kind) => {
    if (pending.current || disabled) return;
    if (kind === 'confirm' && !/^\d{6}$/.test(code)) {
      setError('Masukkan kode 6 angka dari WhatsApp.');
      input.current?.focus();
      return;
    }
    pending.current = true;
    setBusy(true);
    onBusyChange(true);
    setError('');
    setMessage('');
    try {
      const value = await accountApi(
        '/api/profile/phone/verification' + (kind === 'refresh' ? '' : '/' + kind),
        kind === 'refresh'
          ? undefined
          : {
              phone: user.phone,
              ...(kind === 'confirm' ? { code, challengeId: data?.challenge?.id } : {}),
            },
      );
      if (!active.current) return;
      apply(value);
      setTime(Date.now());
      setMessage(value.message || 'Status nomor HP diperbarui.');
      if (kind === 'confirm' || kind === 'request') setCode('');
    } catch (e) {
      if (!active.current) return;
      setError(e.message);
      // Inspect an uncertain result; never repeat a send automatically.
      try {
        apply(await accountApi('/api/profile/phone/verification'));
      } catch {
        /* Keep existing state and error. */
      }
    } finally {
      pending.current = false;
      if (active.current) {
        setBusy(false);
        onBusyChange(false);
      }
    }
  };
  const challenge = data?.challenge,
    expired = challenge && challenge.expiresAt <= time,
    wait = challenge ? Math.max(0, Math.ceil((challenge.resendAt - time) / 1000)) : 0;
  return (
    <section className="account-phone-verification" aria-label="Konfirmasi nomor HP">
      {draftChanged ? (
        <p className="account-profile-help">Simpan perubahan nomor sebelum meminta konfirmasi.</p>
      ) : (
        <ContactStatus
          channel="Nomor HP"
          missing={!user.phone}
          verified={user.phoneVerified}
          at={user.phoneVerifiedAt}
        />
      )}
      {!user.phone && !draftChanged && (
        <p className="account-profile-help">Tambahkan dan simpan nomor HP terlebih dahulu.</p>
      )}
      {user.phone && !draftChanged && (
        <>
          <p className="account-profile-help">
            Konfirmasi membuktikan kode diterima pada saat itu, bukan jaminan nomor akan selalu
            aktif. Login dapat memakai email atau nomor HP dengan kata sandi.
          </p>
          {!user.phoneVerified && (
            <>
              {data?.ready === false && (
                <p className="account-profile-help">
                  Verifikasi WhatsApp belum diaktifkan. Pengelola perlu menyambungkan layanan
                  WhatsApp resmi.
                </p>
              )}
              <div className="contact-actions">
                <button
                  type="button"
                  className="account-page-secondary"
                  disabled={disabled || busy || !data?.ready || wait > 0}
                  onClick={() => run('request')}
                >
                  {wait > 0 ? `Kirim ulang (${wait} dtk)` : 'Kirim kode ke WhatsApp'}
                </button>
                <button
                  type="button"
                  className="account-page-secondary"
                  disabled={disabled || busy}
                  onClick={() => run('refresh')}
                >
                  Perbarui status nomor
                </button>
              </div>
              {challenge && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    run('confirm');
                  }}
                >
                  <div className="account-field">
                    <label htmlFor="phone-otp">Kode konfirmasi WhatsApp</label>
                    <input
                      id="phone-otp"
                      ref={input}
                      value={code}
                      onChange={(event) =>
                        setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      disabled={disabled || busy || expired || challenge.attemptsRemaining === 0}
                      aria-describedby="phone-otp-help"
                    />
                    <p id="phone-otp-help" className="account-profile-help">
                      {expired
                        ? 'Kode kedaluwarsa. Minta kode baru.'
                        : challenge.attemptsRemaining === 0
                          ? 'Batas percobaan tercapai. Minta kode baru.'
                          : `Kode berlaku 5 menit. Sisa percobaan: ${challenge.attemptsRemaining}.`}
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="shop-primary"
                    disabled={disabled || busy || expired || challenge.attemptsRemaining === 0}
                  >
                    Konfirmasi nomor HP
                  </button>
                </form>
              )}
            </>
          )}
        </>
      )}
      {message && (
        <p className="account-profile-help" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
