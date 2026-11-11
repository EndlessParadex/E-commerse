import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientIpResolver } from './clientIp.js';

// The production chain is visitor -> Cloudflare -> Caddy -> Node. These tests pin the
// reasoning written in deploy/Caddyfile and docs/DEPLOY-PRODUKSI.md to the app's real logic.
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const envExample = read('../deploy/bam.env.example');
const caddyfile = read('../deploy/Caddyfile');
const trusted = envExample.match(/^BAM_TRUSTED_PROXIES=(.*)$/m)[1];
const request = (peer, forwarded) => ({
  socket: { remoteAddress: peer },
  headers: forwarded ? { 'x-forwarded-for': forwarded } : {},
});

test('production proxy settings resolve the visitor, not the Cloudflare edge', () => {
  const clientIp = clientIpResolver(trusted);
  const visitor = '203.0.113.7';
  const cloudflareEdge = '172.64.0.9';

  // Caddy overwrites X-Forwarded-For with the one address it resolved from Cloudflare.
  assert.equal(clientIp(request('127.0.0.1', visitor)), visitor);
  assert.equal(clientIp(request('::1', visitor)), visitor);

  // Without that overwrite Caddy appends the edge address, and every buyer behind the
  // same edge would share one rate-limit bucket. This is the mistake the Caddyfile avoids.
  assert.equal(clientIp(request('127.0.0.1', `${visitor}, ${cloudflareEdge}`)), cloudflareEdge);

  // A request that somehow reaches Node directly cannot claim another address.
  assert.equal(clientIp(request('198.51.100.20', visitor)), '198.51.100.20');
});

test('deploy files keep the pieces that make that chain work', () => {
  assert.equal(trusted, '127.0.0.1/32,::1/128');
  assert.match(caddyfile, /^\s*client_ip_headers CF-Connecting-IP$/m);
  assert.match(caddyfile, /^\s*header_up X-Forwarded-For \{client_ip\}$/m);
  assert.match(caddyfile, /^\s*health_uri \/api\/health$/m);
  // Caddy must trust Cloudflare only: no private ranges, no wildcard.
  const proxies = caddyfile.match(/^\s*trusted_proxies static (.*)$/m)[1].split(/\s+/);
  assert.ok(proxies.length >= 20);
  assert.ok(
    proxies.every((range) => /^[0-9a-f.:]+\/\d+$/i.test(range)),
    proxies.join(' '),
  );
  assert.ok(!proxies.some((range) => /^(10\.|192\.168\.|127\.|0\.0\.0\.0|::\/0)/.test(range)));
  // One writer only: the service must start exactly one server process.
  assert.equal(read('../deploy/bam.service').match(/^ExecStart=/gm).length, 1);
});

test('Cloudflare Tunnel chain: cloudflared on this machine, no Caddy', () => {
  // visitor -> Cloudflare -> cloudflared (127.0.0.1) -> Node. Cloudflare sets X-Forwarded-For
  // to the visitor, or appends the visitor to whatever the visitor sent.
  const clientIp = clientIpResolver(trusted);
  const visitor = '203.0.113.7';
  assert.equal(clientIp(request('127.0.0.1', visitor)), visitor);
  // A visitor who sends a fake X-Forwarded-For still resolves to the address Cloudflare saw.
  assert.equal(clientIp(request('127.0.0.1', `10.9.9.9, ${visitor}`)), visitor);

  const tunnel = read('../deploy/cloudflared-config.yml');
  const port = envExample.match(/^PORT=(\d+)$/m)[1];
  assert.match(tunnel, new RegExp(`^\\s*service: http://127\\.0\\.0\\.1:${port}$`, 'm'));
  // cloudflared refuses a config whose ingress list does not end in a catch-all rule.
  assert.match(tunnel.trimEnd(), /- service: http_status:404$/);
});
