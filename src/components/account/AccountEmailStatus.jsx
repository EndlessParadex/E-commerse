import { useEffect, useRef, useState } from 'react';
import { useDelivery } from '../../state/useDelivery';
import { accountApi } from './accountApi';
import ContactStatus from './ContactStatus';

export default function AccountEmailStatus() {
  const { user, setUser } = useDelivery();
  const [ready, setReady] = useState(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const active = useRef(true),
    pending = useRef(false);
  useEffect(() => {
    active.current = true;
    accountApi('/api/auth/features')
      .then((data) => {
        if (active.current) setReady(data.emailReady === true);
      })
      .catch(() => {
        if (active.current) setReady(false);
      });
    return () => {
      active.current = false;
    };
  }, []);
  const refresh = async () => {
    const data = await accountApi('/api/auth/me');
    if (!active.current || data.user?.id !== user.id || data.user.email !== user.email) return;
    setUser((current) =>
      current?.id === user.id && current.email === user.email
        ? {
            ...current,
            emailVerified: data.user.emailVerified === true,
            emailVerifiedAt: data.user.emailVerifiedAt ?? null,
          }
        : current,
    );
  };
  const run = async (send) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      if (send) {
        const data = await accountApi('/api/auth/verification/request', {});
        if (active.current) setMessage(data.message);
      } else {
        await refresh();
        if (active.current) setMessage('Status email diperbarui.');
      }
    } catch (e) {
      if (active.current) setError(e.message);
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };
  return (
    <div className="account-email-status">
      <ContactStatus channel="Email" verified={user.emailVerified} at={user.emailVerifiedAt} />
      <div className="contact-actions">
        {!user.emailVerified && (
          <button
            type="button"
            className="account-page-secondary"
            disabled={busy || ready !== true}
            onClick={() => run(true)}
          >
            {busy ? 'Memproses…' : 'Kirim konfirmasi email'}
          </button>
        )}
        <button
          type="button"
          className="account-page-secondary"
          disabled={busy}
          onClick={() => run(false)}
        >
          Perbarui status email
        </button>
      </div>
      {!user.emailVerified && ready === false && (
        <p className="account-profile-help">
          Layanan email belum tersedia. Hubungi pengelola toko.
        </p>
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
    </div>
  );
}
