import { useEffect, useId, useRef, useState } from 'react';
import { creatorProfile } from '../../data/creatorProfile';
import './CreatorProfileDialog.css';

function outsideDialog(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
}

export default function CreatorProfileDialog({ id, onClose, returnFocusRef }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const backdropStart = useRef(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = returnFocusRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [returnFocusRef]);

  return <dialog ref={dialogRef} id={id} className="creator-profile-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onPointerDown={(event) => { backdropStart.current = outsideDialog(event); }}
    onPointerCancel={() => { backdropStart.current = false; }}
    onClick={(event) => {
      const shouldClose = backdropStart.current && outsideDialog(event);
      backdropStart.current = false;
      if (shouldClose) onClose();
    }}>
    <button ref={closeRef} type="button" className="creator-profile-close" aria-label={`Tutup profil ${creatorProfile.name}`} onClick={onClose}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
    </button>
    <div className="creator-profile-content">
      <div className="creator-profile-portrait">
        {avatarFailed ? <span className="creator-profile-avatar-fallback" role="img" aria-label={`Avatar ${creatorProfile.name} belum dapat dimuat`}>{creatorProfile.name.slice(0, 1)}</span>
          : <img src={creatorProfile.avatar} alt={`Avatar pilihan ${creatorProfile.name}`} loading="eager" decoding="async" onError={() => setAvatarFailed(true)} />}
      </div>
      <div className="creator-profile-copy">
        <span className="creator-profile-eyebrow">Di balik BAM.</span>
        <h2 id={titleId}>{creatorProfile.name}</h2>
        <p className="creator-profile-role">{creatorProfile.role}</p>
        <p id={descriptionId} className="creator-profile-message">{creatorProfile.message}</p>
        <button type="button" className="creator-profile-done" onClick={onClose}>Tutup profil</button>
      </div>
    </div>
  </dialog>;
}
