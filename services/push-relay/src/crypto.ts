/** Small Web Crypto helpers shared by the relay's handlers and the APNs / FCM signers. */

const enc = new TextEncoder();

export function b64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof data === 'string' ? enc.encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(text: string): Uint8Array<ArrayBuffer> {
  const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4));
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A random opaque token: `rt_` + 32 random bytes, base64url (43 characters). */
export function newRelayToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return 'rt_' + b64url(bytes);
}

/** Constant-time comparison of two short strings (the server key check). */
export function timingSafeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** PEM (PKCS#8) text → the DER bytes, tolerant of header lines and whitespace (the secret is pasted as one line or many). */
export function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  return b64urlDecode(body.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
}

/** A compact JWS: `base64url(header).base64url(payload).base64url(signature)`. */
export async function signJwt(header: Record<string, unknown>, payload: Record<string, unknown>, key: CryptoKey, alg: 'ES256' | 'RS256'): Promise<string> {
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const params = alg === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5' };
  const sig = await crypto.subtle.sign(params, key, enc.encode(signingInput));
  return `${signingInput}.${b64url(sig)}`;
}
