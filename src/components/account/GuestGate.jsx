import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import Home from '../../pages/Home';
import useCompany from '../../state/useCompany';
import { useDelivery } from '../../state/useDelivery';
import { workflowUsesServer } from '../../data/adminStore';
import { RETURN_KEY, guestAllowed } from './guestAccess';
import './GuestGate.css';

/**
 * Visitors see the home page (without prices). Opening anything else shows the home page with
 * a sign-in / sign-up prompt they can close. Prices are withheld by the server, so this is
 * guidance, not the protection itself.
 */
export default function GuestGate({ route, children }) {
  const { user, authLoading } = useDelivery();
  const signedIn = Boolean(user);

  // The browser-only preview has no accounts to sign in to, so it stays open.
  if (signedIn || !workflowUsesServer || guestAllowed(route)) return children;
  if (authLoading)
    return (
      <div className="shop-page" role="status">
        Memeriksa akun…
      </div>
    );
  return (
    <>
      <Home />
      <GuestPrompt route={route} />
    </>
  );
}

function GuestPrompt({ route }) {
  const { profile } = useCompany();
  const dialogRef = useRef(null);
  const titleId = useId();
  const textId = useId();
  useEffect(() => {
    try {
      globalThis.sessionStorage?.setItem(RETURN_KEY, route);
    } catch {
      /* Without storage the visitor simply returns to the home page after signing in. */
    }
  }, [route]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog.showModal && !dialog.open) dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => dialog.close?.();
  }, []);
  const close = () => {
    window.location.hash = '/';
  };
  return createPortal(
    <dialog
      ref={dialogRef}
      className="guest-gate-dialog"
      aria-labelledby={titleId}
      aria-describedby={textId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="guest-gate-content">
        <h2 id={titleId}>Masuk untuk melihat produk dan harga</h2>
        <p id={textId}>
          Detail produk, harga, dan pemesanan di {profile.shortName} khusus untuk pelanggan
          terdaftar. Daftar gratis dengan nomor HP; akun baru diperiksa Admin sebelum dapat dipakai.
        </p>
        <div className="guest-gate-actions">
          <a className="shop-primary guest-gate-button" href="#/login">
            Masuk
          </a>
          <a className="guest-gate-button guest-gate-secondary" href="#/daftar">
            Daftar akun baru
          </a>
        </div>
        <button type="button" className="guest-gate-later" onClick={close}>
          Nanti saja, kembali ke beranda
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
