import { validateDelivery } from '../../state/deliveryModel.js';

export function validateAuth(values, mode) {
  const errors = {};
  const isRegister = mode === 'register';
  if (isRegister && values.name.trim().length < 2) errors.name = 'Masukkan nama minimal 2 karakter.';
  if (isRegister && values.name.trim().length > 100) errors.name = 'Nama maksimal 100 karakter.';
  if (isRegister) {
    const deliveryErrors = validateDelivery({ namaToko: values.name, namaJalan: values.address });
    if (deliveryErrors.namaJalan) errors.address = deliveryErrors.namaJalan;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) || values.email.trim().length > 254) errors.email = 'Masukkan alamat email yang valid.';
  if (!values.password.trim()) errors.password = 'Masukkan kata sandi.';
  if (isRegister && values.password.length < 8) errors.password = 'Gunakan kata sandi minimal 8 karakter.';
  if (values.password.length > 128) errors.password = 'Kata sandi maksimal 128 karakter.';
  if (isRegister && (!values.confirmPassword || values.confirmPassword !== values.password)) errors.confirmPassword = 'Konfirmasi kata sandi harus sama.';
  return errors;
}
