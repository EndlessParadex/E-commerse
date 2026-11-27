import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { guardStoreImages } from './imageGuard.js';

test('foto toko tidak bisa diklik kanan atau diseret; foto admin dan teks tidak terpengaruh', async () => {
  const window = new Window();
  const { document } = window;
  globalThis.Element = window.Element;
  document.body.innerHTML =
    '<main class="page-main page-main--store"><img id="toko" src="a.webp"><p id="teks">Harga</p></main>' +
    '<main class="page-main"><img id="admin" src="b.webp"></main>';
  const stop = guardStoreImages(document);
  const fire = (id, type) => {
    const event = new window.MouseEvent(type, { bubbles: true, cancelable: true });
    document.getElementById(id).dispatchEvent(event);
    return event.defaultPrevented;
  };
  try {
    assert.equal(fire('toko', 'contextmenu'), true);
    assert.equal(fire('toko', 'dragstart'), true);
    assert.equal(fire('teks', 'contextmenu'), false, 'teks tetap bisa diklik kanan');
    assert.equal(fire('admin', 'contextmenu'), false, 'gambar di luar toko tidak diblokir');
    stop();
    assert.equal(fire('toko', 'contextmenu'), false, 'dilepas saat pindah ke admin');
  } finally {
    delete globalThis.Element;
    await window.happyDOM.close();
  }
});
