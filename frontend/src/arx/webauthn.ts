/**
 * USR2 phase 4: the browser half of a passkey ceremony. The server sends WebAuthn options with every binary field as base64url
 * (services/local_passkeys.py); these helpers turn them into the ArrayBuffers `navigator.credentials` wants and the answer back into
 * the JSON the server verifies (the shape of PublicKeyCredential.toJSON()). No secret ever passes through here: the private key never
 * leaves the authenticator. Pure functions except `createPasskey` / `getPasskey`, which call the browser.
 */

export function b64urlToBytes(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

type Descriptor = { type: 'public-key'; id: string; transports?: string[] };

export interface CreationOptionsJSON {
  rp: { id: string; name: string };
  user: { id: string; name: string; displayName: string };
  challenge: string;
  pubKeyCredParams: { type: 'public-key'; alg: number }[];
  timeout?: number;
  attestation?: AttestationConveyancePreference;
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  excludeCredentials?: Descriptor[];
}

export interface RequestOptionsJSON {
  challenge: string;
  rpId: string;
  timeout?: number;
  userVerification?: UserVerificationRequirement;
  allowCredentials?: Descriptor[];
}

function descriptor(d: Descriptor): PublicKeyCredentialDescriptor {
  return { type: 'public-key', id: b64urlToBytes(d.id) as BufferSource, ...(d.transports ? { transports: d.transports as AuthenticatorTransport[] } : {}) };
}

export function toCreationOptions(o: CreationOptionsJSON): PublicKeyCredentialCreationOptions {
  return {
    rp: o.rp,
    user: { id: b64urlToBytes(o.user.id) as BufferSource, name: o.user.name, displayName: o.user.displayName },
    challenge: b64urlToBytes(o.challenge) as BufferSource,
    pubKeyCredParams: o.pubKeyCredParams,
    timeout: o.timeout,
    attestation: o.attestation ?? 'none',
    authenticatorSelection: o.authenticatorSelection,
    excludeCredentials: (o.excludeCredentials ?? []).map(descriptor),
  };
}

export function toRequestOptions(o: RequestOptionsJSON): PublicKeyCredentialRequestOptions {
  return {
    challenge: b64urlToBytes(o.challenge) as BufferSource,
    rpId: o.rpId,
    timeout: o.timeout,
    userVerification: o.userVerification ?? 'preferred',
    allowCredentials: (o.allowCredentials ?? []).map(descriptor),
  };
}

/** The JSON the server verifies. Only public material: ids, client data, authenticator data, the signature / attestation. */
export function credentialToJSON(cred: PublicKeyCredential): Record<string, unknown> {
  const r = cred.response as AuthenticatorAttestationResponse & AuthenticatorAssertionResponse;
  const response: Record<string, unknown> = { clientDataJSON: bytesToB64url(r.clientDataJSON) };
  if ('attestationObject' in r && r.attestationObject) {
    response.attestationObject = bytesToB64url(r.attestationObject);
    const transports = typeof r.getTransports === 'function' ? r.getTransports() : [];
    if (transports.length) response.transports = transports;
  } else {
    response.authenticatorData = bytesToB64url(r.authenticatorData);
    response.signature = bytesToB64url(r.signature);
    if (r.userHandle) response.userHandle = bytesToB64url(r.userHandle);
  }
  return { id: cred.id, rawId: bytesToB64url(cred.rawId), type: 'public-key', response };
}

export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function' && !!navigator.credentials?.create;
}

/** The passkey ceremony failed on the device side (cancelled, timed out, no matching credential) - never a server answer. */
export class PasskeyCancelled extends Error {}

export async function createPasskey(o: CreationOptionsJSON): Promise<Record<string, unknown>> {
  try {
    const cred = (await navigator.credentials.create({ publicKey: toCreationOptions(o) })) as PublicKeyCredential | null;
    if (!cred) throw new PasskeyCancelled('no credential');
    return credentialToJSON(cred);
  } catch (err) {
    if (err instanceof PasskeyCancelled) throw err;
    throw new PasskeyCancelled(err instanceof Error ? err.name : 'error');
  }
}

export async function getPasskey(o: RequestOptionsJSON): Promise<Record<string, unknown>> {
  try {
    const cred = (await navigator.credentials.get({ publicKey: toRequestOptions(o) })) as PublicKeyCredential | null;
    if (!cred) throw new PasskeyCancelled('no credential');
    return credentialToJSON(cred);
  } catch (err) {
    if (err instanceof PasskeyCancelled) throw err;
    throw new PasskeyCancelled(err instanceof Error ? err.name : 'error');
  }
}
