# APPREFRESH-DEVICEKEY-SPEC - Device-bound key for the app refresh token (contract for the Android and iOS teams)

Version: **v1** (`arx-app-pop-v1`), 2026-10-23; **revision 2** (APPREFRESH3-295, the device-key pin: section 6a and the changed rows in
5.1 / 5.2 / 6, marked "rev 2"). Server side: branch `pilot/APPREFRESH2-295` (on top of `pilot/APPREFRESH-295`); revision 2 on
`pilot/APPREFRESH3-295`. The signed strings, the encodings and every request / response shape are UNCHANGED in revision 2; what changed is
WHEN the server asks for the old key's `replaces` proof (now also after the sign-in ended), plus one new error code and new admin routes.
Design record: `docs/changes/CR-APPREFRESH295.md` sections 13 and 14. The rest of the refresh-token flow (mint, rotation, the 20 s retry grace,
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

One key per device registration (rev 2: the server pins it to the `device_id`, section 6a). The app MUST keep the key pair across
sign-outs, re-registrations and new mints of the same install, and delete it only after a mint with a NEW key succeeded (a planned
rotation with `replaces`, or after an administrator-approved reset). Deleting the key early leaves the device needing an administrator.
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
| `replace` (signed by the OLD key, section 6) | the `device_id` of the mint request | a nonce from the challenge for the device (its current sign-in, or - rev 2 - the pinned device when no sign-in is live) | the `replaces.ts` | the NEW `public_key` field of the same mint request **verbatim** (`""` when the mint sends no key) |

The platform hashes the message itself (SHA-256 inside `SHA256withECDSA` / `.ecdsaSignatureMessageX962SHA256` / CryptoKit
`signature(for:)`): the app passes the message bytes, NOT a pre-computed digest.

Test vector for the byte layout (the server test `test_the_signed_strings_are_exactly_the_documented_ones` pins it):
`refresh_message("dev_a", "arxn_n", 1900000000, "arxr_t")` =
`arx-app-pop-v1\nrefresh\ndev_a\narxn_n\n1900000000\n` + base64url(SHA-256("arxr_t")).
`mint_message("dev_a", 1900000000, "PUBKEY")` = `arx-app-pop-v1\nmint\ndev_a\n-\n1900000000\nPUBKEY`.
`replace_message("dev_a", "arxn_n", 1900000000, "PUBKEY")` = `arx-app-pop-v1\nreplace\ndev_a\narxn_n\n1900000000\nPUBKEY`
(pinned by `test_d01_the_replace_string_is_exactly_the_documented_one`).

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
| `409 device_key_bound`, `details.reason` = `missing` / `nonce` / `invalid` / `clock` | rev 2: the device is PINNED to another key (whether or not a sign-in is live) - or the mint would leave it keyless - and `device_key.replaces` is missing or does not verify with the pinned key (sections 6, 6a) | holding the old key: challenge, sign the `replace` message, mint again. Without it: show "ask your administrator to reset this phone's security key" (section 6a); do NOT loop |

A refused key never ends the device's existing saved sign-in.

### 5.2 Challenge (no cookie) - one nonce per refresh attempt

```
POST /auth/app/refresh-challenge
{ "device_id": "dev_..." }
200 { "nonce": "arxn_<43 base64url>", "expires_in": 120, "expires_at": "2030-03-17T17:48:20Z", "server_time": 1900000000 }
429 rate_limited { details.retry_after_s }
```

The answer has the same shape for any device id (an unknown one gets a nonce that is stored nowhere). A nonce is **single use** and valid
**120 s**; it belongs to the device's current saved sign-in only - or (rev 2), when the device has no live keyed sign-in but is pinned to a
key (section 6a), to the device's pinned key, usable only as a `replaces` nonce. The server keeps at most 32 open nonces per sign-in (older ones are
dropped), and answers at most 10 challenges in a burst / 30 per minute per sign-in AND client address (an IPv6 caller counts as its /64),
with a ceiling of 60 in a burst / 120 per minute per sign-in over all addresses (security review D-02: another caller who knows the device
id cannot empty the phone's allowance or evict its nonce with a burst from one address).

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

- **Key change needs the old key (security review D-01, option b).** While the device has a live sign-in bound to a key, a mint that
  would bind a DIFFERENT key - or none (no `device_key` sent, or mode `off`) - must carry the old key's consent:
  ```
  "device_key": { "alg": "ES256", "public_key": "<NEW key>", "proof": { ...signed by the NEW key... },
                  "replaces": { "nonce": "arxn_...", "ts": 1900000000, "sig": "<base64url: OLD key signs the replace message>" } }
  ```
  The nonce comes from `POST /auth/app/refresh-challenge` for the device (it belongs to the current sign-in) and is single use; the
  replace message is section 4's `replace` row (last line = the NEW `public_key` verbatim). Without a valid `replaces` the mint answers
  `409 device_key_bound` and ends nothing. On success the old sign-in ends (`replaced`) and the audit gets
  `auth.app_refresh.key_replaced` (16-hex prefixes of the old and new fingerprints). A planned rotation (periodic, suspected compromise
  while the phone still holds the old key) uses this path.
- **Rev 2 - the key outlives the sign-in.** The rule above applies whenever the device is pinned (section 6a), not only while a sign-in
  is live. In particular **device re-registration** (`POST /presence/devices` of the same install) still ends the saved sign-in
  (`device_reregistered`, CR 4.3), but the device stays pinned: the app mints again with the SAME key (no `replaces` needed), or with a new
  key plus `replaces` signed by the old one.
- **The user's own end releases the key** (owner decision Q296): the app's own `POST /auth/app/sign-out` with its current token, the user's
  "end this sign-in" (`DELETE /auth/app/families/{id}`) or "sign out everywhere" (`DELETE /auth/app/families`) on their OWN account. The
  next mint then binds any key without `replaces`. An administrator's end, re-registration, deleting and re-adding the device, a refusal,
  expiry or the feature switched off do NOT release it.
- **Lost old key** (Keystore key invalidated by a lock-screen change, data cleared while the install id survived, a restored phone): if the
  user can still end the old sign-in themselves (above), that releases it; otherwise an administrator approves a reset (section 6a).
- **The same key re-minted on the same device** is accepted without `replaces` (the old sign-in is replaced); on ANOTHER device it is
  refused (`409 device_key_in_use`).
- **Reinstall / app data cleared:** usually a new install id, i.e. a new device registration with no pin: the user signs in and the app
  mints with a new key. If the platform kept the install id, the device is still pinned: see "Lost old key".

## 6a. The device-key pin and the administrator-approved reset (rev 2, APPREFRESH3-295)

The server remembers, per `device_id`, the last key a mint bound (the **pin**) - also after that sign-in ended. While a device is pinned,
a mint that would bind another key or none needs ONE of:

1. `device_key.replaces` signed by the pinned key (section 6; the nonce from `POST /auth/app/refresh-challenge` for the device - it now
   also works when no sign-in is live);
2. a release by the user's own end of the old sign-in (section 6);
3. a pending **administrator-approved reset**.

The reset (server routes, session cookie; for the administrator's screens, not for the app):

```
GET    /auth/app/devices/{device_id}/key         the device's user or system.configure
       200 { "device_id", "pinned": true, "alg": "ES256", "key_fp": "<16 hex>", "bound_at", "sign_in_live",
             "reset_pending", "reset_expires_at", "reset_approved_at" }        (never the key)
POST   /auth/app/devices/{device_id}/key-reset   a system administrator; body { "reason": "<3..200 chars>" }
       200 { "device_id", "reset_expires_at", "families_ended", "user_notified" }
       403 forbidden | 403 local_channel_only (an administrator's OWN device, from the remote channel) | 404 not_found
       409 no_device_key (nothing pinned) | 422 validation (reason)
DELETE /auth/app/devices/{device_id}/key-reset   a system administrator: withdraw a pending approval -> 204 (404: none pending)
```

An approval ends the device's live sign-in (`device_key_reset`) and, for **24 hours**, lets the device's next mint - by its own user, from
a fresh sign-in, as always - bind a new key (or none) without `replaces`, **once**. Unused, it lapses and the pin holds again. It is
audited (`auth.app_refresh.key_reset_approved` with the administrator, the device, the user, the note, a 16-hex fingerprint prefix; the
mint that spends it writes `auth.app_refresh.key_replaced` with `via: "admin_reset"`), and the device's user receives the notification
`security.app_device_key_reset` (in the app's notification center, by push and in the phone app - owner decision Q297). Its title and
body are installation settings (`GET/PUT /auth/app/settings`: `security.app_refresh_key_reset_notice_title` (<= 80 chars) and
`security.app_refresh_key_reset_notice_body` (<= 180 chars), plain text, placeholders `{device}` and `{until}` only; `null` restores the
default).

**What the app does:** keep the key (section 2); on `409 device_key_bound` without the old key, show the "ask your administrator" message;
after the user says the reset was approved (or the notification arrives), mint normally with the new key - no `replaces`.

**Backward compatibility.** No field, code path or signed string was removed or renamed; `device_key_bound` existed in v1 rev 1 with the
same `details.reason` values. An app built to rev 1 behaves correctly against rev 2 except in one case: after a re-registration or an
administrator's end it used to mint with a NEW key pair and get `201`; it now gets `409 device_key_bound` and must either re-use the old
key (recommended: no change to the server flow) or send `replaces`. Slice-1 apps (no `device_key` at all) are never pinned and see no change.

## 7. Server modes (`security.app_refresh_device_key`)

| Mode | New mint | Refresh of a sign-in WITH a key | Refresh of a sign-in WITHOUT a key |
|---|---|---|---|
| `off` | no key is bound (the field is ignored; answer `bound: false`) | **proof required** (a bound key is never dropped by a setting) | allowed |
| `optional` (default; the lab) | the key is bound when sent | proof required | allowed |
| `required` (before customers) | `422 device_key_required` without a key | proof required | **ended** (`device_key_required`); switching to `required` ends every keyless sign-in at once |

The app MUST always send `device_key` once it implements this contract (it works under all three modes).

## 8. Revocation and audit (what the app sees)

Every CR revocation path ends a keyed sign-in exactly as before; its open nonces go with it. Rev 2: the device's PIN stays (section 6a)
unless the user's own end released it. The server's audit rows carry
only a 16-hex prefix of the key fingerprint at mint, never the public key, a signature or a nonce. Nonces are stored as hashes.

## 9. Open questions (server side; the app contract above does not depend on them)

1. **Attestation.** The server cannot tell a hardware key from a software key. Android Key Attestation (certificate chain) / iOS App Attest
   would prove it. Proposed as a later version (`arx-app-pop-v2`), with the chain sent at mint.
2. **Administrators' MFA rule** (`remote.require_mfa_admin`): enforced at the HA sign-in the mint needs (at most 15 minutes old); not
   re-checked at refresh (it needs a live HA sign-in). Recorded in the CR, section 13.7.
3. **Signed access tokens** (DPoP for every API call): not in v1; the access token stays a minutes-long bearer token. To decide together
   with the session exchange slice.
