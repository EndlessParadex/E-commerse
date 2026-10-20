import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';

test('late profile responses cannot restore a logged-out account or replace a newly saved avatar or phone', async () => {
  const dom = new Window({ url: 'http://fixture.test/#/akun' });
  const originalFetch = globalThis.fetch;
  Object.assign(globalThis, {
    window: dom,
    document: dom.document,
    HTMLElement: dom.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true });
  const initial = {
    id: 'first',
    name: 'Pengguna Pertama',
    address: 'Alamat lama yang lengkap',
    email: 'first@fixture.test',
    avatar: 'old-photo',
    storeName: '',
    phone: '',
  };
  let resolveProfile, resolveAvatar, resolvePhone;
  globalThis.fetch = async (path) => {
    if (path === '/api/auth/me') return new Response(JSON.stringify({ user: initial }));
    if (path === '/api/profile')
      return new Promise((resolve) => {
        resolveProfile = resolve;
      });
    if (path === '/api/profile/photo')
      return new Promise((resolve) => {
        resolveAvatar = resolve;
      });
    if (path === '/api/profile/phone')
      return new Promise((resolve) => {
        resolvePhone = resolve;
      });
    throw new Error('Unexpected request: ' + path);
  };
  const vite = await createServer({
    configFile: false,
    resolve: { preserveSymlinks: true },
    oxc: { jsx: { runtime: 'automatic' } },
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
    ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
  });
  let root, current;
  const changed = { ...initial, name: 'Nama Terbaru', address: 'Alamat terbaru yang lengkap' };
  const values = { namaToko: changed.name, namaJalan: changed.address, storeName: '' };
  const reply = (user) => new Response(JSON.stringify({ user }));
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  try {
    const [{ default: Provider }, { DeliveryContext }] = await Promise.all([
      vite.ssrLoadModule('/src/state/DeliveryProvider.jsx'),
      vite.ssrLoadModule('/src/state/useDelivery.js'),
    ]);
    const { createRoot } = await import('react-dom/client');
    const container = dom.document.createElement('div');
    dom.document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(
          Provider,
          null,
          createElement(DeliveryContext.Consumer, null, (value) => {
            current = value;
            return createElement('div', null, value.user?.name || 'Guest');
          }),
        ),
      );
      await settle();
    });
    assert.equal(current.user.id, initial.id);
    let profileRequest;
    await act(async () => {
      profileRequest = current.saveLocation(values);
      await settle();
    });
    await act(async () => current.setUser(null));
    const storedAddress = current.savedLocation;
    let result;
    await act(async () => {
      resolveProfile(reply(changed));
      result = await profileRequest;
    });
    assert.equal(result.ok, false);
    assert.equal(current.user, null, 'a stale response cannot sign a user back in');
    assert.deepEqual(
      current.savedLocation,
      storedAddress,
      'a stale response cannot replace the active delivery address',
    );
    await act(async () => current.setUser(initial));
    let avatarRequest, phoneRequest;
    await act(async () => {
      profileRequest = current.saveLocation(values);
      avatarRequest = current.saveAvatar('new-photo');
      phoneRequest = current.savePhone('081234567890');
      await settle();
    });
    await act(async () => {
      resolveAvatar(reply({ ...initial, avatar: 'new-photo' }));
      await avatarRequest;
      resolvePhone(reply({ ...initial, phone: '+6281234567890' }));
      await phoneRequest;
    });
    await act(async () => {
      resolveProfile(reply(changed));
      result = await profileRequest;
    });
    assert.equal(result.ok, true);
    assert.equal(current.user.name, changed.name);
    assert.equal(
      current.user.phone,
      '+6281234567890',
      'a delayed address response cannot undo the phone',
    );
    assert.equal(
      current.user.avatar,
      'new-photo',
      'a delayed address response cannot undo the photo',
    );
    await act(async () => {
      avatarRequest = current.saveAvatar('stale-photo');
      await settle();
    });
    await act(async () =>
      current.setUser({ ...initial, id: 'second', name: 'Pengguna Kedua', avatar: 'second-photo' }),
    );
    await act(async () => {
      resolveAvatar(reply({ ...initial, avatar: 'stale-photo' }));
      result = await avatarRequest;
    });
    assert.equal(result.ok, false);
    assert.equal(current.user.id, 'second');
    assert.equal(current.user.avatar, 'second-photo');
    await act(async () => {
      phoneRequest = current.savePhone('081298765432');
      await settle();
    });
    await act(async () => current.setUser(null));
    await act(async () => {
      resolvePhone(reply({ ...initial, id: 'second', phone: '+6281298765432' }));
      result = await phoneRequest;
    });
    assert.equal(result.ok, false);
    assert.equal(
      current.user,
      null,
      'a delayed phone response cannot restore a logged-out account',
    );
  } finally {
    if (root) await act(async () => root.unmount());
    await vite.close();
    dom.happyDOM.abort();
    globalThis.fetch = originalFetch;
  }
});
