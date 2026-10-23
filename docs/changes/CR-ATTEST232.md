# CR-ATTEST232 - Device hardware attestation for the app refresh device key

Status: owner-approved 2026-10-24 (question 66, board row r232). **Server side BUILT, default OFF** on `pilot/ATTEST232-295` from
`origin/release/2150`. Migration **0160** `0160_app_refresh_attestation.sql` is **provisional** (0159 was the highest on release/2150);
renumber at integration if another branch took 0160. No app code, no frontend, nothing run on a runner, a real phone or Google / Apple.

Read with: `docs/changes/CR-APPREFRESH295.md` (sections 13-14), `docs/changes/APPREFRESH-DEVICEKEY-SPEC.md` (the key and its proofs).

## 1. Goal

APPREFRESH2 binds a refresh token family to an ES256 key the app generates in the Android Keystore / iOS Secure Enclave. The server
checks signatures by that key, but it cannot tell a hardware key from a software key made by a script or an emulator that copied the
protocol. Attestation closes that gap: the platform vouches (Android Key Attestation certificate chain, iOS App Attest) that the key lives in
secure hardware of a genuine device. This CR adds the server-side verification, storage and policy. It does not change the proof-of-
possession flow.

## 2. Verification flow

1. The app generates the device key with an attestation challenge. The challenge is **derived, not fetched**:
   `SHA-256("arx-app-attest-v1" LF device_id LF install_id)` (UTF-8, LF-joined, 32 bytes). Android: `setAttestationChallenge(challenge)`;
   iOS: `clientDataHash`. It ties an attestation to one device registration (a genuine phone's attestation cannot vouch for another
   registration). Freshness is the mint's own signed timestamp (APPREFRESH2), because a key is attested when generated, before any nonce exists.
2. At mint (`POST /auth/app/refresh-tokens`) `device_key` may carry `attestation: {format, data}`. `format` is `android_key_attestation`
   (`data` = the certificate chain, leaf first, base64 DER strings) or `ios_app_attest` (`data` = the attestation object, base64).
3. After the existing key checks (`_mint_key`) and before anything is replaced, `_attest` runs by mode (section 5). A verifier returns a
   **verdict**: `verified` (+ level) | `failed` (+ code) | `unavailable` (+ code: it could not judge). No verifier may raise: an error is a
   `failed/verifier_error` verdict, its text dropped.
4. `required` mode refuses unless the verdict is `verified` with level >= the minimum. A refusal ends nothing (an existing sign-in survives).
5. Android verifier (real, structural, offline): every certificate inside its validity period; each certificate signed by the next; the last
   is, or is signed by, a configured trust root; the leaf's public key equals the registered device key; the KeyDescription extension
   (OID 1.3.6.1.4.1.11129.2.1.17) holds the expected challenge; level = attestationSecurityLevel (software / tee / strongbox).
6. iOS verifier: **interface and placeholder only** (always `unavailable/verifier_not_installed`, never `verified`) - see section 9.

No network call to Google or Apple anywhere. Revocation lists are not consulted. Trust roots are Settings values (section 5); the shipped
default is **no roots**, so the Android verifier answers `unavailable/no_trust_roots` until an administrator adds the roots.

## 3. What the server stores

Table `app_refresh_attestations` (migration 0160), one row per device registration: `status`, `level`, `format`, `key_fp` (SHA-256 of the
key the verdict is about), `mode`, `reason` (a code), `checked_at`. Never the chain, the certificates, the challenge or any key. The table is
in `backup.NEVER_EXPORTED_TABLES` (a restore cannot manufacture a verified device). Audit action `auth.app_refresh.attestation` carries
mode, status, level, format, min level and a 16-hex key prefix only. `GET /auth/app/devices/{id}/attestation` (the device's user or an
administrator) shows the row without any key material. The mint answer gains `attestation: {mode, status, level, enforced}` only when
the mode is not off, so an off installation answers byte-for-byte as before.

## 4. What the apps must send

- Android: after generating the Keystore key with `setAttestationChallenge(challenge)`, send `device_key.attestation = {"format":
  "android_key_attestation", "data": [leaf, ..., root]}` (`KeyStore.getCertificateChain`, each base64 DER).
- iOS: `{"format": "ios_app_attest", "data": [attestation_object_b64]}` - accepted on the wire now, judged only once the iOS verifier exists.
- Apps may always send it; in `off` it is ignored. Everything else (proofs, nonces, `replaces`) is unchanged.

## 5. Settings (all editable, system administrator, `/auth/app/settings`)

| Key | Values | Default |
|---|---|---|
| `security.app_refresh_attestation` | `off` / `log_only` / `required` | `off` |
| `security.app_refresh_attestation_min_level` | `software` / `tee` / `strongbox` | `tee` |
| `security.app_refresh_attestation_android_roots` | PEM certificate bundle (<= 20000 chars), validated, `""` = none | `""` |

- `off`: nothing asked, nothing recorded. `log_only`: a verdict is recorded and audited at every mint, **nothing is ever refused**.
  `required`: the mint is refused with 422 `attestation_required` (none/no key), `attestation_invalid` (failed), `attestation_unavailable`
  (verifier could not judge - never a pass), `attestation_level_too_low`.
- Switching to `required` ends every sign-in whose device has no `verified` row for its current key (reason `attestation_required`).
- Lowering the mode, lowering the minimum level or changing the roots is a **local-channel** act (as for the device-key mode and the feature
  switch); raising works anywhere. A hand-edited unknown stored value fails closed. All three keys are `SETTINGS_KEEP` (never exported or restored).
- Rollout: `off` -> `log_only` on the lab (read the verdicts) -> `required` before customers.

## 6. Tests (this slice)

`tests/test_app_refresh_attestation_232.py` (16 tests): defaults and validation, off records nothing, log_only for every outcome, verifier
context (key + binding challenge), required refusals that end nothing, accept at/above the level, switch to required, settings channel rule,
status route, backup classification, migration, and the real Android verifier against locally generated chains (good chain at every level;
no roots, bad roots, untrusted root, wrong challenge, wrong key, broken signature, expired, unreadable, no extension, unknown level) plus
an end-to-end mint through the Settings-held roots. Fakes are injected with `device_attestation.override_verifiers`.

## 7. Threats covered / not covered

Covered: a software or emulated key presented as hardware; an attestation copied from another device registration (challenge binding) or for
another key (leaf key equality). Not covered: a rooted genuine device whose TEE is compromised; revocation (needs the network); a replayed
attestation for the *same* registration and key (harmless - the mint's own proof still needs the private key).

## 8. NOT_RUN in this slice

Full backend suite, API inventory regeneration (`contracts/API_INVENTORY.md`, one new route), frontend / Settings screen, any runner
run, a real Android device chain, Google's real roots. The 2.15.0 gate holds the runner lock.

## 9. Follow-ups / open questions

1. iOS App Attest verifier: CBOR attestation object, Apple App Attest root, app-id (team id + bundle id) hash, receipt; a separate slice. Open:
   an App Attest key is separate from the Secure Enclave signing key - the contract must define how the two are linked (e.g. the attested
   key signs a assertion over the device key's fingerprint).
2. Android: attestationApplicationId (package / signing certificate), verified-boot state, patch level; Google's published roots to be added
   as a reviewed default after a security review (they are not invented here); revocation-list refresh as an optional online job.
3. Settings screen entries for the three keys (the API is ready); the activation order is a Fable security review before `required`.
