import { useEffect, useRef, useState } from 'react';
import { useDelivery } from '../state/useDelivery';
import useUnsavedChanges from '../state/useUnsavedChanges';
import { accountApi } from '../components/account/accountApi';
import { refreshCompany } from '../data/companyStore';
import './AdminEmailPage.css';

const draftFrom = (data) => ({ ...data.settings, port: String(data.settings.port), password: '' });
export default function AdminEmailPage() {
  const { user } = useDelivery();
  const owner = user?.isOwner === true;
  const [data, setData] = useState(null),
    [draft, setDraft] = useState(null),
    [provider, setProvider] = useState('manual'),
    [baseline, setBaseline] = useState(''),
    [currentPassword, setCurrentPassword] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const active = useRef(true),
    pending = useRef(false);
  const dirty = Boolean(draft && JSON.stringify(draft) !== baseline);
  useUnsavedChanges(dirty, undefined, busy);
  useEffect(() => {
    active.current = true;
    if (owner)
      accountApi('/api/admin/email-settings')
        .then((value) => {
          if (!active.current) return;
          const next = draftFrom(value);
          setData(value);
          setDraft(next);
          setProvider(next.host.toLowerCase() === 'smtp.gmail.com' ? 'gmail' : 'manual');
          setBaseline(JSON.stringify(next));
        })
        .catch(() => {
          if (active.current)
            setError(
              'Pengaturan email belum dapat dibuka. Periksa akses pemilik dan koneksi server.',
            );
        });
    return () => {
      active.current = false;
    };
  }, [owner]);
  const gmail = provider === 'gmail';
  const needsPassword =
    !data?.passwordSet ||
    (gmail &&
      (data.settings.host.toLowerCase() !== 'smtp.gmail.com' ||
        draft.user.trim().toLowerCase() !== data.settings.user.trim().toLowerCase()));
  const pageLocation = typeof window === 'undefined' ? null : window.location;
  const pageIsLocal = ['localhost', '127.0.0.1', '[::1]'].includes(pageLocation?.hostname);
  const pageUrl =
    pageLocation?.protocol === 'https:' || (pageLocation?.protocol === 'http:' && pageIsLocal)
      ? pageLocation.origin + '/'
      : '';
  const perform = async (test = false) => {
    if (pending.current || !owner || !data) return;
    setError('');
    setNotice('');
    const smtpPassword = gmail ? draft.password.replace(/ /g, '') : draft.password;
    if (!test && needsPassword && !smtpPassword.trim()) {
      setError(
        gmail
          ? 'Isi App Password untuk akun Gmail pengirim yang dipilih.'
          : 'Isi kata sandi atau app password SMTP dari penyedia email.',
      );
      return;
    }
    if (!currentPassword) {
      setError('Masukkan kata sandi akun pemilik untuk melanjutkan.');
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const value = await accountApi(
        '/api/admin/email-settings' + (test ? '/test' : ''),
        {
          revision: data.revision,
          currentPassword,
          ...(test
            ? {}
            : { settings: { ...draft, password: smtpPassword, port: Number(draft.port) } }),
        },
        test ? 60000 : 15000,
      );
      if (!active.current) return;
      const next = draftFrom(value);
      setData(value);
      setDraft(next);
      setBaseline(JSON.stringify(next));
      setNotice(
        test
          ? value.message
          : 'Pengaturan email tersimpan dan langsung digunakan. Kirim email uji untuk memeriksa pengiriman.',
      );
      if (!test) await refreshCompany().catch(() => {});
    } catch (e) {
      if (active.current) {
        setError(
          e.name === 'TimeoutError'
            ? 'Hasil belum dapat dikonfirmasi. Muat ulang pengaturan sebelum mencoba lagi.'
            : e.message,
        );
        if (test)
          await accountApi('/api/admin/email-settings')
            .then((value) => {
              if (active.current) setData(value);
            })
            .catch(() => {});
      }
    } finally {
      pending.current = false;
      if (active.current) {
        setBusy(false);
        setCurrentPassword('');
      }
    }
  };
  if (!owner)
    return (
      <section className="admin-panel email-settings-page">
        <div className="email-settings-body">
          <h2>Pengaturan khusus pemilik toko</h2>
          <p>Gunakan akun pemilik toko untuk mengelola layanan email.</p>
          <a href="#/admin">Kembali ke ringkasan</a>
        </div>
      </section>
    );
  const field = (key, label, attributes = {}, help = '') => (
    <div className="admin-field" key={key}>
      <label htmlFor={'email-setting-' + key}>{label}</label>
      <input
        id={'email-setting-' + key}
        value={draft[key]}
        required
        aria-describedby={help ? 'email-setting-' + key + '-help' : undefined}
        onChange={(event) => {
          const next = event.target.value;
          setDraft((value) => ({
            ...value,
            [key]: next,
            ...(gmail && key === 'user' && (!value.from || value.from === value.user)
              ? { from: next }
              : {}),
          }));
          setNotice('');
        }}
        {...attributes}
      />
      {help && (
        <p className="email-settings-help" id={'email-setting-' + key + '-help'}>
          {help}
        </p>
      )}
    </div>
  );
  return (
    <section className="admin-panel email-settings-page">
      <div className="admin-panel-heading">
        <div>
          <h2>Pengaturan email toko</h2>
          <p>
            Akses pemilik toko. Admin operasional dan pembeli tidak dapat membuka pengaturan ini.
          </p>
        </div>
      </div>
      <div className="email-settings-body">
        {error && (
          <p className="email-settings-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="email-settings-notice" role="status">
            {notice}
          </p>
        )}
        {!draft ? (
          <p role="status">
            {error
              ? 'Pengaturan belum tersedia. Muat ulang halaman untuk mencoba lagi.'
              : 'Memuat pengaturan…'}
          </p>
        ) : (
          <>
            <div className="email-settings-state">
              <strong>
                {data.source === 'website'
                  ? 'Pengaturan tersimpan melalui website'
                  : data.source === 'environment'
                    ? 'Menggunakan pengaturan server'
                    : 'Email belum dikonfigurasi'}
              </strong>
              <p>
                Gunakan rincian SMTP dari penyedia email Anda. Kata sandi SMTP yang tersimpan tidak
                ditampilkan kembali.
              </p>
              {data.lastTest && (
                <p>
                  Email uji terakhir:{' '}
                  {data.lastTest.status === 'sent'
                    ? 'diserahkan ke layanan email'
                    : 'belum berhasil dikirim'}{' '}
                  · {new Date(data.lastTest.at).toLocaleString('id-ID')}
                </p>
              )}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                perform();
              }}
            >
              <fieldset disabled={busy}>
                <div className="email-setup-service">
                  <h3>1. Pilih layanan email</h3>
                  <p>
                    Layanan ini mengirim email verifikasi, pemulihan kata sandi, dan kabar pesanan
                    dari toko Anda.
                  </p>
                  <div className="email-setup-options" aria-label="Layanan email pengirim">
                    <button
                      type="button"
                      className={gmail ? 'admin-primary' : 'admin-secondary'}
                      aria-pressed={gmail}
                      onClick={() => {
                        setProvider('gmail');
                        setDraft((value) => ({
                          ...value,
                          host: 'smtp.gmail.com',
                          port: '587',
                        }));
                        setNotice('');
                      }}
                    >
                      Gunakan Gmail
                    </button>
                    <button
                      type="button"
                      className={!gmail ? 'admin-primary' : 'admin-secondary'}
                      aria-pressed={!gmail}
                      onClick={() => setProvider('manual')}
                    >
                      Penyedia lain
                    </button>
                  </div>
                  {gmail && (
                    <div className="email-setup-guide">
                      <strong>Siapkan Gmail milik Anda</strong>
                      <ol>
                        <li>
                          Aktifkan{' '}
                          <a
                            href="https://myaccount.google.com/signinoptions/two-step-verification"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Verifikasi 2 Langkah Google
                          </a>
                          .
                        </li>
                        <li>
                          Buka{' '}
                          <a
                            href="https://myaccount.google.com/apppasswords"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            App Passwords Google
                          </a>
                          , buat dengan nama Website BAM, lalu salin kodenya ke kolom App Password
                          di bawah.
                        </li>
                        <li>
                          Isi alamat Gmail pengirim yang Anda miliki. Server dan port sudah diisi;
                          perubahan baru digunakan setelah disimpan.
                        </li>
                      </ol>
                      <p>
                        Gunakan App Password khusus untuk website ini. Masukkan hanya pada formulir
                        ini dan jangan kirim melalui chat. Jika pilihan App Password tidak tersedia,
                        periksa{' '}
                        <a
                          href="https://support.google.com/accounts/answer/185833?hl=id"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          ketentuan akun Google
                        </a>
                        .
                      </p>
                    </div>
                  )}
                </div>
                <h3 className="email-setup-heading">2. Lengkapi pengirim dan alamat website</h3>
                <div className="email-settings-grid">
                  {field('host', 'Server SMTP', {
                    placeholder: 'smtp.perusahaan.id',
                    autoComplete: 'off',
                    maxLength: 253,
                    readOnly: gmail,
                  })}
                  {field('port', 'Port SMTP', {
                    type: 'number',
                    min: 1,
                    max: 65535,
                    readOnly: gmail,
                  })}
                  {field(
                    'user',
                    gmail ? 'Alamat Gmail pengirim' : 'Nama pengguna SMTP',
                    { autoComplete: 'off', maxLength: 254, type: gmail ? 'email' : 'text' },
                    gmail
                      ? 'Isi alamat lengkap Gmail Anda atau akun Google Workspace yang diizinkan.'
                      : '',
                  )}
                  {field(
                    'password',
                    needsPassword
                      ? gmail
                        ? 'App Password Google'
                        : 'Kata sandi SMTP / app password'
                      : 'Kata sandi SMTP baru (opsional)',
                    {
                      type: 'password',
                      autoComplete: 'new-password',
                      maxLength: 1024,
                      required: needsPassword,
                      placeholder: !needsPassword
                        ? 'Kosongkan untuk memakai kata sandi tersimpan'
                        : '',
                    },
                    gmail
                      ? 'Kode 16 karakter dari Google, berbeda dari kata sandi masuk Gmail dan BAM.'
                      : '',
                  )}
                  {field(
                    'from',
                    'Alamat pengirim',
                    {
                      placeholder: 'Nama Toko <email@perusahaan.id>',
                      maxLength: 360,
                      autoComplete: 'off',
                    },
                    gmail
                      ? 'Mengikuti alamat Gmail di atas. Nama toko dapat ditambahkan: Nama Toko <alamat Gmail Anda>.'
                      : '',
                  )}
                  {field('publicUrl', 'Alamat website', {
                    type: 'url',
                    placeholder: 'https://toko.perusahaan.id/',
                    maxLength: 1000,
                  })}
                </div>
                {pageUrl && (
                  <button
                    className="admin-secondary email-use-page-url"
                    type="button"
                    onClick={() => {
                      setDraft((value) => ({ ...value, publicUrl: pageUrl }));
                      setNotice('');
                    }}
                  >
                    {pageIsLocal
                      ? 'Gunakan alamat uji di komputer ini'
                      : 'Gunakan alamat website ini'}
                  </button>
                )}
                <p className="email-settings-help">
                  Port 465 menggunakan TLS; port lain menggunakan STARTTLS. Pilih port sesuai
                  petunjuk penyedia email. Alamat localhost hanya untuk uji di komputer yang sama.
                  Saat toko online, gunakan alamat website HTTPS yang dapat dibuka pelanggan.
                </p>
                <div className="email-settings-confirm">
                  <h3>3. Simpan dan uji pengiriman</h3>
                  <div className="email-setup-recipient">
                    <strong>Penerima email uji: {user.email}</strong>
                    <p>
                      Ini alamat akun pemilik yang sedang masuk. Pastikan Anda dapat membuka kotak
                      masuknya; alamat pengirim boleh berbeda.
                    </p>
                    {user.email.toLowerCase() === 'pemilik@perusahaan.id' && (
                      <p role="note">
                        Alamat akun ini masih memakai contoh panduan. Masuk menggunakan akun pemilik
                        dengan email aktif milik Anda untuk menerima email uji.
                      </p>
                    )}
                  </div>
                  <label htmlFor="email-owner-password">Kata sandi akun pemilik</label>
                  <input
                    id="email-owner-password"
                    type="password"
                    autoComplete="current-password"
                    maxLength={128}
                    required
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                  <p className="email-settings-help">
                    Isi kata sandi untuk masuk ke BAM. Setelah menyimpan, isi kembali kata sandi ini
                    untuk mengirim email uji.
                  </p>
                </div>
                <div className="email-settings-actions">
                  <button className="admin-primary" type="submit">
                    {busy ? 'Memproses…' : 'Simpan pengaturan email'}
                  </button>
                  <button
                    className="admin-secondary"
                    type="button"
                    disabled={busy || dirty || data.source !== 'website'}
                    onClick={() => perform(true)}
                  >
                    Kirim email uji
                  </button>
                </div>
                <p className="email-settings-help">
                  Email uji dikirim ke akun pemilik: {user.email}. Simpan perubahan terlebih dahulu,
                  lalu periksa kotak masuk atau spam setelah pengiriman.
                </p>
              </fieldset>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
