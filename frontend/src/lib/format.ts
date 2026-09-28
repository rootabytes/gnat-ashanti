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

export function accessLink(code: string) {
  return `${window.location.origin}/?code=${encodeURIComponent(code)}`;
}

export function districtInviteMessage(name: string, code: string) {
  return `GNAT Mapping: ${name} District\n\nPlease open this link to fill in your district's mapping form:\n${accessLink(code)}\n\nYour access code: ${code}\nKeep this code private.`;
}

export function localInviteMessage(localName: string, districtName: string, code: string) {
  return `GNAT Mapping: ${localName} Local (${districtName} District)\n\nPlease open this link and list the basic units / workplaces in your local:\n${accessLink(code)}\n\nYour access code: ${code}\nKeep this code private.`;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
