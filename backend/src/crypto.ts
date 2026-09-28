import crypto from 'node:crypto';
import { config } from './config';

// No 0/O, 1/I/L: codes are read aloud and typed on phones.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const lookupKey = crypto.createHash('sha256').update(`lookup:${config.jwtSecret}`).digest();
const encKey = crypto.createHash('sha256').update(`enc:${config.jwtSecret}`).digest();

/** A code like D-7K3P-Q9XM (district) or L-... (local). ~40 bits of randomness. */
export function generateCode(kind: 'D' | 'L'): string {
  const bytes = crypto.randomBytes(8);
  let s = '';
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `${kind}-${s.slice(0, 4)}-${s.slice(4)}`;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Deterministic keyed hash so a typed code can be found without storing it in plain text. */
export function codeLookup(code: string): string {
  return crypto.createHmac('sha256', lookupKey).update(normalizeCode(code)).digest('hex');
}

/** Codes are also stored encrypted so the admin and district chairmen can re-share them. */
export function encryptCode(code: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  const enc = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.');
}

export function decryptCode(stored: string): string | null {
  try {
    const [iv, tag, enc] = stored.split('.').map((s) => Buffer.from(s, 'base64url'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Temporary admin password like Gnat-7K3P-Q9XM: typeable from a WhatsApp message, replaced at first sign-in. */
export function generateTempPassword(): string {
  return `Gnat-${generateCode('D').slice(2)}`;
}

export function newCode(kind: 'D' | 'L') {
  const code = generateCode(kind);
  return { code, lookup: codeLookup(code), enc: encryptCode(code) };
}
