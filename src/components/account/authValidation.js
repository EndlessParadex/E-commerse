import { validateDelivery } from '../../state/deliveryModel.js';
import { normalizeWhatsApp } from '../../state/whatsappModel.js';

export function validateAuth(values, mode) {
  const errors = {};
  const isRegister = mode === 'register';
  if (isRegister && values.name.trim().length < 2)
    errors.name = 'Masukkan nama minimal 2 karakter.';
  if (isRegister && values.name.trim().length > 100) errors.name = 'Nama maksimal 100 karakter.';
  if (isRegister) {
    const deliveryErrors = validateDelivery({ namaToko: values.name, namaJalan: values.address });
    if (deliveryErrors.namaJalan) errors.address = deliveryErrors.namaJalan;
  }
  const loginText = typeof values.email === 'string' ? values.email.trim() : '';
  const isPhoneLogin = !isRegister && Boolean(normalizeWhatsApp(loginText));
  if (!isPhoneLogin && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginText) || loginText.length > 254))
    errors.email = isRegister
      ? 'Masukkan alamat email yang valid.'
      : 'Masukkan email atau nomor HP Indonesia yang valid.';
  if (isRegister && !normalizeWhatsApp(values.phone))
    errors.phone = 'Masukkan nomor HP Indonesia yang aktif, misalnya 081234567890.';
  if (!values.password.trim()) errors.password = 'Masukkan kata sandi.';
  if (isRegister && values.password.length < 8)
    errors.password = 'Gunakan kata sandi minimal 8 karakter.';
  if (values.password.length > 128) errors.password = 'Kata sandi maksimal 128 karakter.';
  if (isRegister && (!values.confirmPassword || values.confirmPassword !== values.password))
    errors.confirmPassword = 'Konfirmasi kata sandi harus sama.';
  return errors;
}
