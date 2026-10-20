import { CatalogError } from './catalog.js';

// Server-only credentials. Never use VITE_ variables or return these values to the browser.
export function createWhatsAppOtpSender(env = process.env, request = globalThis.fetch) {
  const token = env.BAM_WHATSAPP_TOKEN || '',
    phoneId = env.BAM_WHATSAPP_PHONE_ID || '',
    template = env.BAM_WHATSAPP_OTP_TEMPLATE || '',
    version = env.BAM_WHATSAPP_API_VERSION || '',
    language = env.BAM_WHATSAPP_OTP_LANGUAGE || 'id';
  const enabled = Boolean(token && phoneId && template && version);
  if (
    enabled &&
    (!/^\d{5,30}$/.test(phoneId) ||
      !/^[a-z0-9_]{1,512}$/.test(template) ||
      !/^v\d{1,3}\.\d{1,2}$/.test(version) ||
      !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language) ||
      /[\r\n]/.test(token))
  )
    throw new Error(
      'Konfigurasi WhatsApp OTP tidak valid. Periksa ID pengirim, template, bahasa dan versi API.',
    );
  return {
    enabled,
    async send({ phone, code }) {
      if (!enabled)
        throw new CatalogError(
          'Verifikasi WhatsApp belum diaktifkan.',
          503,
          'whatsapp_unavailable',
        );
      if (!/^\+628\d{8,11}$/.test(phone) || !/^\d{6}$/.test(code))
        throw new Error('Invalid OTP delivery input');
      try {
        const response = await request(
          `https://graph.facebook.com/${version}/${phoneId}/messages`,
          {
            method: 'POST',
            redirect: 'error',
            signal: AbortSignal.timeout(10000),
            headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: phone.slice(1),
              type: 'template',
              template: {
                name: template,
                language: { code: language },
                components: [
                  { type: 'body', parameters: [{ type: 'text', text: code }] },
                  {
                    type: 'button',
                    sub_type: 'url',
                    index: '0',
                    parameters: [{ type: 'text', text: code }],
                  },
                ],
              },
            }),
          },
        );
        const payload = await response.json();
        if (!response.ok || typeof payload.messages?.[0]?.id !== 'string')
          throw new Error('Delivery not accepted');
      } catch {
        // Provider errors may echo recipients, templates, tokens, or OTPs. Do not propagate them.
        throw new CatalogError(
          'Pengiriman belum dapat dipastikan. Jika kode tiba di WhatsApp, Anda tetap dapat memasukkannya. Jika tidak, tunggu sebelum meminta kode baru.',
          503,
          'whatsapp_delivery_unknown',
        );
      }
    },
  };
}
