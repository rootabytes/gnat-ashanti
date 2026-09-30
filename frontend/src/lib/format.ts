import { MAIN_REGION, siteOrigin } from './sites';

export function fmtPhone(p?: string | null) {
  if (!p) return '';
  const m = /^\+233(\d{2})(\d{3})(\d{4})$/.exec(p);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : p;
}

export function fmtDate(d?: string | null, withTime = false) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function timeAgo(d?: string | null) {
  if (!d) return '';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(d);
}

/** wa.me link; with no phone WhatsApp lets the user pick a chat. */
export function whatsappLink(text: string, phone?: string | null) {
  const num = phone ? phone.replace(/[^\d]/g, '') : '';
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

/**
 * sms: link that opens the sender's own messaging app with the text filled in,
 * for anyone without WhatsApp. No SMS provider or cost to the system; the
 * sender's normal SMS rate applies. "?&body=" works on both Android and iPhone.
 */
export function smsLink(text: string, phone?: string | null) {
  return `sms:${phone ?? ''}?&body=${encodeURIComponent(text)}`;
}

export function accessLink(code: string) {
  return `${siteOrigin()}/?code=${encodeURIComponent(code)}`;
}

export function districtInviteMessage(name: string, code: string) {
  return `GNAT Mapping: ${name} District\n\nPlease open this link to fill in your district's mapping form:\n${accessLink(code)}\n\nYour access code: ${code}\nKeep this code private.`;
}

/** Sign-in details for a new admin, sent from the super admin's own WhatsApp or SMS. */
export function adminInviteMessage(name: string, access: string, phone: string | null, tempPassword: string, regionCode: string | null) {
  return [
    'GNAT Mapping: admin access',
    '',
    `Hello ${name}, you are now an admin for ${access}.`,
    '',
    `Sign in here: ${siteOrigin(regionCode ?? MAIN_REGION)}/admin`,
    `Phone number: ${fmtPhone(phone)}`,
    `Temporary password: ${tempPassword}`,
    '',
    'When you sign in, add your email and choose your own password. The temporary password works for 7 days. Please delete this message afterwards.',
  ].join('\n');
}

export function localInviteMessage(localName: string, districtName: string, code: string) {
  return `GNAT Mapping: ${localName} Local (${districtName} District)\n\nPlease open this link and list the basic units / workplaces in your local:\n${accessLink(code)}\n\nYour access code: ${code}\nKeep this code private.`;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Ghana Post GPS digital address, same rules as the server: AK0395028 → AK-039-5028. */
export function normalizeGps(s: string): string | null {
  const m = /^([A-Z]{2})[\s-]*(\d{3,4}?)[\s-]*(\d{3,4})$/.exec(s.trim().toUpperCase());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
