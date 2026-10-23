# APPREFRESH-DEVICEKEY-SPEC - Device-bound key for the app refresh token (contract for the Android and iOS teams)

Version: **v1** (`arx-app-pop-v1`), 2026-10-23. Server side: branch `pilot/APPREFRESH2-295` (on top of `pilot/APPREFRESH-295`).
Design record: `docs/changes/CR-APPREFRESH295.md` section 13. The rest of the refresh-token flow (mint, rotation, the 20 s retry grace,
single-flight, timeouts, sign-out) is in that CR, sections 4-5 and 12; this document adds only what the device key changes.

The words MUST / MUST NOT / SHOULD are used in their RFC 2119 sense.

## 1. Purpose

A refresh token copied off the phone (a backup, a rooted phone, a debugging proxy, a crash dump) must be useless without the phone.
The app therefore creates a **hardware-bound ECDSA P-256 key pair** when it saves a sign-in, sends only the **public key** with the mint
request, and signs every refresh with the private key. The server verifies each signature against the key it registered.

## 2. The key

| | Android | iOS |
|---|---|---|
| Where | Android Keystore, `KeyGenParameterSpec` with `KeyProperties.KEY_ALGORITHM_EC`, `ECGenParameterSpec("secp256r1")`, purpose `PURPOSE_SIGN`, digest `DIGEST_SHA256`; `setIsStrongBoxBacked(true)` where `PackageManager.FEATURE_STRONGBOX_KEYSTORE` exists, TEE otherwise | Secure Enclave: `SecKeyCreateRandomKey` with `kSecAttrKeyTypeECSECPrimeRandom`, 256 bits, `kSecAttrTokenIDSecureEnclave`, or CryptoKit `SecureEnclave.P256.Signing.PrivateKey` |
| Exportable | MUST NOT be exportable (Keystore keys never are) | MUST be a Secure Enclave key (never exportable) |
| Backup | not in a backup by construction | access `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (or stricter); never synchronised to iCloud Keychain |
| User authentication | SHOULD NOT require user authentication per use (a background refresh must work); MAY use `setUnlockedDeviceRequired(true)` | SHOULD NOT add `.userPresence` / biometry flags for the same reason |
| Signing call | `Signature.getInstance("SHA256withECDSA")` -> DER signature | `SecKeyCreateSignature(key, .ecdsaSignatureMessageX962SHA256, data)` -> DER; CryptoKit `signature(for: data).derRepresentation` |
| Public key bytes | `publicKey.encoded` = X.509 SubjectPublicKeyInfo DER (91 bytes) | `SecKeyCopyExternalRepresentation(pub)` / CryptoKit `publicKey.x963Representation` = 65 bytes `04 || X || Y` |

One key per saved sign-in (family). A new mint SHOULD create a new key pair (section 6) and delete the old one.
Algorithm name on the wire: **`ES256`** (ECDSA over P-256 with SHA-256). No other algorithm is accepted.

## 3. Encodings

- **base64url** everywhere = RFC 4648 section 5 alphabet (`A-Z a-z 0-9 - _`), **no padding** (the server tolerates trailing `=`).
- **`public_key`**: base64url of EITHER the SubjectPublicKeyInfo DER (Android) OR the 65-byte uncompressed point `04||X||Y` (iOS). Compressed
  points, other curves (P-384, P-521, secp256k1), RSA and Ed25519 are refused (`422 device_key_invalid`). The server normalises to SPKI DER;
  the key's identity is `fingerprint = SHA-256(SPKI DER)`.
- **`sig`**: base64url of EITHER the DER `ECDSA-Sig-Value` (`SEQUENCE { r INTEGER, s INTEGER }`, 8..72 bytes - what both platforms return
  natively) OR the 64-byte raw `r || s` (each 32 bytes big-endian, left-padded with zeros; JOSE style, CryptoKit `rawRepresentation`).
  **A signature that decodes to exactly 64 bytes is always read as raw `r||s`.** Recommended: send the DER form the platform returns.
- **`ts`**: a JSON integer, Unix time in whole seconds (UTC). Not a string.
- **`token_digest`**: base64url (no padding) of SHA-256 over the ASCII bytes of the refresh token (`arxr_...`) the request presents.

## 4. What is signed (exact bytes)

The message is the UTF-8 encoding of six lines joined by a single LF (`0x0A`), **no trailing LF**, no spaces, no CR:

```
arx-app-pop-v1
<purpose>
<device_id>
<nonce>
<ts>
<last>
```

| Purpose | `<device_id>` | `<nonce>` | `<ts>` | `<last>` |
|---|---|---|---|---|
| `mint` | the `device_id` of the mint request | the single character `-` | the proof's `ts` (decimal, no sign, no leading zeros) | the `public_key` field **verbatim** as sent |
| `refresh` | the `device_id` of the refresh request | the nonce from the challenge, verbatim (`arxn_...`) | the proof's `ts` | `token_digest` of the refresh token sent in the same request |

The platform hashes the message itself (SHA-256 inside `SHA256withECDSA` / `.ecdsaSignatureMessageX962SHA256` / CryptoKit
`signature(for:)`): the app passes the message bytes, NOT a pre-computed digest.

Test vector for the byte layout (the server test `test_the_signed_strings_are_exactly_the_documented_ones` pins it):
`refresh_message("dev_a", "arxn_n", 1900000000, "arxr_t")` =
`arx-app-pop-v1\nrefresh\ndev_a\narxn_n\n1900000000\n` + base64url(SHA-256("arxr_t")).
`mint_message("dev_a", 1900000000, "PUBKEY")` = `arx-app-pop-v1\nmint\ndev_a\n-\n1900000000\nPUBKEY`.

## 5. The calls

All paths are under the remote channel prefix `/arx/api/v1`. While `security.app_refresh` is off, or on the local channel, every public
route answers the same `404` (CR section 5: keep today's behaviour).

### 5.1 Mint (session cookie, as in the CR) - with the key

```
POST /auth/app/refresh-tokens
{ "device_id": "dev_...", "install_id": "...",
  "device_key": { "alg": "ES256", "public_key": "<base64url>",
                  "proof": { "ts": 1900000000, "sig": "<base64url: sign(mint message)>" } } }
201 { ...the CR's fields..., "device_key": { "bound": true, "alg": "ES256" }, "proof_required": true }
```

`device_key` is optional on the wire; the server's mode decides (section 7). Answers specific to the key:

| Status / code | Meaning | App action |
|---|---|---|
| `201` with `device_key.bound = false` | the server did not bind a key (mode `off`, or no key sent) | refresh WITHOUT a proof (slice-1 behaviour); keep the key pair for a later mint |
| `422 device_key_required` | mode `required` and no `device_key` | generate a key, mint again |
| `422 device_key_invalid` | the public key is not a P-256 key in one of the two encodings | app bug; report |
| `422 device_key_proof_invalid` | the mint signature does not verify, or `ts` is more than 300 s off the server clock | check the byte layout / the phone clock |
| `409 device_key_in_use` | this public key is bound to a live sign-in of ANOTHER device | generate a new key pair (never share a key between installs) |

A refused key never ends the device's existing saved sign-in.

### 5.2 Challenge (no cookie) - one nonce per refresh attempt

```
POST /auth/app/refresh-challenge
{ "device_id": "dev_..." }
200 { "nonce": "arxn_<43 base64url>", "expires_in": 120, "expires_at": "2030-03-17T17:48:20Z", "server_time": 1900000000 }
429 rate_limited { details.retry_after_s }
```

The answer has the same shape for any device id (an unknown one gets a nonce that is stored nowhere). A nonce is **single use** and valid
**120 s**; it belongs to the device's current saved sign-in only. The server keeps at most 5 open nonces per sign-in (older ones are
dropped), and answers at most 10 challenges in a burst / 30 per minute per sign-in.

### 5.3 Refresh (no cookie) - with the proof

```
POST /auth/app/refresh
{ "refresh_token": "arxr_...", "device_id": "dev_...", "install_id": "...",
  "proof": { "nonce": "arxn_...", "ts": 1900000003, "sig": "<base64url: sign(refresh message)>" } }
200 { ...the CR's fields..., "device_key": { "bound": true, "alg": "ES256" }, "proof_required": true }
```

| Status / code | Meaning | App action |
|---|---|---|
| `200` | rotated: store the new refresh token (Keychain / Keystore), use the access token | - |
| `401 app_refresh_proof_retry`, `details.reason = "nonce"` | the nonce is unknown, expired, already used, or not this sign-in's. **The refresh token was NOT consumed** | get a new challenge, sign again, retry ONCE with the SAME refresh token |
| `401 app_refresh_proof_retry`, `details.reason = "clock"` | the signature is valid but `ts` is more than 300 s from `details.server_time`. The nonce is consumed, the token is not | get a new challenge; sign with `ts = server_time + (seconds elapsed since the challenge answer)`; retry once |
| `401 app_refresh_invalid` | the saved sign-in ended (a missing or wrong signature over a valid token ends it, so does any CR reason) | forget the refresh token AND delete the key pair; show the sign-in |
| `401 app_refresh_expired`, `404`, `429` | as in the CR section 5 | as in the CR |

**Every** refresh attempt needs its own challenge and its own signature - including the retry of a lost answer inside the 20 s grace
(CR section 4.2): the app MUST NOT re-send a previous request body. With the single-flight rule (CR F-06) the sequence is:
challenge -> sign -> refresh; on a network error: challenge -> sign -> refresh again with the same token, all inside 20 s of the first
refresh (the request timeout stays below 20 s, CR F-05; budget the challenge round trip inside it).

### 5.4 Unchanged

`POST /auth/app/sign-out` needs no proof (it can only end the sign-in). `GET /auth/app/whoami` and the access token are bearer tokens
(minutes); they are not signed in v1 (see section 9, open question 3).

## 6. Rotation, replacement, re-registration

- **Key rotation = re-mint.** To replace the key (a new phone, Keystore key invalidated by a lock-screen change, a suspected compromise, a
  periodic rotation), the app creates a new key pair and calls the mint again from a signed-in session (the CR's freshness rule applies:
  a sign-in at most 15 minutes old). The new sign-in replaces the old one of the device (`replaced`); the old key is then useless. There
  is no "change key with the old key" call in v1.
- **The same key re-minted on the same device** is accepted (the old sign-in is replaced); on ANOTHER device it is refused (`409`).
- **Device re-registration** (`POST /presence/devices` of the same install) ends the device's saved sign-in (`device_reregistered`, CR
  4.3); the app mints again with a NEW key pair. A proof made with the previous registration's key never verifies against the new one.
- **Reinstall / app data cleared:** the Keystore / Keychain key is gone; the old sign-in cannot refresh (the next refresh attempt without
  the key ends it); the user signs in and the app mints with a new key.

## 7. Server modes (`security.app_refresh_device_key`)

| Mode | New mint | Refresh of a sign-in WITH a key | Refresh of a sign-in WITHOUT a key |
|---|---|---|---|
| `off` | no key is bound (the field is ignored; answer `bound: false`) | **proof required** (a bound key is never dropped by a setting) | allowed |
| `optional` (default; the lab) | the key is bound when sent | proof required | allowed |
| `required` (before customers) | `422 device_key_required` without a key | proof required | **ended** (`device_key_required`); switching to `required` ends every keyless sign-in at once |

The app MUST always send `device_key` once it implements this contract (it works under all three modes).

## 8. Revocation and audit (what the app sees)

Every CR revocation path ends a keyed sign-in exactly as before; the key and its open nonces go with it. The server's audit rows carry
only a 16-hex prefix of the key fingerprint at mint, never the public key, a signature or a nonce. Nonces are stored as hashes.

## 9. Open questions (server side; the app contract above does not depend on them)

1. **Attestation.** The server cannot tell a hardware key from a software key. Android Key Attestation (certificate chain) / iOS App Attest
   would prove it. Proposed as a later version (`arx-app-pop-v2`), with the chain sent at mint.
2. **Administrators' MFA rule** (`remote.require_mfa_admin`): enforced at the HA sign-in the mint needs (at most 15 minutes old); not
   re-checked at refresh (it needs a live HA sign-in). Recorded in the CR, section 13.7.
3. **Signed access tokens** (DPoP for every API call): not in v1; the access token stays a minutes-long bearer token. To decide together
   with the session exchange slice.
