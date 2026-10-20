import './ContactStatus.css';

export default function ContactStatus({ channel, verified, at, missing = false }) {
  const date = at == null ? null : new Date(at);
  return (
    <div className="contact-confirmation">
      <span
        className={
          'contact-badge ' + (missing ? 'is-empty' : verified ? 'is-confirmed' : 'is-pending')
        }
      >
        {channel}{' '}
        {missing ? 'belum ditambahkan' : verified ? 'terkonfirmasi' : 'belum dikonfirmasi'}
      </span>
      {verified && date && Number.isFinite(date.getTime()) && (
        <time dateTime={date.toISOString()}>
          {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(
            date,
          )}
        </time>
      )}
    </div>
  );
}
