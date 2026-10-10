export const rupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
export const dateLabel = (value) => Number.isFinite(value) && Math.abs(value) <= 8.64e15 ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(value) : 'Waktu belum tercatat';

