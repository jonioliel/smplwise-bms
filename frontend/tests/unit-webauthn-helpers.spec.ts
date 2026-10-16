import { test, expect } from '@playwright/test';
import { b64urlToBytes, bytesToB64url, credentialToJSON, toCreationOptions, toRequestOptions } from '../src/arx/webauthn';

// USR2 phase 4: the browser half of a passkey ceremony, node-only (no page, no browser launched). The server sends base64url; the
// helpers must round-trip every byte, keep the exact ids, never invent fields, and send back only public material.
//   npx playwright test tests/unit-webauthn-helpers.spec.ts --project=desktop

const bytes = (...v: number[]) => new Uint8Array(v);

test('base64url round-trips every byte value without padding or + /', () => {
  const all = new Uint8Array(256).map((_, i) => i);
  const enc = bytesToB64url(all);
  expect(enc).not.toMatch(/[+/=]/);
  expect(Array.from(b64urlToBytes(enc))).toEqual(Array.from(all));
  for (let n = 0; n < 5; n++) expect(Array.from(b64urlToBytes(bytesToB64url(all.slice(0, n))))).toEqual(Array.from(all.slice(0, n)));
  expect(bytesToB64url(bytes(0xfb, 0xff))).toBe('-_8');
});

test('creation options become ArrayBuffers with attestation none by default', () => {
  const o = toCreationOptions({
    rp: { id: 'arx.example.com', name: 'SmplWise Arx' },
    user: { id: bytesToB64url(bytes(1, 2, 3)), name: 'maria', displayName: 'Maria' },
    challenge: bytesToB64url(bytes(9, 9, 9, 9)),
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
    excludeCredentials: [{ type: 'public-key', id: bytesToB64url(bytes(7, 7)), transports: ['internal'] }],
  });
  expect(o.attestation).toBe('none');
  expect(Array.from(o.user.id as Uint8Array)).toEqual([1, 2, 3]);
  expect(Array.from(o.challenge as Uint8Array)).toEqual([9, 9, 9, 9]);
  expect(o.excludeCredentials?.[0].transports).toEqual(['internal']);
  expect(o.authenticatorSelection?.userVerification).toBe('required');
});

test('request options keep the RP id and an empty allow list for passkey first', () => {
  const o = toRequestOptions({ challenge: bytesToB64url(bytes(5)), rpId: 'arx.example.com', userVerification: 'required', allowCredentials: [] });
  expect(o.rpId).toBe('arx.example.com');
  expect(o.allowCredentials).toEqual([]);
  expect(o.userVerification).toBe('required');
  expect(toRequestOptions({ challenge: 'AA', rpId: 'x.example' }).userVerification).toBe('preferred');
});

test('an assertion is serialised with public material only', () => {
  const buf = (a: number[]) => new Uint8Array(a).buffer;
  const fake = {
    id: bytesToB64url(bytes(1, 1)),
    rawId: buf([1, 1]),
    type: 'public-key',
    response: { clientDataJSON: buf([123, 125]), authenticatorData: buf([0, 1]), signature: buf([2, 3]), userHandle: buf([4]) },
  } as unknown as PublicKeyCredential;
  const j = credentialToJSON(fake) as { id: string; rawId: string; type: string; response: Record<string, string> };
  expect(j).toEqual({ id: 'AQE', rawId: 'AQE', type: 'public-key', response: { clientDataJSON: 'e30', authenticatorData: 'AAE', signature: 'AgM', userHandle: 'BA' } });
});

test('a registration is serialised with the attestation object and the transports', () => {
  const buf = (a: number[]) => new Uint8Array(a).buffer;
  const fake = {
    id: 'AQE',
    rawId: buf([1, 1]),
    type: 'public-key',
    response: { clientDataJSON: buf([123, 125]), attestationObject: buf([160]), getTransports: () => ['hybrid', 'internal'] },
  } as unknown as PublicKeyCredential;
  const j = credentialToJSON(fake) as { response: Record<string, unknown> };
  expect(j.response).toEqual({ clientDataJSON: 'e30', attestationObject: 'oA', transports: ['hybrid', 'internal'] });
});
