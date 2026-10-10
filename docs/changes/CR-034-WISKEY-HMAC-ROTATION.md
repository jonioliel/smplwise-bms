# CR-034 - Bridge HMAC key rotation (two-key overlap) and the WisKey gate tool rules

Status: PROPOSED (design and documents only, 2026-10-10). No key was generated, stored, derived, rotated or read; no Home
Assistant, bridge, door or station was touched. Branch `pilot/WISKEY-CRs` from `origin/main` e7201c92 (2.4.3).
Companion: `CR-033-WISKEY-DOOR-PATH.md`; combined order and effort in `WISKEY-CR033-CR034-IMPLEMENTATION-PLAN.md`.

Sources: `HMAC_ROTATION_PROCEDURE.md` (DRAFT 1), `GATE_TOOL_SPEC.md`, `scripts/wiskey_gate.py` (0.1.0) and
`smplwise_vms/backend/tests/test_wiskey_gate.py` on `origin/pilot/WX3-hmac-rotation` @ ef18041c (not merged to main);
`docs/wiskey-exchange/vectors/trusted-door-v1/v3-addendum/ANCHOR_PROCEDURE_DRAFT.md` (main); the 2026-10-10 Arx replies;
**the owner's decision block in `private/wiskey-foldin/CODEX_SEND_PACKAGE_2026-10-10_HE.txt` (authoritative)**.
Code facts at e7201c92: `services/ha_bridge.py` (`signing_key`, `sign`, `verify`: one key), `routers/ha.py` `pairing`
(`regenerate=true` = today's hard cut without verification), `services/backup.py` `SETTINGS_KEEP` (keeps `bridge.secret` out
of archives), bridge 0.8.0.

Evidence marks: **V** read in Arx code; **R** reported by a source document; **W?** WisKey behaviour not verified; **D** design.
Precedence as in CLAUDE.md; this CR binds only after owner approval.

## 1. Owner decisions encoded (2026-10-10, OWNER01 numbering = WX3 questions 1..9)

| # | Decision | Where |
|---|---|---|
| 23 | **א**: routine rotation uses a two-key overlap of **at most 3 minutes**; an immediate (hard) cut only for an emergency and for the rotation that precedes an anchor reduction | 4, 5 |
| 24 | **ג**: rotate on events only; no fixed schedule | 3 |
| 25 | closed by rule R-25 (below) | 6 |
| 26 | **א**: a fixed JSON block inside `ARX_IMPACT.md` carries breaking / risk to doors / restart / migrations | 9.1 |
| 27 | **א**: exit code 5 also covers policy violations | 9.2 |
| 28 | **ב**: routine rotation may be started by the owner or a system administrator | 7 |
| 29 | **א**: emergency revocation by an administrator is allowed, with immediate notice to the owner | 7, 8 |
| 30 | **א**: the exception marker in the secrets scan is `gate:allow(code): reason` | 9.3 |
| 31 | depends on 12 (= א): the capability and logging questions are sent to WisKey | 2 |

**R-25 (closed rule).** Order: stop trusted calls -> rotate the generation -> verify old signatures are rejected (V1c) ->
decrease the high-water atomically -> re-baseline -> resume. After an emergency re-pair without V1c **no decrease is
available**: the system stays blocked until UTC >= high-water. No owner note, second approval or statement replaces V1c.
Today the decrease is unavailable altogether (nothing is built).

## 2. Who builds what, and WisKey's consent

| Party | Builds | Notes |
|---|---|---|
| Arx add-on | key set in `ha_bridge.sign/verify`; rotation state machine and history; maintenance screen; permissions; notice; fresh-key re-pair with verification; anchor eligibility record; gate tool changes (section 9) | slices H2..H6, G0..G1 |
| `smplwise_bridge` (Arx-owned custom integration) | multi-key verifier (constant time, current + next), `rotate` service (`begin`, `commit`, `retire`, `abort`, `status`), persisted state without entry reload, monotonic 180 s cap, rotation capability in the ping | slice H1; bridge version after 0.8.1 (see the plan) |
| WisKey (`smplwise_intercom`) | **no key handling and no release needed** for rotation itself (R: WisKey never sees the HMAC material) | consent items below |

WisKey's consent and answers needed before H1 merges (question 31, sent because item 12 = א):

1. **W?** Does the internal capability that the bridge hands to the intercom integration survive a change of the bridge's
   verification key when the bridge config entry is **not** reloaded? (If not, every rotation interrupts door commands until the
   capability is re-issued, and the procedure must add that step.)
2. **W?** Does the intercom integration log anything that could contain a key-bearing value (signed message, capability token)?
3. **W?** (new, from R-25) The high-water lives in WisKey (R, ANCHOR_PROCEDURE_DRAFT: "WisKey stores a high-water UTC value").
   How does WisKey learn, without any key material, that a generation change completed with V1c? D proposal: the bridge passes
   `{key_generation, last_rotation: {rotation_id, mode, verified_old_rejected: bool, completed_at_monotonic_age_s}}` through the
   capability's status. Until WisKey agrees on a mechanism, the decrease stays unavailable (the safe default), and Arx only
   records eligibility (H6).
4. For section 9.1: WisKey agrees to author the `arx-impact/1` block in `ARX_IMPACT.md` for every installation candidate
   (not for the reference rc.37 package; S2 of the 2026-10-10 reply).

Answers arrive in a WisKey file under `docs/`; nothing here is sent by this CR (no messages to WisKey or Codex).

## 3. When to rotate (decision 24: events only)

No timer, no scheduled window, no "overdue" reminder. A rotation is a maintenance action started by a person after an event:

| Event | Mode |
|---|---|
| Before an anchor (high-water) decrease | `derived_hard_cut` (section 5) inside the same maintenance session |
| Staff or administrator change, policy hygiene after an incident review, a bridge or add-on reinstall the owner wants to mark | `derived_overlap` (section 4) |
| Arx machine replaced, Arx or HA restored from a backup, generation mismatch detected | `fresh_repair` (re-pair, section 5.2) |
| Suspected leak of the key, an HA backup, a bridge log or the Arx database | `emergency` (section 8) |

The watchdog only reports conditions that already fail closed (generation mismatch, `overlap_overdue`); it never starts a
rotation. A rotation is never part of a release, install or update.

## 4. Two-key overlap protocol (routine rotation, decision 23)

Key derivation unchanged from the procedure: `K_next = HKDF-SHA256(ikm = K_cur, salt = rotation_salt, info =
"smplwise-bridge-rotation-v1" || gen_next, length = 32)`; 32-byte random salt per rotation; no key on the wire.
The wire format of every signed message is unchanged (no `kid`); the verifier tries both keys in constant time.

**The 3-minute cap is a hard property of the bridge, measured on its own monotonic clock from the moment it accepts `begin`.**

| Step | Sender | Signed with | Effect | Time budget |
|---|---|---|---|---|
| A1 maintenance on | Arx (local) | - | new trusted calls (`door_open`, `door_open_status`, every bridge action) paused; in-flight requests finish | before t0 |
| B1 `rotate.begin {rotation_id, salt, gen_next, overlap_s}` | Arx | K_cur | bridge derives and persists `next`, accepts cur + next; answers `proof = HMAC(K_next, "rotation-ack" || rotation_id)` signed with K_cur | t0 = bridge accept |
| check | Arx | - | Arx recomputes `proof`; mismatch -> `rotate.abort` (`derivation_mismatch`) | |
| C1 `rotate.commit {rotation_id}` | Arx | K_next | Arx signs everything with K_next from now; bridge signs its own messages with K_next. **Arx sends C1 only if the remaining budget is at least 100 s** (90 s minimum overlap + 10 s margin); otherwise it aborts | t0 + at most 80 s |
| overlap | both | - | both keys verify; one shared nonce cache (a nonce seen under one key is a replay under the other) | `overlap_s` default **90 s**, max so that C1 + overlap_s <= t0 + 170 s |
| D1 `rotate.retire {rotation_id}` | Arx | K_next | bridge deletes K_cur, persists, answers | by t0 + 170 s |
| cap | bridge (alone) | - | at t0 + **180 s**, if still two keys: C1 received -> keep next only; no C1 -> keep cur only (abort). Never extended, not by a restart, not by a message | t0 + 180 s |
| V1 verification | Arx | - | section 6; then A1 off (trusted calls resume) only if V1 passes | after D1 |

Why 90 s minimum: the 30 s DTO lifetime plus the 60 s window of the other signed paths (R, procedure 6.1). The procedure's
earlier default (180 s overlap plus 60 s grace = up to 240 s of two keys) is replaced by this cap to meet decision 23.
Arx keeps the same cap on its own monotonic clock from the moment it sends B1 for messages it verifies from the bridge.
A bridge restart during the window ends it early (keeps `next` only if C1 was persisted), never later (procedure 10.4).

Operator-visible cost: door commands from Arx are paused from A1 until V1 passes, about 3 to 4 minutes. Physical keys, PIN,
cards and the WisKey panel are unaffected.

## 5. Hard cut modes

### 5.1 `derived_hard_cut` (before an anchor decrease, decision 23)

As section 4 with `overlap_s = 0`: C1 makes the bridge drop K_cur in the same persisted update; there is no instant in which
both keys verify. Arx keeps K_cur in memory only for probe V1c and destroys it right after, whatever the result.

### 5.2 `fresh_repair` (re-pair with a fresh key)

Replaces today's `GET /ha/bridge/pairing?regenerate=true` (V: hard cut, no verification): A1; Arx creates 32 random bytes
(CSPRNG) as `next`; delivery by the discovery push (normal) or by the owner typing the code into the bridge reconfigure flow
(reveal audited `bridge.key.revealed`, never the value); the bridge stores it as current and drops the old one; V1; resume only
after V1 passes. V1c runs only if the old key is still known on Arx.

## 6. Verification V1 and anchor eligibility

V1a signed ping under the new key; V1b bridge-signed directory pull accepted; V1c ping under the old key must be rejected as
`bad_signature`; V1d `door_open_status` for a fresh synthetic request id returns `not_found_or_expired` (only once the bridge has
`door_open`, CR-033 D5b; until then V1d is `NOT_RUN` and recorded so); V1e replay of the V1a nonce is `replay`. None opens a door.

`anchor_eligible` is recorded true only when: mode `derived_hard_cut` (decision 23: the rotation before an anchor decrease is
an immediate cut), state `retired`, V1a..V1c all `ok`, in the same maintenance session. Emergency and fresh repair without V1c are never eligible (R-25).
Arx shows "אפשר להקטין את עוגן השעון" only when eligible **and** WisKey's mechanism (section 2, item 3) exists; otherwise
"הקטנת העוגן אינה זמינה. החסימה תסתיים כשהשעון יגיע לערך השמור".

## 7. Permissions (decisions 28 and 29)

- New permission `bridge.key.rotate`: held by `system_admin` (the owner is a system administrator in Arx; Arx never derives a role
  from an HA flag). Sensitive, not implied, not delegable, installation scope only.
- Routine (`derived_overlap`), `derived_hard_cut` and `fresh_repair`: any holder of `bridge.key.rotate` may start (28 = ב), with
  one confirmation that states the pause ("פתיחת דלתות מרחוק תושהה לכ-4 דקות").
- Emergency revocation (29 = א): any holder of `bridge.key.rotate`; no prior owner approval; **immediate notice to the owner**.
- "The owner" for notices: a new setting `security.owner_contacts` (one or more Arx users, set by a system administrator, at
  least one required before the emergency button is enabled; until set, the notice goes to every system administrator and a
  banner stays on all Settings screens until one of them acknowledges it).
- Only one rotation at a time (`rotation_in_progress`).

## 8. Emergency revocation (decision 29)

1. Holder presses "ביטול חירום של מפתח הגשר", confirms the blast radius (every Arx action through the bridge stops: door opens,
   schedules, automation edits, media). Arx stops trusted calls, destroys cur and next, writes `bridge.key.revoked`.
2. In the same transaction the notice is queued: notification center entry, push and email where configured, to the owner contacts
   and every other system administrator: "בוטל מפתח הגשר בידי <שם> ב-<שעה>. כל הפעולות דרך תשתית המערכת מושבתות עד זיווג מחדש."
   A notice failure never blocks the revocation; it is retried by the notification service (a notice, not a physical command).
3. Re-pair by 5.2, manual path preferred; V1 (no V1c: the old key is gone); resume needs a holder's confirmation.
4. Owner review: Arx lists audit rows since the suspected time; anchor decrease unavailable (R-25).

## 9. Gate tool rules (decisions 26, 27, 30)

Applies to installation candidates only; the reference rc.37 package is exempt (S2 of the 2026-10-10 reply).

### 9.1 `arx-impact/1` block in `ARX_IMPACT.md` (26)

Exactly one fenced block with info string `json arx-impact`. Strict JSON (duplicate keys refused at any depth), ASCII keys:

```json arx-impact
{
  "schema": "arx-impact/1",
  "version": "2.0.1",
  "breaking": false,
  "breaking_notes": "",
  "risk_to_doors": "none",
  "risk_to_doors_notes": "",
  "restart": "none",
  "migrations": [],
  "ws_commands_changed": [],
  "permissions_changed": [],
  "entities_changed": [],
  "settings_changed": [],
  "storage_schema_changed": false,
  "autonomous_timers_changed": [],
  "rollback": "reinstall the previous version; no data change"
}
```

`risk_to_doors`: `none|low|medium|high`; `restart`: `none|integration_reload|ha_restart`; `migrations[]`:
`{id, description, reversible: bool, dry_run: bool, backup_before: bool}`; `version` must equal `manifest.json`. New findings
`S_IMPACT_BLOCK_MISSING`, `S_IMPACT_BLOCK_COUNT`, `S_IMPACT_BLOCK_JSON`, `S_IMPACT_BLOCK_FIELD`, `S_IMPACT_BLOCK_VERSION` (exit 2).
The prose topics of spec 3.2 stay. Arx renders the block in Hebrew for the owner (breaking, risk to doors, restart, migrations).
**W?** WisKey authors it (section 2, item 4).

### 9.2 Exit code 5 = policy violation (27)

Exit 5 is renamed `policy_violation` (number unchanged) and covers every `R_*` finding: forbidden content, leaks, undocumented
timers, socket use, baseline and exclusion rules. Report `result` text changes from `exclusions_violation` to
`policy_violation`; finding codes stay specific; priority order 6, 2, 5, 7, 3, 4, 1 unchanged.

### 9.3 `gate:allow(CODE): reason` (30)

Same line as the hit, in the file's comment syntax (`#`, `//`, `/* */`, `<!-- -->`); `CODE` equals the finding code; reason at
least 10 characters; every allowed hit listed under `allowed[]` with path and line (never the value) and counted in the Hebrew
summary. JSON and other comment-less files cannot carry a marker: their hits must be redacted. A marker on a `R_LEAK_PRIVATE_KEY`
or `R_LEAK_TOKEN` hit is refused (no exception for key or token shapes, D).

## 10. Migrations and settings

| Item | Content | Slice |
|---|---|---|
| migration **0079** | `bridge_rotations(rotation_id TEXT PRIMARY KEY, mode TEXT CHECK (mode IN ('derived_overlap','derived_hard_cut','fresh_repair','emergency')), gen_from INTEGER, gen_to INTEGER, state TEXT NOT NULL, started_by TEXT, started_at TEXT NOT NULL, ended_at TEXT, result_code TEXT, probes_json TEXT, anchor_eligible INTEGER NOT NULL DEFAULT 0)`; no key, salt, proof or any derivative | H2 |
| settings `bridge.key.current`, `bridge.key.next`, `bridge.key.gen`, `bridge.rotation` | key material and state, **added to `SETTINGS_KEEP`** so they never enter an archive and a restore never writes them back | H2 |
| setting `security.owner_contacts` | list of Arx user ids | H3 |

Numbering after CR-033 (0077, 0078); the DEVTYPE branch holds 0076 (see CR-033 11.1).

## 11. UI (Hebrew; Settings only, operator screens untouched)

Settings -> תשתית המערכת -> "מפתח הגשר": generation number (never a fingerprint), last rotation (date, mode, result), buttons
"החלפת מפתח" (routine), "החלפה לפני הקטנת עוגן", "זיווג מחדש עם מפתח חדש", "ביטול חירום". Progress: "מכין", "הגשר קיבל",
"הוחלף", "המפתח הישן בוטל", "אומת" / "נכשל - חזרה למפתח הקודם". Operator screens show only the existing short "אין חיבור
לתשתית המערכת" while paused. Desktop / mobile / RTL screenshots for loading / empty / error / ready.

## 12. Audit

`bridge.rotation.requested|confirmed|prepared|bridge_ack|switched|retired|verified|aborted|failed`, `bridge.key.revoked`,
`bridge.key.revealed`, `bridge.rotation.overlap_overdue`, `bridge.rotation.notice_sent`; each with `rotation_id`, `mode`,
`gen_from`, `gen_to`, per-probe `ok|failed` and code, duration. Never a key, salt, proof, nonce, signature, or any hash or length
of them. `bridge.key.rotation_overdue` of the procedure is dropped (no schedule, decision 24).

## 13. Security review checklist

- [ ] Two keys never verify for more than 180 s on the bridge's monotonic clock, under every crash point (test 4 below).
- [ ] Commit refused when the remaining budget is under 100 s; abort path leaves cur only.
- [ ] Hard-cut modes have no instant with two valid keys.
- [ ] No key material on the wire, in `service_data`, audit, logs, backups, screens or test fixtures (synthetic `test-gen-n` only).
- [ ] Constant-time comparison for both keys; one nonce cache across keys.
- [ ] No bridge config entry reload during rotation.
- [ ] Anchor eligibility only with V1c ok; emergency never eligible (R-25).
- [ ] `bridge.key.rotate` not delegable, installation scope only; emergency notice queued in the same transaction.
- [ ] Arx refuses to start unless the bridge reports the rotation capability (procedure 10.15).
- [ ] Gate: allowed hits never echo values; markers refused for key and token shapes.

## 14. Test plan (models and fakes only)

Fake Arx and fake bridge in one process, synthetic key strings, injectable monotonic clocks on both sides, crash injection after
each persisted step, golden vectors v3 untouched:

1. Overlap: cur and next both verify inside the window; only next after retire.
2. After retire a cur-signed message is `bad_signature` before any time or state stage.
3. Cross-key nonce replay is `replay`.
4. **Cap:** for every crash point and every message loss, two keys are never valid past t0 + 180 s; C1 with less than 100 s left is
   not sent; the bridge's self-retire keeps the right key.
5. `derivation_mismatch` aborts without changing either side.
6. Hard cut (both modes): no instant with two keys.
7. Audit scan over a full run: no key, salt, proof or derivative.
8. Wire schema unchanged: v3 closed-schema vectors pass.
9. Rollback table of procedure 8.1, each row.
10. Permissions: system administrator may start every mode; operator, site admin, delegated admin cannot; emergency notice to
    owner contacts and administrators; missing owner contacts -> emergency button disabled until set, banner otherwise.
11. Events only: no code path starts a rotation without a person (grep test for timers in the rotation module).
12. Anchor eligibility matrix (mode x V1c result).
13. Gate: impact block valid / missing / two blocks / bad JSON / duplicate key / version mismatch; exit 5 text; marker syntaxes,
    wrong code, short reason, key-shape refusal; the existing 26 gate tests stay green.

NOT_RUN today: all of the above.

## 15. Slices, effort and model

| Slice | Content | Items | Hours | Model |
|---|---|---|---|---|
| G0 | merge `pilot/WX3-hmac-rotation` gate tool and its 26 tests to main (rebase, run) | - | 1 | Sonnet |
| G1 | impact block, exit 5 rename, marker formalisation, spec text, tests 13 | 26, 27, 30 | 4 | Sonnet |
| H0 | rotation fakes: two-process model, monotonic clocks, crash points | - | 4 | Opus |
| H1 | bridge multi-key verifier, `rotate` service, persisted state, 180 s cap, capability in ping | 23 | 10 | Opus |
| H2 | Arx key set, state machine, 0079, settings in `SETTINGS_KEEP`, audit | 23, 24 | 10 | Opus |
| H3 | `bridge.key.rotate`, owner contacts, emergency notice | 28, 29 | 3 | Opus |
| H4 | fresh-key re-pair with V1 (replaces regenerate), reveal flow, emergency revocation | 29 | 6 | Opus |
| H5 | maintenance screen (Hebrew), watchdog `overlap_overdue` | - | 4 | Sonnet |
| H6 | anchor eligibility record and capability status hand-over (bridge side) | R-25 | 3 (+ WisKey) | Opus |
| H7 | gate run of tests 1..13 on fakes, second review | - | 2 | Sonnet (run) + Opus (review) |
| | **Total** | | **47** | |

A live rotation is not part of any slice: first a rotation on a lab copy, then the owner's approval for the live bridge, each run
approved on its own (procedure 13.3).

## 16. Contradictions recorded (not resolved)

1. **Overlap length.** The procedure proposed `overlap_s = 180` plus a 60 s self-retire grace (up to 240 s of two keys). Decision 23
   caps the whole two-key window at 3 minutes; this CR therefore sets overlap 90 s default and a 180 s hard cap from `begin`.
2. **Hard cut before re-anchor.** The procedure (8.2) let a completed routine overlap rotation unlock the decrease; decision 23 asks
   for an immediate cut for anchor reduction. This CR follows the decision: only `derived_hard_cut` can make the decrease eligible;
   the procedure text (8.2) is to be corrected in its next draft together with the R-25 correction.
3. **"Owner" vs. system administrator.** Arx has no owner role; decision 28 makes the difference moot for starting a rotation, and
   section 7 introduces `security.owner_contacts` only for the emergency notice.
4. **WisKey's high-water** is outside Arx; R-25 is enforced on the Arx side by never claiming eligibility without V1c, but the actual
   decrease is WisKey's (W?, section 2 item 3).
