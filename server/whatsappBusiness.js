// Server-only credentials. Never use VITE_ variables or return these values to the browser.
const parameter = (value) =>
  String(value ?? '')
    // Meta rejects template values containing line breaks, tabs, or long runs of spaces.
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200) || '-';
const bodyParameters = (values) => ({
  type: 'body',
  parameters: values.map((value) => ({ type: 'text', text: parameter(value) })),
});

export function createWhatsAppBusinessSender(env = process.env, request = globalThis.fetch) {
  const token = env.BAM_WHATSAPP_TOKEN || '',
    phoneId = env.BAM_WHATSAPP_PHONE_ID || '',
    version = env.BAM_WHATSAPP_API_VERSION || '',
    invoiceTemplate = env.BAM_WHATSAPP_INVOICE_TEMPLATE || '',
    updateTemplate = env.BAM_WHATSAPP_ORDER_TEMPLATE || '',
    language = env.BAM_WHATSAPP_TEMPLATE_LANGUAGE || 'id';
  const connected = Boolean(token && phoneId && version);
  if (
    connected &&
    (invoiceTemplate || updateTemplate) &&
    (!/^\d{5,30}$/.test(phoneId) ||
      !/^v\d{1,3}\.\d{1,2}$/.test(version) ||
      !/^[a-z0-9_]{0,512}$/.test(invoiceTemplate) ||
      !/^[a-z0-9_]{0,512}$/.test(updateTemplate) ||
      !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language) ||
      /[\r\n]/.test(token))
  )
    throw new Error(
      'Konfigurasi WhatsApp pesanan tidak valid. Periksa ID pengirim, template, bahasa dan versi API.',
    );
  const graph = (path, options) =>
    request(`https://graph.facebook.com/${version}/${phoneId}/${path}`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      ...options,
      headers: { authorization: 'Bearer ' + token, ...options.headers },
    });
  const deliver = async (work) => {
    try {
      await work();
    } catch {
      // Provider errors may echo recipients, templates, or tokens. Do not propagate them.
      throw new Error('WhatsApp delivery was not accepted');
    }
  };
  const sendTemplate = async (phone, name, components) => {
    if (!/^\+628\d{8,11}$/.test(phone)) throw new Error('Invalid recipient');
    const response = await graph('messages', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.slice(1),
        type: 'template',
        template: { name, language: { code: language }, components },
      }),
    });
    const payload = await response.json();
    if (!response.ok || typeof payload.messages?.[0]?.id !== 'string')
      throw new Error('Delivery not accepted');
  };
  return {
    invoiceReady: connected && Boolean(invoiceTemplate),
    updateReady: connected && Boolean(updateTemplate),
    sendInvoice: ({ phone, pdf, filename, parameters }) =>
      deliver(async () => {
        const form = new FormData();
        form.set('messaging_product', 'whatsapp');
        form.set('type', 'application/pdf');
        form.set('file', new Blob([pdf], { type: 'application/pdf' }), filename);
        const upload = await graph('media', { body: form });
        const media = await upload.json();
        if (!upload.ok || typeof media.id !== 'string') throw new Error('Upload not accepted');
        await sendTemplate(phone, invoiceTemplate, [
          {
            type: 'header',
            parameters: [{ type: 'document', document: { id: media.id, filename } }],
          },
          bodyParameters(parameters),
        ]);
      }),
    sendUpdate: ({ phone, parameters }) =>
      deliver(() => sendTemplate(phone, updateTemplate, [bodyParameters(parameters)])),
  };
}
