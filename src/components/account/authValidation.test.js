import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAuth } from './authValidation.js';

const valid = { name: 'Pengguna Contoh', address: 'Jalan Contoh nomor 10, Tangerang, Banten 15810', email: 'demo@example.com', password: 'contoh1234', confirmPassword: 'contoh1234' };

test('form login kosong menolak email dan kata sandi tanpa mewajibkan nama', () => {
  const result = validateAuth({ name: '', email: '', password: '', confirmPassword: '' }, 'login');
  assert.deepEqual(Object.keys(result), ['email', 'password']);
});

test('email tidak valid ditolak; spasi di sekitar email diterima', () => {
  for (const email of ['demo', 'demo@', 'demo @example.com', 'demo@example', 'a'.repeat(255) + '@example.com']) {
    assert.ok(validateAuth({ ...valid, email }, 'login').email);
  }
  assert.deepEqual(validateAuth({ ...valid, email: ' demo@example.com ' }, 'login'), {});
});

test('pendaftaran memerlukan nama dan kata sandi minimal delapan karakter', () => {
  const result = validateAuth({ ...valid, name: ' ', password: 'short', confirmPassword: 'short' }, 'register');
  assert.ok(result.name);
  assert.ok(result.password);
  assert.ok(validateAuth({ ...valid, password: '        ', confirmPassword: '        ' }, 'register').password);
});

test('konfirmasi harus sama persis tanpa memangkas spasi kata sandi', () => {
  assert.ok(validateAuth({ ...valid, confirmPassword: valid.password + ' ' }, 'register').confirmPassword);
  assert.deepEqual(validateAuth(valid, 'register'), {});
  assert.deepEqual(validateAuth({ ...valid, password: ' secret123 ', confirmPassword: ' secret123 ' }, 'register'), {});
});

test('login tidak menerapkan ulang batas minimum pendaftaran pada akun lama', () => {
  assert.deepEqual(validateAuth({ ...valid, password: 'short', confirmPassword: '' }, 'login'), {});
  assert.ok(validateAuth({ ...valid, password: 'x'.repeat(129) }, 'login').password);
});

test('alamat wajib pada pendaftaran tetapi tidak wajib pada login', () => {
  for (const address of ['', '  ', 'Jl. A', 'x'.repeat(501)]) {
    assert.ok(validateAuth({ ...valid, address }, 'register').address);
    assert.deepEqual(validateAuth({ ...valid, address }, 'login'), {});
  }
});
