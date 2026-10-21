# CR-WISKEY-HMAC-ROTATION-295 - Bridge HMAC key rotation: key ids, two-key overlap, staged rollout (Arx side, fakes only)

Status: ACTIVATED by HMACACT-295 on 2026-10-21 (section 15; original text below is the fakes-only slice). BUILT AGAINST FAKES (2026-10-20), branch `pilot/HMACROT-295` from `origin/main` 61ddf6a91 (2.9.3). Task id
`wxrot-hmac-key-rotation`, owner decision 2026-10-20 "build now"; **activation only after a Fable security review**.
Nothing here contacts a real bridge, WisKey or Home Assistant. `bridge_rotation.GO_LIVE_PERMITTED` is False; the switch
`bridge.key_rotation` defaults to `off` and `on` is refused (409) while the permit is not in the build. The eight WisKey switches
are untouched (all OFF). Migration **0135** (built as PROVISIONAL 0143; renumbered at the 2.10.0 integration, integ/2100).

Builds on (read first): `CR-034-WISKEY-HMAC-ROTATION.md` (branch `origin/pilot/WISKEY-CRs`, PROPOSED 2026-10-10, encodes owner
decisions 23-31), `docs/wiskey-exchange/schemas/1/ROTATION_HMAC_OUTLINE.md` (2026-10-04 outline), `CR-033-WISKEY-DOOR-PATH.md`
(R-25, slot 0079 reserved for `bridge_rotations` - never used), `CR-WISKEY-LEASE-REVOCATION-EVENT.md` (T9: key rotation revokes
every capture lease and resets the revocation stream), WisKey round 10 directive (HMAC key rotation in scope) and the Arx round 12
prompt ("HMAC key rotation client with an overlapping two-key window").

Code facts at 61ddf6a91 (V = read in code): one pairing secret `settings.bridge.secret`, plain text in the `settings` table, kept
out of archives by `backup.SETTINGS_KEEP` (V); `ha_bridge.sign/verify` and `integration/smplwise_bridge/signing.py` sign
`"<ts>.<nonce>.<sha256(canonical body)>"` with no key id, 60 s window, in-memory nonce cache (V); `trusted_caller.sign`
(DTO v3 door, capture lease) rides the same `ha_bridge.sign` (V); `GET /ha/bridge/pairing?regenerate=true` is a hard cut with
no verification (V); per-install AES-256-GCM sealing exists in `connection_store` (`seal_service_secret`, AAD bound) (V).

## 1. Scope of this slice

| In | Out (open items, section 13) |
|---|---|
| Key set with key ids, sealed at rest; v2 signature with `kid`; multi-key verifier (constant time, shared nonce cache) | Wiring `ha_bridge.sign/verify` and every caller to the key set (activation slice) |
| Rotation engine: staged rollout, write-ahead per step, automatic rollback, overlap cap, crash recovery | The bridge side (`smplwise_bridge` multi-key verifier + `rotate` service, CR-034 slice H1) |
| Modes `routine` (overlap) and `hard_cut` (no overlap; the only mode that can make an anchor decrease eligible) | `fresh_repair` and `emergency` revocation (CR-034 5.2 / 8) |
| Admin API (system administrator only), audit of every step, reminders (passive), restore behaviour | WisKey high-water hand-over (CR-034 section 2 item 3) |
| Settings card "מפתח הגשר" (he/en/ar/ru), switch default OFF | A dedicated `bridge.key.rotate` permission (CR-034 section 7) |
| Fake peer + adversarial tests | Any live run |

## 2. Contradictions recorded (not silently resolved)

1. **Key id on the wire.** CR-034 section 4 keeps the wire format unchanged (no `kid`, the verifier tries both keys). The task
   card (owner decision 2026-10-20) asks for a key id in every signature. This slice follows the task card: signature format v2
   carries `kid` and binds it into the HMAC input. Consequence: the bridge and every verifier need the v2 format before
   activation; DTO v3 golden vectors stay valid only for the legacy (kid-less) key (section 4.3). Needs a protocol note to WisKey
   if WisKey ever verifies these messages (today R: WisKey never holds the material).
2. **Reminders vs. "events only".** Owner decision 24 (2026-10-10): rotate on events only, no schedule, no overdue reminder. The
   task card asks for rotation reminders. Resolution in code: a reminder is a passive badge on the settings card, interval
   `0` (off) by default, values 30/90/180/365 days; it never starts a rotation, never notifies outside Settings, and the default
   matches decision 24. The owner should confirm which wins.
3. **Overlap at all.** The 2026-10-04 outline (section 4 step 2) said "no overlap in which both generations open doors
   (TO_BE_CONFIRMED)". Decision 23 (2026-10-10) and the task card ask for an overlap. This slice: overlap for `routine` capped
   at 180 s from `begin` (decision 23), `hard_cut` with no overlap for the anchor case (R-25). Door commands are paused for the
   whole rotation in the activation slice (CR-034 A1); in this slice nothing opens a door.
4. **Delivery of the new key.** The task says "publish to peer". The key itself is never sent: the peer derives it
   (`HKDF-SHA256(ikm = K_cur, salt, info = "smplwise-bridge-rotation-v1|" || kid_next || "|" || gen_next)`, CR-034 section 4);
   "publish" sends the public parameters (rotation id, next key id, generation, salt, overlap) signed with the current key, and the
   peer proves it derived the same key. A leaked current key plus a captured salt yields the next key - routine rotation is
   hygiene, not leak recovery (that is `fresh_repair` / `emergency`, out of this slice).

## 3. Keys

- A key is 32 bytes from a CSPRNG (the legacy pairing secret is adopted as is, section 4.3). It is stored ONLY sealed:
  `connection_store.seal_service_secret(data_dir, "bridge_key", kid, "hmac", base64url(key))` - AES-256-GCM with the per-install key
  file, AAD `bridge_key|<kid>|hmac`, so a blob copied to another row, column or installation does not open.
- `kid`: `g<generation>-<8 random hex>` (never derived from key material; never a fingerprint, hash or length of a key).
  The adopted legacy key has `kid = "g0-legacy"`.
- Key states: `pending` (Arx holds it, the peer has not proven it) -> `next` (peer proved it; inbound verify allowed) ->
  `current` (Arx signs with it; exactly one) -> `retiring` (verify only, until `verify_until`) -> `retired` (material wiped:
  `value_enc = NULL`, the row stays for audit). A `pending`/`next` key of a rolled-back rotation becomes `discarded` (wiped).
- Invariant **K1**: at every committed database state there is exactly one `current` key with readable material, unless the key set
  was never adopted (then nothing signs with the key set; activation slice decides). Enforced by a partial unique index and by the
  engine (a switch is one transaction: `next -> current` and `current -> retiring` together).
- Never shown: no route, screen, log line, audit row, backup or error carries a key, salt, proof, nonce, signature or any hash or
  length of them. The status answer lists kid, generation, state and times only.

## 4. Signature format v2 (with key id)

### 4.1 Sign
`hmac_input = "v2." + kid + "." + ts + "." + nonce + "." + sha256_hex(canonical(body))`, `sig = HMAC-SHA256(key, hmac_input)`,
wire = body + `{kid, ts, nonce, sig}`. `canonical` = the existing recipe (sort_keys, compact, UTF-8, `ensure_ascii=False`). The
body never contains `kid`, `ts`, `nonce`, `sig` (refused). Nonce 32 lower-case hex.

### 4.2 Verify (inbound, order fixed; every refusal is a closed code, none echoes input)
1. shape: `kid` string matching the kid pattern, `ts` int, `nonce` 32 hex, `sig` 64 hex -> else `bad_format`;
2. kid lookup: unknown -> `key_unknown`; `pending` -> `key_not_active`; `retired`/`discarded` -> `key_retired`;
   `retiring` past `verify_until` -> `key_expired`; material unreadable -> `key_unreadable` (fail closed);
3. time window 60 s -> `stale`;
4. constant-time compare -> `bad_signature`;
5. replay: ONE nonce cache across all keys (a nonce seen under one key is a replay under any other) -> `replay`.

### 4.3 Legacy (kid-less) messages
Accepted only against `g0-legacy` while it is `current` or within its `retiring` window - i.e. never after the first completed
rotation (downgrade guard: after retirement there is no key a kid-less message could verify with). Tests: `kidless_after_retire`.

## 5. Rotation engine (staged rollout)

One rotation at a time (partial unique index over the active states). Each step is its own short write transaction
(`Database.write_aside`) committed BEFORE the next peer call (write-ahead), so a crash at any point leaves a state the recovery
table (5.3) resolves. The HTTP request drives the steps synchronously against the peer interface; retirement after the overlap is
driven by `tick()` (status read, `resume` route; a worker is an activation item).

### 5.1 Steps (`routine`)

| # | Step | Signed with | Persisted state before the peer call | Success | Failure -> |
|---|---|---|---|---|---|
| S0 | preflight: switch `on`, go-live permit, peer reports capability `rotation_v1`, no rotation active, current key readable | - | - | | refused, nothing written (409) |
| S1 | prepare: new key (CSPRNG salt; derived K_next), sealed, state `pending` | - | rotation `prepared` | | R1 |
| S2 | publish: `begin{rotation_id, kid_next, gen_next, salt, overlap_s}` | K_cur | rotation `publishing` (t0 = now, monotonic + wall) | peer answers, signed with K_cur, `proof = HMAC(K_next, "rotation-ack|" + rotation_id)`; Arx checks it | R1 (`peer_rejected`, `derivation_mismatch`, `peer_bad_answer`) |
| S3 | confirm: probe signed with K_next must be `ok`; probe signed with K_cur must still be `ok` | K_next, K_cur | rotation `published`, key `next` | rotation `confirmed` | R1 (`probe_next_failed`, `probe_current_failed`) |
| S4 | switch: budget check (remaining to t0 + 180 s >= 100 s), then `commit{rotation_id}` | K_next | rotation `switching` | one transaction: K_next `current`, K_cur `retiring` (`verify_until = min(now + overlap_s, t0 + 170 s)`); rotation `switched`; capture leases revoked (`key_rotation`) | `peer_rejected` -> R1; no answer -> R2 |
| S5 | post-switch probe with K_next | K_next | - | | R3 |
| S6 | retire (at `verify_until`, from `tick`): `retire{rotation_id}` | K_next | rotation `retiring` | K_cur `retired` (wiped); rotation `retired` | peer refuses / no answer: K_cur is wiped anyway at the deadline (Arx no longer verifies it); rotation `retired` with `peer_retire_unconfirmed` (the peer's own 180 s cap ends its window) |
| S7 | verify: probe K_next `ok`; probe K_old must be rejected (V1c: the peer answers `key_retired` / `key_unknown` / `bad_signature`) | K_next, K_old (kept in memory only for this probe in `hard_cut`; for `routine` the material is wiped, so V1c is answered by the peer's status `old_key_present = false`) | - | rotation `verified` (`anchor_eligible` only for `hard_cut`, R-25) | rotation `verify_failed` (alert on the card; keys stay as they are) |

`hard_cut`: `overlap_s = 0`; S4 commit makes the peer drop K_cur in the same persisted update; Arx wipes K_cur in the same
transaction as the switch (no instant with two valid keys at either side), keeps it in memory for the V1c probe only.

### 5.2 Rollback rules (automatic)

- **R1 (before the switch)**: Arx still signs with K_cur and the peer still verifies K_cur. Arx sends `abort{rotation_id}` signed
  with K_cur (best effort; the peer's cap discards `next` anyway), marks K_next `discarded` (wiped), rotation `rolled_back` with
  the code. K_cur was never touched: there is no moment without a valid key.
- **R2 (switch outcome unknown)**: Arx asks `status{rotation_id}` (signed with K_cur). `committed` -> finish the switch locally
  (S4 success branch). `not_committed` / `unknown_rotation` -> R1. No answer -> stay `switching`, retry on `tick`/`resume`; Arx keeps
  signing with K_cur, which the peer verifies until its cap; when the cap passes without an answer the rotation becomes
  `needs_repair` (the card shows "dirty: re-pair required"; doors stay paused in the activation slice). Both keys stay sealed until
  then so either outcome can be honoured.
- **R3 (after the switch, peer rejects K_next)**: switch back: K_cur `current` again (it is still `retiring` and inside its
  window), K_next `discarded`; `abort{rotation_id}` signed with K_cur makes the peer drop next and keep cur. Rotation `rolled_back`
  (`post_switch_probe_failed`).

### 5.3 Crash recovery (`tick` / `resume`, also at the first status read after a start)

| Found state | Action |
|---|---|
| `prepared`, `publishing`, `published`, `confirmed` | R1 |
| `switching` | R2 |
| `switched` | S5 then wait for `verify_until`, S6, S7 |
| `retiring` | S6 again (idempotent), S7 |

### 5.4 Overlap cap
Arx: `verify_until <= t0 + 170 s`; commit refused when less than 100 s remain (decision 23 numbers). The peer enforces its own
180 s cap on its monotonic clock (bridge slice; the fake peer models it). Arx's verifier refuses a `retiring` key after
`verify_until` regardless of whether S6 ran (`key_expired`).

## 6. Peer interface (`services/bridge_rotation_peer.py`)

`capabilities() -> {"rotation": "rotation_v1" | None}` and `call(op, signed_message) -> answer` with `op` in
`begin|probe|commit|retire|abort|status`. Every control message body is
`{"protocol": "smplwise-bridge-rotation-v1", "op", "rotation_id", ...}`, signed v2. Every answer is signed by the peer v2 and verified
by Arx with the key set (an unsigned / wrongly signed answer is `peer_bad_answer`, treated as a rejection). Production peer in this
build: `UnavailablePeer` (no bridge offers `rotate`; capability `None`) - so S0 refuses with `peer_unavailable` even if the switch
could be turned on. Tests inject `tests/fake_bridge_rotation_peer.py` (its own HMAC/HKDF implementation, monotonic clock,
180 s cap, failure injection per step).

## 7. Permissions (Arx RBAC is the authority)

Every route: `system.configure` on the installation, then `rbac.is_system_admin` (403 `not_system_admin`, audited) - the
capture-lease pattern. GET too. No HA flag, token or group grants anything. Starting a rotation needs `confirm: true` in the body.

## 8. Audit

`bridge.rotation.requested|prepared|published|confirmed|switched|retired|verified|rolled_back|failed|needs_repair|recovered`,
`bridge.key.adopted`, `settings.changed` for the switch and the reminder. Details: `rotation_id`, `mode`, `kid_from`, `kid_to`,
`gen_from`, `gen_to`, `step`, `code`, `duration_ms`. Never key, salt, proof, nonce, signature or derivatives. A test scans every
audit row and log record of a full run for the synthetic key bytes, their hex / base64 forms and the salts.

## 9. Restore from backup and machine moves

- `bridge_keys` and `bridge_rotations` are not project or access tables and are listed in `backup.NEVER_EXPORTED_TABLES` (guard):
  no archive carries them; a `replace` restore never touches them. The switch and the reminder are in `SETTINGS_KEEP`.
- After a restore (`backup.restore` hook): an in-flight rotation before the switch is rolled back (R1, code `restore`); one in
  `switching` goes to R2. The live keys stay - the restored database never brings an older key generation back.
- A database copied to another machine without the key file: every blob is `unreadable` -> the card shows `unreadable`, signing
  and verifying with the key set fail closed, rotation refused (`key_unreadable`); recovery is a fresh re-pair (out of slice).

## 10. Reminders

Setting `bridge.key_rotation.reminder_days` in `{0, 30, 90, 180, 365}`, default `0` (off). `reminder_due` when the current key's
`activated_at` is older than the interval. Passive only (section 2 item 2).

## 11. UI

Settings > Connections, card "מפתח הגשר" / "Bridge key" after the secrets card, `system.configure` only (hidden on 403/404).
Rows: state (off / ready / rotating / needs attention), key id and generation, active since, last rotation (time, mode, result),
reminder select, switch (disabled with a short reason while the permit is not in the build), buttons "החלפת מפתח" and
"החלפה מיידית" with one confirmation. Short texts, he/en/ar/ru (`i18n/bridge-key.ts`, ar/ru dev-marked initial translation),
no HA branding, nothing on operator screens.

## 12. Tests (fakes only)

`tests/test_bridge_key_rotation_295.py`: sign/verify v2 (kid bound into the HMAC), legacy kid-less rules, overlap (both keys verify),
after retire (`key_retired`), expired window (`key_expired`), wrong kid (`bad_signature`), unknown kid, pending kid, cross-key
replay, stale; engine happy paths (routine, hard_cut, V1c); rollback at every step (peer rejects begin, wrong proof, probe failures,
commit rejected, commit lost + status committed / not committed / silent, post-switch rejection, retire refused); crash recovery for
every persisted state; partial rollout (peer has next, Arx crashed); budget refusal; one rotation at a time; K1 invariant after every
scenario; sealing (AAD, copy to other kid, foreign key file -> unreadable); RBAC (operator, site admin, `system.configure` without
system admin, GET); switch refused without permit; restore keeps keys and rolls back an in-flight rotation; backup exclusion;
reminder; secret scan of audit and logs. Frontend: `i18n` key parity unit spec.

## 13. Open items (activation needs all of them)

1. Fable security review (section 14).
2. Bridge slice: v2 verifier + `rotate` service + 180 s monotonic cap + capability in the ping (CR-034 H1) - a bridge release.
3. Activation slice: `ha_bridge.sign/verify`, `trusted_caller`, the directory push and every `signing_key` caller move to the key
   set; `bridge.secret` is adopted and then cleared from `settings`; door commands paused during a rotation (CR-034 A1).
4. Retirement worker (today `tick` runs on status reads and `resume`).
5. `fresh_repair` and `emergency` modes, owner notice (CR-034 5.2, 8), dedicated permission `bridge.key.rotate`.
6. Persistent nonce cache across restarts (today in memory, like `ha_bridge`).
7. Owner answers: contradictions 1 and 2 (section 2).
8. Final migration number: 0135 (built as provisional 0143; done at integ/2100).

## 14. What the Fable security review must cover

1. The v2 signature input (`"v2.<kid>.<ts>.<nonce>.<sha256(body)>"`): domain separation from v1, kid binding, canonicalisation.
2. The legacy kid-less acceptance rule and the downgrade guard (4.3).
3. Verifier order and constant-time behaviour; one nonce cache across keys; error codes leak nothing.
4. HKDF derivation and proof: what a leaked K_cur gives an attacker; the proof cannot be replayed into another rotation.
5. Invariant K1 and "never without a valid key" under every crash point (write-ahead, R1-R3, recovery table), including the peer's
   cap and clock skew between Arx's wall clock and the peer's monotonic clock.
6. The overlap cap and the `hard_cut` "no instant with two keys" property; anchor eligibility only with V1c (R-25).
7. Sealing: AAD binding, wipe on retire / discard (row update, SQLite free pages, WAL), restore and machine-move behaviour.
8. No key material or derivative in audit, logs, answers, backups, screens, tests and fixtures (the scan test's coverage).
9. RBAC: system administrator only; denial audit; the switch and go-live permit cannot be bypassed by settings, env or restore.
10. The peer interface: answers are verified, unsigned answers rejected, a hostile peer cannot make Arx switch or wipe K_cur early.
11. Interaction with the capture-lease T9 revocation and the trusted-door path once wired (activation slice).


## 15. Activation slice (HMACACT-295, owner decision 2026-10-21, option A) - provisional migration 0155

What changed, in ONE commit series (the permit flips together with the wiring, never alone):

| Item | Change |
|---|---|
| H-01 wiring | `ha_bridge.signing_key(conn)` returns the current key of the sealed set (a `BridgeKey`: a str that remembers its kid); `ha_bridge.sign` signs v2 for any key other than `g0-legacy` and the OLD kid-less recipe for the pairing secret and `g0-legacy`; the two inbound routes (`/ha/bridge/ping`, `/ha/bridge/directory`) verify through `ha_bridge.verify_message` (key set once adopted, plain secret before). One nonce cache for both paths. |
| `bridge.secret` | cleared (row deleted) in the same transaction that adopts it as `g0-legacy` (first rotation start). Every "is it paired" check uses `bridge_keys.paired_secret`. The pairing endpoint no longer shows a code after adoption; `regenerate=true` wipes the key set and starts a new pairing. |
| Permit | `GO_LIVE_PERMITTED = True` (bridge rotation only; the WisKey permits are unchanged). |
| Switch | `bridge.key_rotation` is ON unless an administrator set it OFF. |
| Peer | `HaServicePeer`: the HA service `smplwise_bridge.rotate` (bridge 0.9.5, `keyset.py`). Capability = the bridge's signed directory push carries `rotation: "rotation_v1"`; believed for 10 minutes. |
| Automatic start | `worker_loop` / `worker_pass`: drives an unfinished rotation, then starts a routine rotation when (the channel is still on the legacy secret OR the reminder interval passed) AND the peer announced support AND no rotation is active / needs repair AND the back-off (1 h doubling, max 1 day after consecutive failures) allows. Never without the peer's fresh announcement. |
| H-02 | already in `bridge_keys.verify` (MAC first with a dummy key, one wire code `bad_signature`, `stale` after the MAC); regression test added; the HTTP routes answer one code. |
| H-03 | text on the card (he/en/ar/ru `hygieneNote`), in this CR and in the user guide `84-bridge-key_HE.md`: suspect a leak -> re-pair; rotation is hygiene only. |
| H-04 | `bridge_keys.hw_ts` (migration 0155) and the same rule in the bridge's key set: a message at or below the high-water the process found at first sight of the kid is a replay across a restart. |
| H-05 | `_repair` aligns to K_next only after a probe under K_next is answered `ok` under K_next. |
| H-07 | `PRAGMA secure_delete = ON` on the wipe and a `wal_checkpoint(TRUNCATE)` after retire / discard / rollback / repair. |
| H-09 | `begin` / `abort` / pre-switch probes must be answered under K_cur; `commit` / `retire` / post-switch probes / the verify status under K_next; a `status` claiming `committed` must be signed under K_next. |

Upgrade order (both safe, tested with the real bridge key set and the 0.9.4 verifier): until a rotation completes, BOTH sides sign the
old kid-less recipe with the pairing secret, so an Arx updated before the bridge (no announcement -> no rotation, nothing adopted) and a
bridge updated before Arx (it never receives `begin`; the extra `rotation` field in its push is ignored) keep working. The bridge needs
one Home Assistant restart on install (0.9.5 supersedes 0.9.4, which has not been loaded on every site yet).

Remaining (not in this slice): door commands paused during a rotation (CR-034 A1), `fresh_repair` / `emergency` modes and the owner
notice, a dedicated `bridge.key.rotate` permission, WisKey high-water hand-over, a live run against a real bridge (no HA access was used here).
The trusted-door / capture-lease messages ride `ha_bridge.sign`: after the first rotation they carry a `kid` (the DTO v3 golden vectors
remain valid for `g0-legacy`); when the bridge offers those services it must use `keyset.KeySet.verify`.

### 15.1 Fable review 2 follow-up (HA-01, HA-02)
- HA-01: `keyset.handle_control` answers a message that did not verify with an UNSIGNED refusal (no signing oracle for a Home Assistant user who can call services); `/ha/bridge/directory` refuses (422 `bridge_bad_request`) a body with `protocol` / `op` or without a `users` list, before any deactivation.
- HA-02: the three re-pair situations (rollback that cannot align, restore to another host or loss of the key file, Home Assistant restored from a pre-rotation backup = pre-rotation backup case) are in the user guide `84-bridge-key_HE.md`; the first rotation is automatic and can be switched off on the card.

### 15.2 Owner decision 2026-10-21 (option A): the first rotation is one click
The worker never starts the FIRST rotation (channel still on the legacy pairing secret): the card shows one line and one button (`awaiting_click`) once the bridge announced support; the click is the existing manual start (`POST /system/bridge-key/rotations`, system administrator). Every later rotation is started by the worker when the reminder interval has passed (default interval 0 = none, so choose an interval on the card to make later rotations automatic).
