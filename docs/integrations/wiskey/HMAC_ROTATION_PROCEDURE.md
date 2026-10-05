# HMAC key rotation procedure: Arx to bridge to intercom integration (WX3)

Status: DRAFT 1, 2026-10-05, Arx. Documents and models only. Nothing in this file has been run: no key was generated,
stored, derived or rotated, and no Home Assistant, door or station was touched. The mechanisms in sections 5 to 7 do
not exist in code yet; building them needs a change request and the owner's approval. Everything marked
`TO_BE_CONFIRMED` is a proposal.

Replaces the outline `docs/wiskey-exchange/schemas/1/ROTATION_HMAC_OUTLINE.md` (04.10.2026). Separate from, and no
substitute for, the package signer (appendix B). Precedence: approved change request, `MASTER_SPEC_HE.md` and
`docs/security/`, `AGENTS.md`, then this file.

## 1. Purpose and scope

The shared HMAC material authenticates the signed channel between Arx (the add-on) and the `smplwise_bridge` custom
integration running inside Home Assistant (ADR-012). Today that is one pairing secret, `bridge.secret`, and the same
secret signs every message in both directions: `execute`, `schedule`, `config_item`, `stream_source`, `media_query`,
the directory push, the ping, and, once built, `door_open` and `door_open_status` (`wiskey-trusted-door-v1`).

Why this procedure matters beyond hygiene: the anchor procedure
(`docs/wiskey-exchange/vectors/trusted-door-v1/v3-addendum/ANCHOR_PROCEDURE_DRAFT.md`, section 4) allows lowering the
clock high-water only after a generation change of this material and a proof that the old generation is rejected.
Until this procedure is approved and built, lowering the high-water stays unavailable, which is the safe default.

Who holds the material:

| Party | Holds it | Notes |
|---|---|---|
| Arx add-on | yes, generates it | SQLite settings in the add-on's `/data`. Never in an archive: `services/backup.py` keeps `bridge.secret` out of every backup and never writes it back on restore |
| `smplwise_bridge` (inside HA Core) | yes | Config entry data under HA's `.storage`. HA backups therefore contain it: treat HA backups as sensitive |
| The intercom integration (`smplwise_intercom`, WisKey) | **no** | It receives the verified, immutable DTO and a separate internal capability from the bridge. It never sees the HMAC material, before, during or after a rotation. WisKey is not a party to this procedure except for the two confirmations in section 12 |
| Owner | no | The owner approves and observes. The owner never types or sees the material in the normal path. In the manual fallback (section 6.2) the owner carries a code between two screens |
| Claude Code, Codex | **never** | No agent generates, stores, derives, logs or transmits a real key. All vectors and tests use synthetic labelled strings |

"The integration" in the request for this document is the bridge verifier. The intercom integration is a consumer of what
the bridge verifies. One consequence is that rotation does not need a WisKey release.

## 2. Terms

- **Generation (`gen`)**: a positive integer that increases by 1 per rotation. It is the only identifier of a key that may
  appear in audit, logs, receipts or screens. No fingerprint, hash, prefix or length of the key is ever shown or logged
  (the outline's rule: no material and no derivative).
- **Current / next / retired**: the keys by lifecycle role. At most two are valid at the same time, and only inside an overlap.
- **Overlap**: the window in which the bridge, and Arx when it verifies bridge-signed messages, accept both `current` and
  `next`.
- **Hard cut**: a rotation with no overlap. Only the new key is valid from the instant of the switch.
- **Rotation id**: a random UUID per rotation, not derived from any key, used to correlate audit rows and the protocol messages.

## 3. When to rotate

| Trigger | Mode | Approval | Owner effort |
|---|---|---|---|
| Before lowering the clock high-water (re-anchor) | complete a rotation inside the same maintenance session, see 8.2 | Owner, in Arx | Two confirmations |
| Routine hygiene (proposal: at most every 12 months, `TO_BE_CONFIRMED`) | derived key with overlap (6.1) | Owner, in Arx; may be a scheduled window the owner enabled | Confirm in Arx |
| Replacing the Arx machine, restoring Arx or HA from a backup, any mismatch of generations | re-pair with fresh key (6.2) | Owner | Carry a code once |
| Suspected leak of the material, of an HA backup, of a bridge log or of the Arx database | emergency revocation (section 9), hard cut and fresh key | Owner, or an Arx administrator with immediate notice to the owner | Carry a code once |

Rotation is a maintenance action of its own. It is never part of a release, an install or an update, and no automatic
release step may start one.

## 4. Roles and separation of duties

- **Arx RBAC is the single authority.** Permission: a new grant `bridge.key.rotate` held only by the Owner role (and never
  delegable in the first version). Emergency revocation uses the same grant, plus the `system.configure` administrator
  with after-the-fact notice (proposal).
- The agent that builds this (Claude/Codex) never has access to the live material. Development uses fakes with
  synthetic strings such as `test-gen-1`. Real material exists only in the running Arx database and the running HA
  config entry.
- Only one rotation may be in progress. A second start request is refused with `rotation_in_progress`.

## 5. Design principles

1. **Fail closed.** If either side is uncertain which generation is valid, signed actions stop. Nothing opens a door on
   an uncertain authentication state. Manual operation (physical keys, HA UI under HA's own permissions) is unaffected.
2. **No key on the wire in routine rotation.** The next key is derived on both sides from the current key and a
   non-secret per-rotation salt (section 6.1). The salt travels signed; the key does not.
3. **Fresh entropy only through the owner-visible path.** When the old key may be known to an attacker, derivation proves
   nothing, so a fresh key is created by Arx and delivered through the pairing path (6.2, section 9).
4. **The wire format does not change.** The signed message schema is closed (`wiskey-trusted-door-v1`: unknown fields are
   refused) and a change to it is a breaking protocol change that needs a new `protocol` value. So the verifier selects the
   key by trying `current`, then `next`, always evaluating both in constant time, and records which generation matched
   internally. No `kid` field is added to any message. (If WisKey or Arx later prefer an explicit key id, that is a new
   protocol version, not part of this procedure.)
5. **No wall clock in the rotation state machine.** Overlap and timeouts use the monotonic clock of the process that
   owns them, so a clock fault cannot extend an overlap. A restart ends the overlap early on the bridge (it re-reads
   persisted state, see section 10), never later.
6. **State is persisted before it is used,** atomically, on both sides (SQLite transaction on Arx; one config-entry update
   on the bridge). A step that cannot be persisted is a failed step.
7. **No reload of the bridge config entry during rotation.** An entry reload revokes the capability that the bridge hands
   to the intercom integration (`state/capability_revoked` in DTO v3). The swap happens in memory plus one persisted
   update. Section 12 asks WisKey to confirm the capability's lifetime.
8. **Audit everything, record no material.** Section 11.

## 6. Switching without downtime

### 6.1 Routine rotation: derived key with an overlap (target design, not built)

Key derivation: `K_next = HKDF-SHA256(ikm = K_cur, salt = rotation_salt, info = "smplwise-bridge-rotation-v1" || gen_next, length = 32)`.
`rotation_salt` is 32 random bytes generated by Arx for this rotation, base64url. Both sides derive; neither sends a key.

Because `K_next` is a function of `K_cur`, this method gives a **generation change**, which is what the anchor procedure and
hygiene need, but it does not heal a leak of `K_cur`. A suspected leak always uses 6.2.

State machine, Arx side (persisted row `bridge.rotation`):

| State | Arx signs with | Bridge accepts | Arx accepts from the bridge | Entered by |
|---|---|---|---|---|
| `idle` | cur | cur | cur | start / end |
| `prepared` | cur | cur | cur | owner confirms; Arx stops new trusted calls (A1) and creates `rotation_id`, `rotation_salt`, derives `next` (stored, not used) |
| `bridge_has_next` | cur | cur + next | cur + next | bridge acknowledged (B1) |
| `switched` | **next** | cur + next | cur + next | Arx committed (C1); overlap timer starts on both sides |
| `retired` | next | next | next | overlap ended, bridge retired cur (D1); Arx destroys cur |
| `aborted` | cur | cur | cur | any abort before `switched` |

Messages (all on the existing signed channel, one new service on the bridge `rotate`, one new endpoint on Arx; shapes
proposed, `TO_BE_CONFIRMED`):

- **A1 (maintenance on).** Arx stops accepting new trusted calls: `door_open`, `door_open_status` and every action that
  needs the bridge. Reads that do not touch a door may continue (TO_BE_CONFIRMED). Requests already sent are left to
  finish: DTO v3 requires an unknown outcome to be resolved by `door_open_status`, which Arx can still ask in step V1.
- **B1 (`rotate.begin`).** Signed with `K_cur`: `{rotation_id, salt, gen_next, overlap_s}`. The bridge derives `K_next`,
  persists `{gen_next, K_next}` next to `K_cur`, starts accepting both, answers `{rotation_id, gen_next, proof}` signed with
  `K_cur`, where `proof = HMAC(K_next, "rotation-ack" || rotation_id)`. Arx recomputes `proof` with its own `K_next`. A mismatch
  aborts (`derivation_mismatch`). The proof reveals nothing usable: it is a MAC under the derived key over a public label.
- **C1 (`rotate.commit`).** Signed with `K_next`: `{rotation_id}`. A valid signature proves Arx holds `K_next`. The bridge
  marks `next` as the signing key for its own messages (directory push, ping), and starts its overlap timer. From this
  instant Arx signs everything with `K_next`.
- **Overlap.** Default `overlap_s = 180` (at least 90: the 30 s DTO lifetime plus the 60 s window of the other paths plus margin;
  at most 900; `TO_BE_CONFIRMED`). During it both keys verify. Nonce caches are shared across keys: a nonce seen under one key is
  a replay under the other.
- **D1 (`rotate.retire`).** After the overlap Arx sends `{rotation_id}` signed with `K_next`; the bridge deletes `K_cur`, persists,
  answers. If Arx does not send it, the bridge retires `cur` by itself when its own monotonic timer reaches `overlap_s`
  plus a grace of 60 s (never extends, so a lost retire message cannot leave two keys valid indefinitely).
- **V1 (verification)** immediately after D1, section 7.

The window in which two keys are valid is therefore from B1 to D1, at most `overlap_s + 60 s`. The cost of the window is one
extra key that is derivable from the first. It is acceptable because routine rotation is not the security response to a leak.

### 6.2 Re-pair with a fresh key (existing path, manual or discovery)

Used for: leak suspicion, a new machine, restore, generation mismatch, or when the derived method is unavailable.

1. Arx stops trusted calls (A1), creates a fresh key with a CSPRNG, 32 random bytes encoded url-safe, stores it as `next`, and
   keeps `cur` valid only for the verification message in step 3 (or not at all in the emergency variant).
2. Delivery to the bridge, either:
   - **Discovery push**: the mechanism already used at install (`services/bridge_install.py` posts the pairing code through the
     Supervisor discovery API). It stays inside the host's internal Supervisor network. The code appears in the HA config flow
     already filled in, and the owner confirms the reconfigure. Weakness: the key transits Supervisor and is held by Core
     until the flow completes. It must never be passed as a `service_data` of an HA service call, because the event bus and the
     recorder can store service data. That is why `rotate.*` messages never carry key material.
   - **Manual**: the owner reads the code on the Arx screen (reveal needs a fresh owner confirmation and is audited as
     `bridge.key.revealed`, no value) and types it into the bridge's reconfigure flow. This is the high-assurance path and the
     only one for the emergency variant when the discovery channel is itself suspect.
3. The bridge persists the new key as `current`, drops the old one immediately (no overlap), and answers a signed ping.
   Arx records `gen_next` as current and destroys the old key. Verification V1 (section 7). Trusted calls resume only after V1 passes.

Today's code already has half of 6.2: `GET /ha/bridge/pairing?regenerate=true` replaces `bridge.secret` at once and audits
`bridge.pairing.regenerate`. It is a hard cut with no verification step and no overlap, so every signed path fails until the
owner re-enters the code in HA. Until the work in section 13 is done it is the only available rotation. It must be used only
under the emergency rules of section 9, and never as routine, and it is **not** run by this task.

## 7. Verification (V1)

Verification never opens a door and never changes a schedule. All probes are read-only or no-ops:

| # | Probe | Expected | Fails when |
|---|---|---|---|
| V1a | Signed ping under the new key, Arx to bridge | accepted, bridge reports `gen = gen_next` | `bad_signature`, `stale` |
| V1b | Signed directory pull from bridge to Arx under the new key | accepted | any rejection |
| V1c | Signed ping under the **old** key (derived locally from the retired generation, kept only until this probe is sent, then destroyed) | `signature/bad_signature` after D1 (or immediately in hard cut) | **accepted**: the old key still works; stop and treat as a failed rotation |
| V1d | `door_open_status` for a freshly generated synthetic `target_request_id` | `unknown/not_found_or_expired` (a status read, no pending record, per DTO v3 section 6) | any other answer |
| V1e | Replay the V1a nonce | `replay` | accepted |

V1c requires Arx to hold the old key for a few seconds after D1 and to destroy it as the very next step regardless of the result.
In the 6.2 variant V1c can only run if the old key was still known; in the emergency variant it is replaced by an owner-visible
statement "the old key is destroyed on Arx", and the anchor procedure may not rely on V1c (it then needs the owner's note, see 8.2).
The result of each probe goes to the audit (11), as `ok` or `failed` plus the code, never a value.

A physical door test is a separate, owner-approved activity (one door, one test, as agreed for the integration). It is not part
of the rotation and not required to close it.

## 8. Rollback and the re-anchor linkage

### 8.1 Rollback

| Situation | Action | Result |
|---|---|---|
| Failure before `switched` | Arx sends `rotate.abort` signed with `K_cur`; both sides delete `next` | `aborted`, nothing changed. If the bridge cannot be reached: Arx deletes `next`, the bridge's `next` expires with its overlap timer |
| Failure in `switched` (before retire) | Arx resumes signing with `K_cur`, tells the bridge `rotate.abort` signed with `K_cur`; the bridge drops `next` | back to `idle` on the old generation. `gen` numbers are not reused: the aborted `gen_next` is burnt |
| After `retired` | **No rollback to the old key**: it no longer exists anywhere | Recover by 6.2 (fresh key). Trusted calls stay stopped until V1 passes |
| V1 fails | If before D1: abort as above. After D1: 6.2 | as above |

### 8.2 Re-anchor linkage

The anchor procedure order is binding: (1) stop trusted calls, (2) rotate the generation, (3) verify old signatures are rejected,
(4) decrease the high-water atomically, (5) re-baseline, (6) resume. Concretely:

- Step 2 and 3 are this procedure through V1c. A routine rotation counts only if it completed in the same maintenance session
  (state `retired`, V1 all `ok`). An aborted or partial rotation never unlocks the decrease.
- If V1c could not run (emergency re-pair), the owner records in Arx that the old key was destroyed and re-anchor requires a
  second owner confirmation. Open question 3.
- `pending` and replay records are neither deleted nor altered by rotation.

## 9. Emergency revocation

Trigger: any credible suspicion that the material, an HA backup that contains it, or the Arx database leaked. Decision: the owner,
or an Arx administrator who must notify the owner immediately.

1. **Stop.** Arx "revoke" (grant `bridge.key.rotate`): trusted calls stop at once; Arx destroys `cur` and `next` and writes
   `bridge.key.revoked` (audit, no value). From this instant Arx signs nothing and accepts nothing from the bridge.
2. **Bridge side kill switch.** If the owner wants certainty on the HA side without waiting for step 3: disable or remove the
   `smplwise_bridge` config entry in HA. The bridge then verifies nothing; every signed action fails closed. (An HA user with
   admin rights can do this independently of Arx, which is intended.)
3. **Re-pair with a fresh key** by 6.2, preferably the manual path (no discovery), then V1.
4. **Review.** Arx lists audit rows (`ha.action`, `door.*`) since the suspected time for the owner; HA's logbook and the intercom
   integration's own audit entries (they carry the actor and request id) are the cross-check. Any action that cannot be traced
   to a real Arx request is escalated to the owner.
5. **Blast radius to state to the owner before confirming:** during steps 1 to 3 every Arx-initiated action that goes through the
   bridge is unavailable: door opens from Arx, `lock.lock`, schedules, automations edits, media. HA's own UI and physical keys
   remain. The product accepts this: a stopped system is safer than a system that may obey an attacker.
6. Do not rotate the package signer as part of this unless the leak also touched it (appendix B is independent).

## 10. Failure modes

| # | Failure | Detected by | Safe state | Recovery |
|---|---|---|---|---|
| 1 | Arx crashes after persisting `prepared`, before B1 | state row on restart | trusted calls stay stopped | resume at B1 or abort; Arx never resumes silently into `switched` |
| 2 | Bridge persisted `next`, ack lost | Arx timeout on B1, `bridge_has_next` unknown | both keys valid, Arx still signs `cur` | Arx retries B1 with the same `rotation_id` (idempotent), or aborts |
| 3 | Arx switched (C1 sent), bridge did not get it | Arx timeout on C1 | bridge accepts both | retry C1; if impossible, Arx resumes `cur` (8.1) |
| 4 | Bridge restarts mid-overlap | bridge reads persisted `{cur, next, overlap_deadline_remaining}` | bridge ends the overlap early: keeps `next` only if C1 was received, else `cur` only | Arx's next signed call reveals the mismatch; Arx runs the status query, then aborts or re-pairs |
| 5 | Arx restarts mid-overlap | persisted row | continues from the persisted state | normal |
| 6 | HA restored from an older backup (older generation) | first signed message rejected, V1a fails | fail closed | 6.2 |
| 7 | Arx DB restored (key settings are never restored, so the current key survives) or the add-on is reinstalled with a fresh `/data` | Arx has no key or a different one | fail closed, "bridge not paired" | 6.2 |
| 8 | Two keys valid for longer than planned | bridge timer; Arx watchdog shows `overlap_overdue` | bridge self-retires at overlap + 60 s | alert the owner; manual retire |
| 9 | Clock jump during overlap | none needed: monotonic timers only | n/a | n/a. A clock fault still blocks opens through `time/clock_invalid` as before |
| 10 | Replay of a pre-rotation message after retire | `bad_signature` at the signature stage, before time and state | rejected | none needed; this is the property V1c proves |
| 11 | Both sides disagree on `gen` | V1a reports `gen` | fail closed | 6.2 |
| 12 | Owner never confirms | confirmation timeout 30 min (TO_BE_CONFIRMED) | rotation not started or aborted | start again |
| 13 | Persistence failure on either side | step returns an error | the step is not taken; abort | abort, investigate storage |
| 14 | Intercom integration reloaded during rotation | `capability_revoked` on a call | rejected, never executed | normal reload recovery; unrelated to the key |
| 15 | Another signed path (schedule, config_item) still uses a single-key verifier | version check at start: Arx refuses to start unless the bridge reports the rotation capability | no rotation | upgrade the bridge first |

Rule for every case: in doubt, block. A rotation is never "finished by assumption".

## 11. Audit

Arx audit rows (existing audit table; `actor` is the real operator, none for scheduled steps), all with `rotation_id`, `gen`
numbers as integers, `mode` (`derived_overlap`, `fresh_repair`, `emergency`), duration, result code; **never** a key, salt,
proof, nonce, signature or any hash or length of them:

`bridge.rotation.requested`, `.confirmed`, `.prepared`, `.bridge_ack`, `.switched`, `.retired`, `.verified` (with per-probe
`ok`/`failed` and code), `.aborted`, `.failed`, `bridge.key.revoked`, `bridge.key.revealed`, `bridge.key.rotation_overdue`.

Bridge log lines (HA logger, info): `key generation <n> active`, `overlap started`, `overlap ended`. No values. The intercom
integration's audit is untouched; it keeps recording the real actor and request id of each open.

## 12. What the owner does by hand and what is automated

| Step | Routine (6.1) | Fresh key (6.2) | Emergency (9) |
|---|---|---|---|
| Decide and start | owner presses "rotate" in Arx maintenance | owner | owner or administrator |
| Confirm the maintenance window | owner (one confirmation) | owner | owner (states the blast radius) |
| Stop trusted calls | automatic | automatic | automatic, immediate |
| Create key / salt | automatic (Arx) | automatic (Arx, CSPRNG) | automatic |
| Deliver to the bridge | automatic (derived, no key moves) | owner confirms the discovered entry **or** types the code | manual path only |
| Switch, overlap, retire | automatic | n/a (hard cut) | n/a |
| Verification | automatic, result shown | automatic, result shown | automatic, result shown |
| Resume | automatic after V1 passes | automatic after V1 passes | owner confirms resume |
| Decide rollback | owner on failure | owner | n/a |
| Review audit | optional | optional | owner, required |

Questions for WisKey (Codex), answered in a reply file under `docs/`: (a) does the capability that the bridge hands to the intercom
integration survive a change of the bridge's verification key when the config entry is not reloaded? (b) does the intercom
integration log anything that could include a key-bearing value? Nothing else is asked of WisKey.

## 13. What has to be built (not started)

1. Bridge (`smplwise_bridge`): multi-key `Verifier` (current, next, constant-time), `rotate` service (`begin`, `commit`, `retire`,
   `abort`, `status`), persisted state, monotonic overlap timer, no entry reload. New bridge version, mirrored copy via
   `scripts/sync_integration.py`.
2. Arx add-on: `ha_bridge.verify` and `sign` accept a key set; rotation service and state row; router with grant
   `bridge.key.rotate`; maintenance screen (Hebrew UI text, no internal codes); audit rows; the watchdog; the reveal flow. Every
   new key-bearing setting (`bridge.key.*`, `bridge.rotation`) must be added to `SETTINGS_KEEP` in `services/backup.py`, so it never
   enters an archive and a restore never writes it back.
3. Models and fakes first (section 14), then a lab rotation on a copy, then the owner's approval to run on the live bridge.
   Each live run needs its own approval for that run.
4. Update the anchor procedure text to reference this file as the approved procedure, once the owner approves.

## 14. Tests (models and fakes only)

A fake Arx and a fake bridge in one process, synthetic key strings, an injectable monotonic clock, an injectable crash after each
persisted step (the table in section 10), and the vectors below marked `model_only`:

1. Overlap: a message signed with `cur` and one with `next` both verify during the overlap; after retire only `next`.
2. After retire a `cur`-signed message is rejected as `bad_signature` before any time or state stage.
3. A nonce replayed under the other key is `replay`.
4. Each crash point in section 10 ends in a documented safe state and never in "both keys valid forever".
5. `derivation_mismatch` aborts without changing either side.
6. Hard cut: no instant at which both keys verify.
7. Audit rows contain no key, salt, proof or derivative (a scan over all rows of a full run).
8. The wire message schema is unchanged: the closed-schema vectors of `GOLDEN_VECTORS_v3.json` pass untouched.
9. Rollback table of 8.1, each row.

NOT_RUN today: all of the above (nothing is built). This document and the gate tool tests were checked only for what they
state about themselves.

## 15. Open questions

Collected at the end of the owner summary (`private/wiskey-foldin/WX3_SUMMARY_HE.md`) and in the task report; the numbered list
there is the live one.

---

## Appendix B. Package signer procedure: outline only

Separate from everything above: a key that signs what Arx imports, never the HMAC channel. Signer choice is **deferred by the
owner** (trust policy `trust/1`, 04.10.2026): until a signer is chosen every WisKey release is **unsigned, for test**
(`accepted_unsigned`, installed only under the owner's one-off exception for that exact version and manifest hash). No key is
generated, requested or stored by Arx, Claude or Codex.

1. **What is signed.** With the source-import model (the importer computes the hashes; WisKey packages nothing) the signed
   statement is a small attestation computed from the source by the tool or by Arx: `{schema, domain, version, source_commit,
   package.tree_sha256, tests.tree_sha256, contract.tree_sha256, notes_sha256, signed_at}`: ASCII keys, strings and integers
   only, no floats. Arx recomputes the tree hashes from the source it imported and requires equality with the attested ones.
2. **Format.** Ed25519 over the JCS (RFC 8785) canonical form of the attestation. With ASCII keys and no floats, `json.dumps(sort_keys=True,
   separators=(",", ":"), ensure_ascii=False)` yields the same bytes as JCS; anything else needs a real JCS implementation. The
   envelope: `{"key_id", "alg": "Ed25519", "signature": base64url, "attestation": <object>}`.
3. **Key id.** `key_id = lower-case hex of SHA-256 over the 32 raw public key bytes`.
4. **Pinned key list in Arx.** Rows `{key_id, public_key, state: current | next | revoked, added_by, added_at, revoked_at?}`. A key
   that arrives inside a package is never adopted. Adding a key is a trust-management action by the owner or an Arx administrator,
   audited. The temporary key already handed over is not a production key and is not pinned.
5. **Rotation.** The signer generates the new key in its own custody and hands over the public part with its `key_id` through the owner
   channel; Arx pins it as `next`; the first release signed with it promotes it; the old key moves to `revoked` after an overlap of
   **30 days** (owner decision); a second key is kept offline as a backup once a signer exists.
6. **Revocation / loss.** Immediate: owner or Arx administrator with notice to the owner; versions signed after the suspected time go
   to Arx's local `blocked_versions`; a new trust path is required. The receipt for a package signed by the `next` key reports
   `signature_status: verified` with `key_id` in `detail` (proposal).
7. **Out of scope until a signer is chosen.** Choice of signer (non-exportable hardware token, cloud KMS with Ed25519, an offline
   software key with an offline backup are the families to compare), a `verify-signature` subcommand in the gate tool with a pinned
   key file, and the full procedure text.
