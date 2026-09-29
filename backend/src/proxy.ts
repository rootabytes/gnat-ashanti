import { BlockList, isIPv6 } from 'node:net';

// Cloudflare's published edge ranges (https://www.cloudflare.com/ips/). When the API's
// custom domain is proxied (orange cloud), requests arrive as client → Cloudflare → Railway.
const CLOUDFLARE_V4 = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
];
const CLOUDFLARE_V6 = [
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

const cloudflare = new BlockList();
for (const r of CLOUDFLARE_V4) {
  const [net, bits] = r.split('/');
  cloudflare.addSubnet(net, Number(bits), 'ipv4');
}
for (const r of CLOUDFLARE_V6) {
  const [net, bits] = r.split('/');
  cloudflare.addSubnet(net, Number(bits), 'ipv6');
}

export function isCloudflare(ip: string) {
  const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)?.[1];
  if (v4) return cloudflare.check(v4, 'ipv4');
  return cloudflare.check(ip, isIPv6(ip) ? 'ipv6' : 'ipv4');
}

/**
 * Express "trust proxy": always trust the nearest hop (Railway's edge), and any further
 * hop only if it is Cloudflare. req.ip is then the real visitor with or without Cloudflare
 * in front, so rate limits apply per person rather than per Cloudflare server, and a
 * forged X-Forwarded-For sent straight to Railway is ignored.
 */
export function trustProxy(addr: string, hop: number) {
  return hop === 0 || isCloudflare(addr);
}
