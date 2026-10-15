import proxyaddr from 'proxy-addr';
import { isIP } from 'node:net';

export function clientIpResolver(value = process.env.BAM_TRUSTED_PROXIES || '') {
  const addresses = Array.isArray(value)
    ? value
    : String(value)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
  if (
    addresses.some((x) =>
      ['*', '0.0.0.0/0', '::/0', 'loopback', 'linklocal', 'uniquelocal'].includes(x),
    )
  )
    throw new Error('Use explicit trusted proxy IPs or CIDRs.');
  const trust = addresses.length ? proxyaddr.compile(addresses) : () => false;
  return (req) => {
    const peer = req.socket?.remoteAddress;
    if (!peer || !isIP(peer)) return 'local';
    const forwarded = req.headers['x-forwarded-for'];
    if (
      forwarded &&
      (typeof forwarded !== 'string' || forwarded.length > 2048 || forwarded.split(',').length > 32)
    )
      return peer;
    try {
      const result = proxyaddr({ ...req, socket: { remoteAddress: peer } }, trust);
      return isIP(result) ? result : peer;
    } catch {
      return peer;
    }
  };
}
