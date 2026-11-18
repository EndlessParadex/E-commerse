// Banner status and form checks for the admin banner page.
const dateLabel = (value) =>
  new Date(value + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
/** Where a banner stands today: shown, hidden, scheduled, or ended. */
export function bannerStatus(banner, today) {
  if (!banner.active) return { id: 'hidden', label: 'Disembunyikan' };
  if (banner.startsOn && today < banner.startsOn)
    return { id: 'scheduled', label: 'Tampil mulai ' + dateLabel(banner.startsOn) };
  if (banner.endsOn && today > banner.endsOn)
    return { id: 'ended', label: 'Berakhir ' + dateLabel(banner.endsOn) };
  return {
    id: 'live',
    label: banner.endsOn ? 'Tampil sampai ' + dateLabel(banner.endsOn) : 'Tampil',
  };
}
/** Form check before saving; the server checks the same rules. */
export function bannerErrors(draft) {
  const errors = {};
  const title = draft.title.trim();
  if (!title) errors.title = 'Isi judul banner.';
  else if (title.split('\n').length > 2) errors.title = 'Judul paling banyak 2 baris.';
  if (!draft.cta.trim()) errors.cta = 'Isi teks tombol.';
  if (draft.target.type !== 'catalog' && !draft.target.id) errors.target = 'Pilih tujuan tombol.';
  if (draft.media === 'image' && !draft.image) errors.image = 'Unggah gambar banner.';
  if (draft.startsOn && draft.endsOn && draft.endsOn < draft.startsOn)
    errors.endsOn = 'Tanggal selesai harus sama atau setelah tanggal mulai.';
  return errors;
}
