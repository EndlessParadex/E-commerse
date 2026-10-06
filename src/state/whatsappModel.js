// Format validation only; this does not verify that a number has WhatsApp.
export function normalizeWhatsApp(value) {
  if (typeof value !== 'string' || !/^[+\d\s()-]*$/.test(value)) return '';
  let number = value.replace(/[\s()-]/g, '').replace(/^\+/, '');
  if (number.startsWith('08')) number = '62' + number.slice(1);
  return /^628\d{8,11}$/.test(number) ? '+' + number : '';
}

export function validateWhatsApp(number, optedIn) {
  return optedIn && !normalizeWhatsApp(number)
    ? 'Isi nomor Indonesia yang valid, misalnya 081234567890 atau +6281234567890.'
    : '';
}
