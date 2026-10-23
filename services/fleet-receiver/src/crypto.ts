/** CR-FLEET215: Web Crypto helpers - Ed25519 verification of a fleet report, the enrollment code, a constant-time compare. */

const enc = new TextEncoder();

/** The domain-separation prefix the add-on signs in front of the body (services/fleet_keys.CONTEXT). */
export const CONTEXT = 'smplwise-fleet-report/1\n';

export function b64decode(text: string): Uint8Array<ArrayBuffer> {
  const bin = atob(text);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function b64encode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function b64urlToStd(text: string): string {
  const s = text.replace(/-/g, '+').replace(/_/g, '/');
  return s + '='.repeat((4 - (s.length % 4)) % 4);
}

export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The key id the add-on uses (services/signing.kid_of): the first 16 hex of SHA-256 over the raw 32-byte public key. */
export async function kidOf(publicKeyB64: string): Promise<string> {
  return (await sha256Hex(b64decode(publicKeyB64))).slice(0, 16);
}

/** Does `signatureB64` verify over CONTEXT + body under `publicKeyB64`? Never throws. */
export async function verifyReport(publicKeyB64: string, body: string, signatureB64: string): Promise<boolean> {
  try {
    const raw = b64decode(publicKeyB64);
    const sig = b64decode(signatureB64);
    if (raw.length !== 32 || sig.length !== 64) return false;
    const key = await crypto.subtle.importKey('raw', raw, { name: 'Ed25519' }, false, ['verify']);
    const data = enc.encode(CONTEXT + body);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, sig, data);
  } catch {
    return false;
  }
}

export interface Enrollment {
  installation_id: string;
  kid: string;
  public_key: string;
}

/** `arx-fleet-1.<32 hex id>.<16 hex kid>.<public key base64url>` -> the facts, or null when malformed or the kid does not match the key. */
export async function parseEnrollment(code: string): Promise<Enrollment | null> {
  const m = /^arx-fleet-1\.([0-9a-f]{32})\.([0-9a-f]{16})\.([A-Za-z0-9_-]{43})$/.exec(code.trim());
  if (!m) return null;
  const publicKey = b64urlToStd(m[3]);
  try {
    if (b64decode(publicKey).length !== 32) return null;
  } catch {
    return null;
  }
  if ((await kidOf(publicKey)) !== m[2]) return null;
  return { installation_id: m[1], kid: m[2], public_key: publicKey };
}

export function timingSafeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
