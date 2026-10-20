import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhatsAppOtpSender } from './whatsappOtp.js';

const env = {
  BAM_WHATSAPP_TOKEN: 'fixture-token-not-real',
  BAM_WHATSAPP_PHONE_ID: '123456789012345',
  BAM_WHATSAPP_API_VERSION: 'v99.0',
  BAM_WHATSAPP_OTP_TEMPLATE: 'fixture_auth',
  BAM_WHATSAPP_OTP_LANGUAGE: 'id',
};
test('Meta adapter sends the same OTP in the approved authentication body and copy-code button without exposing credentials in URLs', async () => {
  let sent;
  const sender = createWhatsAppOtpSender(env, async (url, options) => {
    sent = { url, ...options };
    return { ok: true, json: async () => ({ messages: [{ id: 'fixture-message-id' }] }) };
  });
  assert.equal(sender.enabled, true);
  await sender.send({ phone: '+6281234567890', code: '012345' });
  assert.equal(sent.url, 'https://graph.facebook.com/v99.0/123456789012345/messages');
  assert.equal(sent.redirect, 'error');
  assert.equal(sent.headers.authorization, 'Bearer ' + env.BAM_WHATSAPP_TOKEN);
  const body = JSON.parse(sent.body);
  assert.equal(body.to, '6281234567890');
  assert.equal(body.template.name, 'fixture_auth');
  assert.equal(body.template.components[0].parameters[0].text, '012345');
  assert.equal(body.template.components[1].parameters[0].text, '012345');
  assert.ok(!sent.url.includes(env.BAM_WHATSAPP_TOKEN));
  assert.ok(sent.signal instanceof AbortSignal);
});
test('Meta adapter is disabled without credentials, validates configuration, and sanitizes delivery errors', async () => {
  let called = false;
  const off = createWhatsAppOtpSender({}, async () => {
    called = true;
  });
  assert.equal(off.enabled, false);
  await assert.rejects(off.send({ phone: '+6281234567890', code: '012345' }), {
    code: 'whatsapp_unavailable',
  });
  assert.equal(called, false);
  assert.throws(
    () =>
      createWhatsAppOtpSender({ ...env, BAM_WHATSAPP_API_VERSION: '../../other?token=private' }),
    /Konfigurasi/,
  );
  const failed = createWhatsAppOtpSender(env, async () => ({
    ok: false,
    json: async () => ({ error: { message: 'private ' + env.BAM_WHATSAPP_TOKEN } }),
  }));
  await assert.rejects(failed.send({ phone: '+6281234567890', code: '012345' }), (error) => {
    assert.equal(error.code, 'whatsapp_delivery_unknown');
    assert.ok(!error.message.includes(env.BAM_WHATSAPP_TOKEN));
    assert.ok(!error.message.includes('012345'));
    return true;
  });
});
