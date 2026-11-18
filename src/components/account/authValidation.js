import { validateArea } from '../../data/belitungRegions.js';
import { normalizeWhatsApp } from '../../state/whatsappModel.js';

export function validateAuth(values, mode) {
  const errors = {};
  const isRegister = mode === 'register';
  if (isRegister && values.name.trim().length < 2)
    errors.name = 'Masukkan nama minimal 2 karakter.';
  if (isRegister && values.name.trim().length > 100) errors.name = 'Nama maksimal 100 karakter.';
  if (isRegister) Object.assign(errors, validateArea({ jalan: values.jalan, desa: values.desa }));
  const loginText = typeof values.email === 'string' ? values.email.trim() : '';
  const isPhoneLogin = !isRegister && Boolean(normalizeWhatsApp(loginText));
  // Registration: email is optional, but must be valid when filled in.
  const checkEmail = isRegister ? Boolean(loginText) : !isPhoneLogin;
  if (checkEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginText) || loginText.length > 254))
    errors.email = isRegister
      ? 'Masukkan alamat email yang valid, atau kosongkan.'
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
