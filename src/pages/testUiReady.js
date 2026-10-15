import assert from 'node:assert/strict';
export async function waitForAdmin(container, act) {
  const deadline = Date.now() + 5000;
  while (container.textContent.includes('Memuat ruang admin') && Date.now() < deadline)
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
  assert.ok(
    !container.textContent.includes('Memuat ruang admin'),
    'admin module should finish loading',
  );
}
