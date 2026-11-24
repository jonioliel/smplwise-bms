# MFA-DEVICEKEY-ATTEST-2490 - hardware attestation of the phone key (second-factor train, slice 9 "DEVICEKEY-ATTEST")

Branch `pilot/MFA-DEVICEKEY-ATTEST-2490`, cut from `origin/pilot/MFA-DEVICEKEY-2490` (slice 8, `a49a987ef`). Plan:
`docs/changes/MFA-STEPUP-TRAIN-2490.md` section 4 row 9; design `docs/design/full-2fa-t095/DESIGN.md` 4.4a. Builds on slice 8's hook
(`device_keys.check_attestation`, `attestation_json`). No merge, no version bump, no changelog entry, no web UI, no lab, Home Assistant,
NVR or go2rtc contact, no real phone.

Owner decision implemented: **Q52** (2026-11-22) "phone hardware attestation: YES" - the **non-recommended** option. The accepted risk
is in section 5.

## 1. Server

| Piece | What |
|---|---|
| Migration `0223_device_key_attested.sql` | `ALTER TABLE auth_device_keys ADD COLUMN attested TEXT CHECK (NULL or hardware / software / none / failed)`. NULL = not checked (a key from before this migration, or registered while the mode was `off`). Number 0223: next free after the train's 0219-0222; checked 2026-11-24 over every remote branch (0217 ONVIF-CLIENT, 0218 MULTI-BUILDING-HOME, 0219-0222 MFA). Additive (rollback = leave the column). |
| `services/device_key_attestation.py` (new) | The OFFLINE verifier and the policy. Reuses `services/device_attestation.py` (CR-ATTEST232: payload cleaning, base64, KeyDescription DER reader). Steps: leaf certifies the key being registered -> anchor = the first certificate (never the leaf) whose PUBLIC KEY is a pinned root's, the path is everything below it (anything above is ignored) -> each link of the path signed by the next, the path's top signed by a pinned root -> every path certificate inside its validity period -> no path certificate serial on the shipped status snapshot -> KeyDescription (OID 1.3.6.1.4.1.11129.2.1.17) `attestationChallenge == SHA-256(register payload)` -> `attestationSecurityLevel` 1 TEE / 2 StrongBox = `hardware`, 0 Software = `software`. Anything else = `failed` with a reason code (`malformed`, `chain_unreadable`, `no_pinned_roots`, `key_mismatch`, `chain_signature`, `untrusted_root`, `certificate_not_valid_now`, `revoked`, `no_key_description`, `challenge_mismatch`, `unknown_security_level`, `verifier_error`); no chain = `none`. Never raises. |
| Attestation challenge | Bound into the registration: `SHA-256(<the exact register payload the new key signs>)` = `arx-device-key|v1|register|<origin>|<user>|-|-|<nonce>`. A chain made for another registration, user, origin or nonce never passes (`challenge_mismatch`). The challenge is not stored. |
| Pinned data (`smplwise/assets/attestation/`) | `google_roots.json`: Google's two published roots - the RSA-4096 root `serialNumber=f92009e853b6b045` (2022-2042 issue; the 2016 / 2019 issues of the same key are covered because roots are matched by key) and the ECDSA P-384 `Key Attestation CA1` (2025-2035). Source `https://android.googleapis.com/attestation/root` (linked from developer.android.com `security-key-attestation#root_certificate`), fetched 2026-11-24, each root verified self-signed; the file records subject, validity, certificate SHA-256, SPKI SHA-256 and the source document's SHA-256. `google_attestation_status.json`: SNAPSHOT of `https://android.googleapis.com/attestation/status` fetched 2026-11-24 (2211 entries: 2185 REVOKED/KEY_COMPROMISE, 26 REVOKED/SOFTWARE_FLAW), keyed by lowercase hex serial. Both are public data; the add-on image copies `smplwise/` whole, so they ship. Nothing is fetched at runtime. Maintainer tool: `scripts/refresh_android_attestation_pins.py <dir> <assets dir> <date>` rebuilds both from files saved by hand (no network itself). |
| `services/device_keys.py` | `check_attestation(conn, chain, challenge, spki)` now judges the chain by the mode and returns `(attested, attestation_json)`; `register()` stores both. `has_active()` (sign-in factor available, step-up methods) counts only `hardware` keys under `required`; `check()` refuses a non-hardware key under `required` (reason `attestation_required`, code `invalid`, NOT a lockout step - it is no wrong signature). `view(row, conn)` returns `attested` (hardware / software / none / failed / not_checked) and `counts`. |
| `attestation_json` | The verdict summary only: `{mode, attested, level, reason, root (16-hex SPKI prefix), chain_len, status_list (snapshot date), checked_at}`. Never a certificate, the challenge or key material (a test asserts no `BEGIN` and < 400 chars). |
| `routers/device_keys.py` | `attestation` body field = `list[str <= 8000 chars] <= 8 items` (was `list[str] <= 10`, unused). The challenge answer and `GET auth/device-keys` gain `attestation` (the mode); each key row gains `attested` (real verdicts) and `counts`. Audit: `auth.device_key.registered` carries `attested`, `attestation_mode`, `level`, `reason`; a refusal under `required` is `auth.device_key.refused` with `reason=device_key_attestation_required`, `attested`, `attestation_why`. |
| Setting `security.device_key_attestation` | `off` (nothing checked or kept) / **`preferred` (default: recorded and audited, a registration is never refused for it)** / `required` (only a `hardware` key registers - 422 `device_key_attestation_required` - and only `hardware` keys count). `PATCH /settings` (`system.configure`, therefore step-up gated on the remote channel; tested). In `backup.SETTINGS_KEEP` (never exported, never restored). A hand-edited unknown stored value fails CLOSED (`required`). |
| Wire | `wire/device_keys.py`: `AttestationMode`, `Attested`; `DeviceKeyChallenge.attestation`, `DeviceKeyList.attestation`, `DeviceKeyRow.attested` / `.counts`. `frontend/src/api/generated/wire-device-keys.ts` regenerated (`gen_wire_types.py --check` exit 0). No new route (API inventory unchanged). |
| Privacy | The personal data export's `phone_keys` gains `attested`. |

## 2. App (mobile/android-shell)

- `DeviceKeyPolicy.attestationChallenge(payload, serverOrigin)`: SHA-256 of a REGISTER payload for the app's own server, else null
  (pure, JVM-tested); `chainB64()`.
- `DeviceKey.create(..., attestationChallenge)` -> `Created(publicKey, attestation)`: `setAttestationChallenge(challenge)` (StrongBox
  first, TEE fallback as before), then `KeyStore.getCertificateChain(alias)` (leaf first, base64 DER; sent only when >= 2 certificates).
  A phone that cannot attest (key generation with a challenge throws) still gets a key, without a chain - the server records `none`
  and its mode decides.
- Bridge: `window.ArxApp.deviceKey.create({authKind, payload})`; the answer adds `attestation: [...]` (`[]` = not attested). A
  `payload` that is not this server's register payload is refused (`refused`), not silently ignored. The page sends the array as the
  registration's `attestation` field (the page itself is slice 2 / 11).
- `DeviceKeyPolicyTest.kt`: `theAttestationChallengeIsTheHashOfThisServersRegisterPayload` + the bridge text check.

## 3. Contradictions and limits (recorded, not resolved silently)

1. **Revocation is a snapshot.** The status list ships as data (offline, as the task asked); a key Google revokes after 2026-11-24 is
   not known until the file is refreshed in a release (`scripts/refresh_android_attestation_pins.py`). An online refresh job is not built.
2. **The Android software attestation root is not pinned** (its private key is public in AOSP; it proves nothing). A chain to it - an
   emulator, a phone without hardware attestation - therefore reads `failed / untrusted_root`, not `software`. `software` means: a
   chain to a pinned Google root whose KeyDescription says Software (rare on real phones).
3. Not judged in this slice: `attestationApplicationId` (which app made the key - needs the release signing-certificate digest),
   verified-boot state / device locked, OS patch level, `uniqueId`. A rooted genuine phone with a working TEE still attests `hardware`.
4. Root rotation: Google adding or retiring a root needs a release with refreshed `google_roots.json`. Roots are matched by public key,
   so a re-issued certificate of a pinned key keeps working; an expired older issue carried at the top of a chain is not judged.
5. `required` also stops EXISTING non-hardware keys from counting (sign-in factor and step-up): the task says "required refuses
   non-hardware keys"; built as "never usable", not only "never registered" (open question 1). Switching to `required` can therefore
   leave a phone-key-only user without a usable factor until they register again from an attesting phone (the authenticator code and
   recovery codes are unaffected).
6. Validity of each path certificate is checked against the server clock; a phone with a wrong clock does not matter (the server
   judges), but a leaf whose notBefore is in the server's future would fail (`certificate_not_valid_now`).
7. CR-ATTEST232's verifier (the app refresh key, admin-supplied roots, default none) is untouched; this slice reuses its parsing helpers
   only. The two attestation features have separate settings.

## 4. Open questions (recommendation first; built to the recommendation)

1. **What `required` means for keys already registered.** (a) they stop counting until re-registered with a hardware attestation
   [recommended, built: otherwise `required` protects nothing that already exists]; (b) only new registrations are refused.
2. **Who may lower the mode (required -> preferred / off).** (a) any `system.configure` holder after step-up, audited by the settings row
   [recommended, built: as the task says]; (b) local channel only, like CR-ATTEST232's mode.
3. **Refreshing the status snapshot.** (a) refresh with every release that touches auth, by the maintainer tool [recommended]; (b) an
   opt-in online job (would break "no network at runtime").
4. **`attestationApplicationId` check.** (a) a follow-up slice once the owner confirms the release signing certificate [recommended];
   (b) skip.

## 5. The risk the owner accepted (Q52, non-recommended)

Recommended was "no attestation" because: it adds a dependency on Google's root list and status list (a stale snapshot or a root
rotation can make honest phones fail under `required`); it gives a false sense of strength (a rooted phone with an intact TEE, or a
leaked attestation key not yet on the shipped list, still attests); it excludes emulators and phones without hardware attestation under
`required`; and it creates more data to keep correct. The owner chose YES. Mitigations built: the default is `preferred` (record, never
refuse), so nothing breaks unless an administrator switches to `required`; the check is offline and never raises; verdicts are audited;
the setting is step-up gated and never restored from a backup.

## 6. Tests (real runs)

| Where | Command | Result |
|---|---|---|
| workstation (Windows, Python 3.12, `.venv` of the main checkout, `SW_WIRE_STRICT=1`), one file at a time | `pytest tests/test_mfa_devicekey_attest_2490.py -o addopts=""` | **23 passed** (after one fix: a broken last link to a pinned root key now reads `chain_signature`, and the listing assertion no longer depends on row order) |
| workstation | `pytest tests/test_mfa_devicekey_2490.py` (slice 8; two assertions updated: default mode records `none`, row has `counts`) | **19 passed** |
| workstation | `pytest tests/test_local_privacy.py` (export gains `attested`) | **18 passed** |
| workstation | `python scripts/gen_wire_types.py --check` (after regenerating) | exit 0 |
| runner slot B | ONE job (`ruff check smplwise`, `gen_wire_types --check`, 19 auth / wire / migration / singleton test files in 4 shards), queued 2026-11-24 06:18 UTC via `~/work/slotb.sh` v4 | **NOT_RUN**: never started within the 2-hour limit (the 2.49.0 gate ran the whole time and the server had ~2.9 GB free, below slot B's 6 GB threshold). The waiter was stopped and its files removed at 08:21 UTC. `ruff` is **NOT_RUN** (not installed on the workstation); the wider auth suite (`test_second_factor*`, `test_mfa_stepup_2490`, `test_migrations`, `test_singletons_registered`, `test_wire_routers_*`, `test_app_refresh_attestation_232`) is **NOT_RUN** |
| runner | Android `testDebugUnitTest assembleDebug` (incl. the new `DeviceKeyPolicyTest` case) | **NOT_RUN**: no JDK / Android SDK on the runner |
| real phone | attested key creation (TEE / StrongBox), the chain sent, a phone that cannot attest | **NOT_RUN** (owner must be present) |
| any | web UI / Playwright | not applicable (no UI in this slice) |

Chain fixtures are generated in the test with `cryptography` (a test root pinned in place of Google's, an intermediate, a leaf with the
KeyDescription extension): hardware TEE / StrongBox, software, none, broken chain, wrong root (with and without the root copy), wrong
challenge, other key, no extension, revoked serial, expired certificate, unknown level, unreadable / malformed data, an older issue of
the pinned root key at the top; every mode through the API (off / preferred / required, an existing key under required, a hardware key
answering step-up under required); the setting's default, validation, backup rule, fail-closed value and the step-up gate; the shipped
Google roots (self-signed, fingerprints as recorded) and the status snapshot; the migration.
