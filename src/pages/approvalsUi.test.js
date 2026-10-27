import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { createApp, hashPassword } from '../../server/app.js';
import { seedSharedCart, sharedRequest } from '../../server/sharedCartFixture.js';

test('approval website: complete details, status filters, confirmed decisions, conflicts and stale responses', async () => {
  const api = createApp({
    dbPath: ':memory:',
    mailer: { enabled: false },
    mailConfig: {},
    logger: () => {},
  });
  const { actors } = seedSharedCart(api);
  const secret = 'approval-ui-fixture-only';
  const hash = await hashPassword(secret);
  api.db.prepare("UPDATE users SET password_hash=? WHERE id='owner'").run(hash);
  for (const [id, status] of [
    ['alice', 'pending'],
    ['bob', 'pending'],
    ['carol', 'rejected'],
    ['david', 'approved'],
  ]) {
    api.db
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        id,
        'Pendaftar ' + id,
        id + '@fixture.test',
        'Alamat pendaftaran ' + id,
        hash,
        '2026-10-27T01:00:00Z',
        'user',
      );
    api.db
      .prepare('INSERT INTO account_approvals(user_id,status,revision) VALUES(?,?,0)')
      .run(id, status);
  }
  api.db
    .prepare('INSERT INTO user_contact_phones(user_id,phone,revision) VALUES(?,?,?)')
    .run('alice', '+6281234567890', 'fixture');
  const dom = new Window({ url: 'http://fixture.test/#/admin/persetujuan' });
  const previous = Object.fromEntries(
    ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'].map((key) => [
      key,
      globalThis[key],
    ]),
  );
  Object.assign(globalThis, {
    window: dom,
    document: dom.document,
    HTMLElement: dom.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  dom.confirm = () => true;
  dom.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  dom.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
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
  let actor = 'owner',
    holdMutation = false,
    releaseMutation,
    failReads = false,
    heldQuery = '',
    releaseQuery;
  const requests = [];
  globalThis.fetch = async (path, options = {}) => {
    requests.push({
      path,
      method: options.method || 'GET',
      body: options.body && JSON.parse(options.body),
    });
    if (failReads && !options.body) return { ok: false, status: 503, json: async () => ({}) };
    const response = await sharedRequest(
      api,
      options.method || 'GET',
      path,
      actor,
      options.body && JSON.parse(options.body),
    );
    if (options.body && holdMutation)
      await new Promise((resolve) => {
        releaseMutation = resolve;
      });
    if (
      !options.body &&
      heldQuery &&
      new URL(path, 'http://fixture.test').searchParams.get('q') === heldQuery
    )
      await new Promise((resolve) => {
        releaseQuery = resolve;
      });
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => response.body,
    };
  };
  const { createRoot } = await import('react-dom/client');
  const container = dom.document.createElement('div');
  dom.document.body.append(container);
  const root = createRoot(container);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 15));
  const wait = async (check) => {
    const until = Date.now() + 4000;
    while (!check() && Date.now() < until) await act(settle);
    assert.ok(check(), container.textContent);
  };
  const click = async (element) =>
    act(async () => {
      assert.ok(element);
      element.click();
      await settle();
    });
  const fill = async (selector, value) =>
    act(async () => {
      const element = container.querySelector(selector);
      assert.ok(element, selector);
      const prototype =
        element.tagName === 'TEXTAREA'
          ? dom.HTMLTextAreaElement.prototype
          : element.tagName === 'SELECT'
            ? dom.HTMLSelectElement.prototype
            : dom.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
      element.dispatchEvent(
        new dom.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }),
      );
      await settle();
    });
  const row = (id) => container.querySelector('[data-approval-id="' + id + '"]');
  const button = (parent, label) =>
    [...parent.querySelectorAll('button')].find((node) => node.textContent === label);
  const confirm = () => container.querySelector('dialog .bam-dialog-actions button:last-child');
  try {
    const { default: Page } = await vite.ssrLoadModule('/src/pages/AdminApprovalsPage.jsx');
    const { DeliveryContext } = await vite.ssrLoadModule('/src/state/useDelivery.js');
    const render = async (user) =>
      act(async () => {
        root.render(
          createElement(
            DeliveryContext.Provider,
            { value: { user } },
            createElement(Page, { key: user.id }),
          ),
        );
        await settle();
      });
    await render({ ...actors.owner, isOwner: true });
    await wait(() => row('alice'));
    assert.deepEqual(
      [...container.querySelectorAll('.approval-summary-card strong')].map(
        (node) => node.textContent,
      ),
      ['2', '1', '1', '4'],
    );
    assert.equal(
      container.querySelector('#approval-status option[value="approved"]').textContent,
      'Disetujui',
    );
    await click(button(row('alice'), 'Lihat detail'));
    assert.match(
      container.querySelector('.approval-detail').textContent,
      /Alamat pendaftaran alice/,
    );
    assert.match(container.querySelector('.approval-detail').textContent, /6281234567890/);
    assert.match(container.querySelector('.approval-detail').textContent, /27 Okt 2026/);
    assert.equal(dom.document.activeElement.id, 'approval-detail-title');
    await click(button(container.querySelector('.approval-detail'), 'Tutup detail'));
    assert.equal(dom.document.activeElement.textContent, 'Lihat detail');
    await fill('#approval-status', 'approved');
    await wait(() => row('david'));
    assert.equal(button(row('david'), 'Setujui'), undefined);
    assert.equal(button(row('david'), 'Tolak'), undefined);
    await click(button(row('david'), 'Lihat detail'));
    assert.match(
      container.querySelector('.approval-detail').textContent,
      /Rincian keputusan belum tercatat/,
    );
    await fill('#approval-status', 'pending');
    await wait(() => row('alice'));
    await click(button(row('alice'), 'Tolak'));
    assert.equal(confirm().disabled, true);
    await fill('#approval-reason', 'Alamat perlu diperiksa kembali');
    await fill('#approval-password', secret);
    holdMutation = true;
    await act(async () => {
      confirm().click();
      confirm().click();
      await settle();
    });
    await wait(() => releaseMutation);
    assert.equal(requests.filter((request) => request.method === 'POST').length, 1);
    assert.equal(confirm().disabled, true);
    await act(async () => {
      holdMutation = false;
      releaseMutation();
      await settle();
    });
    await wait(() => !container.querySelector('dialog') && !row('alice') && row('bob'));
    assert.match(container.querySelector('.accounts-notice').textContent, /ditolak/);
    await fill('#approval-status', 'rejected');
    await wait(() => row('alice'));
    await click(button(row('alice'), 'Lihat detail'));
    assert.match(
      container.querySelector('.approval-detail').textContent,
      /Alamat perlu diperiksa kembali/,
    );
    assert.match(container.querySelector('.approval-detail').textContent, /Akun owner/);
    assert.equal(button(row('alice'), 'Tolak'), undefined);
    await click(button(row('alice'), 'Setujui'));
    await fill('#approval-password', secret);
    await click(confirm());
    await wait(() => !container.querySelector('dialog') && !row('alice'));
    await fill('#approval-status', 'pending');
    await wait(() => row('bob'));
    await click(button(row('bob'), 'Setujui'));
    api.accounts.reviewApproval(actors.operator, 'bob', {
      action: 'reject',
      revision: 0,
      reason: 'Pengelola lain memutuskan',
    });
    await fill('#approval-password', secret);
    await click(confirm());
    await wait(() => container.querySelector('dialog [role="alert"]'));
    assert.equal(confirm().disabled, true);
    assert.equal(container.querySelector('#approval-password'), null);
    await click(button(container.querySelector('dialog'), 'Tutup dan muat daftar terbaru'));
    await wait(() => container.querySelector('.approval-empty'));
    assert.match(
      container.querySelector('.approval-empty').textContent,
      /Tidak ada pendaftaran yang menunggu persetujuan/,
    );
    await fill('#approval-status', 'any');
    await wait(() => row('alice'));
    heldQuery = 'alice';
    await fill('#approval-search', 'alice');
    await wait(() => releaseQuery);
    assert.equal(
      container.querySelector('.approvals-table'),
      null,
      'outdated rows are not actionable while loading',
    );
    await fill('#approval-search', 'david');
    await wait(() => row('david'));
    await act(async () => {
      heldQuery = '';
      releaseQuery();
      await settle();
    });
    assert.ok(row('david'));
    assert.equal(row('alice'), null, 'late search cannot replace the current list');
    failReads = true;
    await click(button(container, 'Muat ulang'));
    await wait(() => container.querySelector('.accounts-error'));
    assert.equal(container.querySelector('.approvals-table'), null);
    failReads = false;
    await click(button(container, 'Coba muat ulang'));
    await wait(() => row('david'));
    await fill('#approval-search', 'not-found');
    await wait(() => container.querySelector('.approval-empty'));
    assert.match(container.querySelector('.approval-empty').textContent, /cocok/);
    assert.equal(
      api.db
        .prepare(
          "SELECT COUNT(*) AS n FROM account_management_audit WHERE action LIKE 'registration:%'",
        )
        .get().n,
      3,
    );
    for (let i = 0; i < 26; i++) {
      const id = 'page-' + i;
      api.db
        .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
        .run(
          id,
          'Pendaftar halaman ' + i,
          id + '@fixture.test',
          'Alamat pengujian halaman',
          hash,
          new Date(Date.UTC(2026, 9, 28, 0, i)).toISOString(),
          'user',
        );
      api.db
        .prepare("INSERT INTO account_approvals(user_id,status,revision) VALUES(?,'pending',0)")
        .run(id);
    }
    await fill('#approval-search', '');
    await fill('#approval-status', 'pending');
    await wait(() => row('page-25'));
    await click(button(container.querySelector('.accounts-pagination'), 'Berikutnya'));
    await wait(() => row('page-0'));
    assert.equal(container.querySelectorAll('[data-approval-id]').length, 1);
    await click(button(row('page-0'), 'Setujui'));
    await fill('#approval-password', secret);
    await click(confirm());
    await wait(
      () =>
        !container.querySelector('dialog') &&
        container.querySelectorAll('[data-approval-id]').length === 25,
    );
    assert.match(container.querySelector('.accounts-pagination').textContent, /Halaman 1 dari 1/);
    actor = 'operator';
    await render(actors.operator);
    await wait(() => row('page-25'));
    assert.equal(container.querySelector('.approval-owner-link'), null);
    assert.ok(button(row('page-25'), 'Setujui'));
    actor = 'buyer';
    await render(actors.buyer);
    assert.match(container.textContent, /Akses admin diperlukan/);
    assert.equal(container.querySelector('.approval-detail'), null);
  } finally {
    await act(async () => root.unmount());
    Object.assign(globalThis, previous);
    await vite.close();
    api.db.close();
    await dom.happyDOM.close();
  }
});
