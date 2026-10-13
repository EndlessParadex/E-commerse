export const demoCompanyProfile = Object.freeze({ shortName: 'BAM', legalName: 'CV. Belitung Arta Mandiri', description: 'Katalog produk dari berbagai pemasok, dengan pilihan ukuran dan harga yang jelas.', address: '', email: '', phone: '', logo: '' });
export const emptyCompanyProfile = Object.freeze({ shortName: 'Toko Anda', legalName: 'Perusahaan Anda', description: 'Temukan produk, ukuran, dan harga dalam satu katalog.', address: '', email: '', phone: '', logo: '' });
export const companyFields = ['shortName', 'legalName', 'description', 'address', 'email', 'phone', 'logo'];
export function companyProfileErrors(value) {
  const errors = {};
  const limits = { shortName: [2, 30], legalName: [2, 100], description: [0, 300], address: [0, 500], email: [0, 254], phone: [0, 30], logo: [0, 1400000] };
  for (const field of companyFields) {
    const entry = value?.[field]; const [min, max] = limits[field];
    if (typeof entry !== 'string' || entry.trim().length < min || entry.length > max) errors[field] = `Isi ${min ? min + '–' : 'maksimal '}${max} karakter.`;
  }
  if (!errors.email && value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) errors.email = 'Alamat email tidak valid.';
  if (!errors.phone && value.phone && !/^\+?[\d\s().-]{5,30}$/.test(value.phone.trim())) errors.phone = 'Gunakan nomor telepon yang valid.';
  if (!errors.logo && value.logo && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value.logo)) errors.logo = 'Logo harus JPG, PNG, atau WebP, maksimal 1 MB.';
  return errors;
}
export function normalizedCompanyProfile(value) {
  return Object.fromEntries(companyFields.map((field) => [field, value[field].trim()]));
}
