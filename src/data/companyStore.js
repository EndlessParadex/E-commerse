import { demoCompanyProfile, companyProfileErrors, normalizedCompanyProfile } from './companyProfile.js';

const listeners = new Set();
let company = Object.freeze({ version: 1, instanceId: '', mode: 'demo', revision: 0, available: false, profile: demoCompanyProfile });
export const companySnapshot = () => company;
export const subscribeCompany = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export function validateCompany(value) {
  if (value?.version !== 1 || !/^[a-f\d-]{36}$/i.test(value.instanceId || '') || !['demo', 'company'].includes(value.mode)
    || !Number.isSafeInteger(value.revision) || value.revision < 0 || Object.keys(companyProfileErrors(value.profile)).length) throw new Error('Pengaturan perusahaan dari server tidak valid.');
  return Object.freeze({ version: 1, instanceId: value.instanceId, mode: value.mode, revision: value.revision, available: true, profile: Object.freeze(normalizedCompanyProfile(value.profile)) });
}
export function applyCompany(value) {
  company = validateCompany(value); listeners.forEach((listener) => listener());
}
// Existing BAM keys remain intact. A fresh company database never reads demo browser data.
export const companyStorageKey = (key) => company.mode === 'company' ? `${key}.company.${company.instanceId}` : key;
export async function saveCompany(profile, request = globalThis.fetch) {
  const before = company;
  if (!before.available) return { error: 'Server belum mendukung pengaturan perusahaan. Perbarui dan jalankan ulang server.' };
  try {
    const response = await request('/api/admin/company', { method: 'PUT', credentials: 'include', signal: AbortSignal.timeout(15000), headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: 1, revision: before.revision, profile }) });
    const payload = await response.json();
    if (!response.ok) return { error: response.status === 401 ? 'Sesi berakhir. Masuk kembali sebagai admin.' : response.status === 403 ? 'Hanya admin yang dapat mengubah pengaturan perusahaan.' : payload.errors?.form || 'Pengaturan belum tersimpan.', conflict: response.status === 409 };
    const next = validateCompany(payload);
    if (next.instanceId !== before.instanceId || next.mode !== before.mode || next.revision !== before.revision + 1 || JSON.stringify(next.profile) !== JSON.stringify(normalizedCompanyProfile(profile))) throw new Error('Server tidak mengembalikan pengaturan yang disimpan.');
    applyCompany(payload); return { saved: true };
  } catch { return { error: 'Pengaturan belum dapat dipastikan tersimpan. Isian tetap tersedia; periksa koneksi lalu coba lagi.' }; }
}
export async function refreshCompany(request = globalThis.fetch) {
  const before = company;
  const response = await request('/api/company', { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Pengaturan belum dapat dimuat.');
  const payload = validateCompany(await response.json());
  if (payload.instanceId !== before.instanceId || payload.mode !== before.mode) throw new Error('Instalasi berubah. Muat ulang aplikasi.');
  applyCompany(payload); return payload.profile;
}
