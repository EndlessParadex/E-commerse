import { useCallback, useEffect, useRef, useState } from 'react';
import { useDelivery } from '../state/useDelivery';
import { accountApi } from '../components/account/accountApi';
import { dateLabel, rupiah } from '../components/shop/shopPresentation';
import ConfirmDialog from '../components/shop/ConfirmDialog';
import './DriverPage.css';

function TaskItems({ task }) {
  return (
    <ul className="driver-task-items">
      {task.items.map((item) => (
        <li key={item.id}>
          <span>
            {item.name}
            {item.sizeLabel ? ' · ' + item.sizeLabel : ''}
          </span>
          <strong>× {item.quantity}</strong>
        </li>
      ))}
    </ul>
  );
}

function ActiveTask({ task, onDone }) {
  return (
    <li className="driver-task">
      <div className="driver-task-heading">
        <div>
          <h3>{task.storeName || task.recipient}</h3>
          <small title={task.id}>{task.id.split('-').slice(0, 2).join('-')}</small>
        </div>
        <span>Dikirim {dateLabel(task.shippedAt)}</span>
      </div>
      <p className="driver-task-address">{task.address}</p>
      {task.phone && (
        <a className="driver-task-phone" href={'tel:' + task.phone}>
          Telepon {task.phone}
        </a>
      )}
      {task.note && <p>Catatan: {task.note}</p>}
      <TaskItems task={task} />
      <p className={'driver-task-collect' + (task.collectAmount ? ' is-due' : '')}>
        {task.collectAmount
          ? 'Terima pembayaran ' + rupiah(task.collectAmount)
          : 'Sudah dibayar, tidak perlu menagih'}
      </p>
      <button type="button" className="shop-primary" onClick={() => onDone(task)}>
        Sudah sampai
      </button>
    </li>
  );
}

export default function DriverPage() {
  const { user, authLoading, authError } = useDelivery();
  const allowed = user?.isDriver === true;
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(null);
  const [dialogError, setDialogError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const load = useCallback(
    () =>
      accountApi('/api/driver/deliveries')
        .then((payload) => {
          setTasks(payload);
          setError('');
        })
        .catch((failure) => setError(failure.message)),
    [],
  );
  useEffect(() => {
    if (!allowed) return undefined;
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [allowed, load]);
  const finish = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await accountApi('/api/driver/deliveries/' + encodeURIComponent(target.id) + '/complete', {
        revision: target.revision,
      });
      setTarget(null);
      await load();
    } catch (failure) {
      setDialogError(failure.message);
      load();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  if (authLoading)
    return (
      <div className="driver-page" role="status">
        Memeriksa akses…
      </div>
    );
  if (!allowed)
    return (
      <section className="driver-page">
        <h1>{user ? 'Halaman ini khusus sopir' : 'Masuk untuk melihat tugas pengiriman'}</h1>
        <p>{authError || 'Pemilik BAM mendaftarkan akun sopir melalui Ruang admin.'}</p>
        <a className="shop-primary" href={user ? '#/' : '#/login'}>
          {user ? 'Kembali ke beranda' : 'Masuk'}
        </a>
      </section>
    );
  return (
    <section className="driver-page">
      <header className="driver-page-heading">
        <div>
          <h1>Tugas pengiriman</h1>
          <p>Halo, {user.name}. Tandai pesanan setelah barang diterima.</p>
        </div>
        <button type="button" className="driver-refresh" onClick={load}>
          Muat ulang
        </button>
      </header>
      {error && (
        <p className="shop-warning" role="alert">
          {error}
        </p>
      )}
      {!tasks && !error && <p role="status">Memuat tugas…</p>}
      {tasks && (
        <>
          <h2>Perlu diantar ({tasks.active.length})</h2>
          {tasks.active.length ? (
            <ul className="driver-task-list">
              {tasks.active.map((task) => (
                <ActiveTask
                  key={task.id}
                  task={task}
                  onDone={(value) => {
                    setDialogError('');
                    setTarget(value);
                  }}
                />
              ))}
            </ul>
          ) : (
            <p className="driver-task-empty">Tidak ada pesanan yang perlu diantar.</p>
          )}
          <details className="driver-finished">
            <summary>Sudah selesai ({tasks.finished.length})</summary>
            <ul>
              {tasks.finished.map((task) => (
                <li key={task.id}>
                  <strong>{task.storeName || task.recipient}</strong>
                  <span>{dateLabel(task.deliveredAt)}</span>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      {target && (
        <ConfirmDialog
          title="Pesanan sudah sampai?"
          confirmLabel="Ya, sudah sampai"
          danger={false}
          busy={busy}
          error={dialogError}
          onConfirm={finish}
          onClose={() => {
            if (!pending.current) setTarget(null);
          }}
        >
          <p>
            <strong>{target.storeName || target.recipient}</strong>
            <br />
            {target.collectAmount
              ? 'Pastikan pembayaran ' + rupiah(target.collectAmount) + ' sudah Anda terima.'
              : 'Pastikan barang sudah diterima.'}{' '}
            Pesanan akan langsung selesai dan tidak dapat diubah.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}
