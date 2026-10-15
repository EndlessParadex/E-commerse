export const demoCompanyProfile = Object.freeze({
  shortName: 'BAM',
  legalName: 'CV. Belitung Arta Mandiri',
  description: 'Katalog produk dari berbagai pemasok, dengan pilihan ukuran dan harga yang jelas.',
  address: '',
  email: '',
  phone: '',
  logo: '',
  showSoldCount: false,
  showExactStock: true,
  bankName: '',
  bankAccount: '',
  bankHolder: '',
  bankInstructions: '',
  codEnabled: true,
});
export const emptyCompanyProfile = Object.freeze({
  shortName: 'Toko Anda',
  legalName: 'Perusahaan Anda',
  description: 'Temukan produk, ukuran, dan harga dalam satu katalog.',
  address: '',
  email: '',
  phone: '',
  logo: '',
  showSoldCount: false,
  showExactStock: true,
  bankName: '',
  bankAccount: '',
  bankHolder: '',
  bankInstructions: '',
  codEnabled: true,
});
export const companyFields = [
  'shortName',
  'legalName',
  'description',
  'address',
  'email',
  'phone',
  'logo',
  'bankName',
  'bankAccount',
  'bankHolder',
  'bankInstructions',
];
export function companyProfileErrors(value) {
  const errors = {};
  const limits = {
    shortName: [2, 30],
    legalName: [2, 100],
    description: [0, 300],
    address: [0, 500],
    email: [0, 254],
    phone: [0, 30],
    logo: [0, 1400000],
    bankName: [0, 80],
    bankAccount: [0, 40],
    bankHolder: [0, 100],
    bankInstructions: [0, 500],
  };
  for (const field of companyFields) {
    const entry = value?.[field] ?? (field.startsWith('bank') ? '' : undefined);
    const [min, max] = limits[field];
    if (typeof entry !== 'string' || entry.trim().length < min || entry.length > max)
      errors[field] = `Isi ${min ? min + '–' : 'maksimal '}${max} karakter.`;
  }
  if (!errors.email && value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim()))
    errors.email = 'Alamat email tidak valid.';
  if (!errors.phone && value.phone && !/^\+?[\d\s().-]{5,30}$/.test(value.phone.trim()))
    errors.phone = 'Gunakan nomor telepon yang valid.';
  if (
    !errors.logo &&
    value.logo &&
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value.logo)
  )
    errors.logo = 'Logo harus JPG, PNG, atau WebP, maksimal 1 MB.';
  for (const field of ['showSoldCount', 'showExactStock', 'codEnabled'])
    if (value?.[field] !== undefined && typeof value[field] !== 'boolean')
      errors[field] = 'Pilih pengaturan yang valid.';
  const bankFields = ['bankName', 'bankAccount', 'bankHolder'];
  if (
    bankFields.some((f) => typeof value?.[f] === 'string' && value[f].trim()) &&
    !bankFields.every((f) => typeof value?.[f] === 'string' && value[f].trim())
  )
    errors.bankAccount = 'Lengkapi nama bank, nomor rekening, dan pemilik rekening.';
  if (
    typeof value?.bankAccount === 'string' &&
    value.bankAccount &&
    !/^[0-9 -]{4,40}$/.test(value.bankAccount.trim())
  )
    errors.bankAccount = 'Nomor rekening hanya angka, spasi, atau tanda hubung.';
  return errors;
}
export function normalizedCompanyProfile(value) {
  return {
    ...Object.fromEntries(companyFields.map((field) => [field, (value[field] ?? '').trim()])),
    showSoldCount: value.showSoldCount === true,
    showExactStock: value.showExactStock !== false,
    codEnabled: value.codEnabled !== false,
  };
}
