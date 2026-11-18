import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAuth } from './authValidation.js';

const valid = {
  name: 'Pengguna Contoh',
  jalan: 'Jalan Contoh nomor 10',
  desa: '19.02.01.1001',
  email: 'demo@example.com',
  phone: '081234567890',
  password: 'contoh1234',
  confirmPassword: 'contoh1234',
};

test('form login kosong menolak email dan kata sandi tanpa mewajibkan nama', () => {
  const result = validateAuth({ name: '', email: '', password: '', confirmPassword: '' }, 'login');
  assert.deepEqual(Object.keys(result), ['email', 'password']);
});

test('email tidak valid ditolak; spasi di sekitar email diterima', () => {
  for (const email of [
    'demo',
    'demo@',
    'demo @example.com',
    'demo@example',
    'a'.repeat(255) + '@example.com',
  ]) {
    assert.ok(validateAuth({ ...valid, email }, 'login').email);
  }
  assert.deepEqual(validateAuth({ ...valid, email: ' demo@example.com ' }, 'login'), {});
});

test('pendaftaran memerlukan nama dan kata sandi minimal delapan karakter', () => {
  const result = validateAuth(
    { ...valid, name: ' ', password: 'short', confirmPassword: 'short' },
    'register',
  );
  assert.ok(result.name);
  assert.ok(result.password);
  assert.ok(
    validateAuth({ ...valid, password: '        ', confirmPassword: '        ' }, 'register')
      .password,
  );
});

test('konfirmasi harus sama persis tanpa memangkas spasi kata sandi', () => {
  assert.ok(
    validateAuth({ ...valid, confirmPassword: valid.password + ' ' }, 'register').confirmPassword,
  );
  assert.deepEqual(validateAuth(valid, 'register'), {});
  assert.deepEqual(
    validateAuth({ ...valid, password: ' secret123 ', confirmPassword: ' secret123 ' }, 'register'),
    {},
  );
});

test('login tidak menerapkan ulang batas minimum pendaftaran pada akun lama', () => {
  assert.deepEqual(validateAuth({ ...valid, password: 'short', confirmPassword: '' }, 'login'), {});
  assert.ok(validateAuth({ ...valid, password: 'x'.repeat(129) }, 'login').password);
});

test('alamat Belitung wajib pada pendaftaran tetapi tidak wajib pada login', () => {
  for (const jalan of ['', '  ', 'Jl.', 'x'.repeat(201)]) {
    assert.ok(validateAuth({ ...valid, jalan }, 'register').jalan);
    assert.deepEqual(validateAuth({ ...valid, jalan }, 'login'), {});
  }
  // Only desa/kelurahan codes on Pulau Belitung are accepted.
  for (const desa of ['', '31.71.01.1001', 'Tanjungpandan']) {
    assert.ok(validateAuth({ ...valid, desa }, 'register').desa);
    assert.deepEqual(validateAuth({ ...valid, desa }, 'login'), {});
  }
});

test('login accepts phone aliases but rejects incomplete Indonesian numbers', () => {
  for (const email of ['081234567890', '6281234567890', '+6281234567890', '0812-3456-7890'])
    assert.deepEqual(validateAuth({ ...valid, email }, 'login'), {});
  for (const email of ['0812', '628123', '+620012345678', '1234567890'])
    assert.ok(validateAuth({ ...valid, email }, 'login').email);
});

test('new registration requires a valid phone; email is optional but checked when filled', () => {
  assert.ok(validateAuth({ ...valid, phone: '' }, 'register').phone);
  assert.ok(validateAuth({ ...valid, phone: '0812' }, 'register').phone);
  assert.deepEqual(validateAuth({ ...valid, phone: '+6281234567890' }, 'register'), {});
  assert.deepEqual(validateAuth({ ...valid, email: '' }, 'register'), {});
  assert.deepEqual(validateAuth({ ...valid, email: '   ' }, 'register'), {});
  assert.ok(validateAuth({ ...valid, email: 'bukan-email' }, 'register').email);
  // Login still needs an email or a phone number.
  assert.ok(validateAuth({ ...valid, email: '' }, 'login').email);
});
