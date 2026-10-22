# Bridge key rotation - lab run plan (HMACACT-295 / HMACACT2-295)

Status: PLAN ONLY (documents). Nothing in this file was executed. Prepared on branch `pilot/KEYROT-PLAN-295` from `release/2121`
(3d31ca7f0). Prerequisite of release 2.13.0 (supervised extended-identity run with the owner).
No lab host, address, serial, token or key appears here by design: the run records them only in `secrets/` / `private-evidence/`.

Sources read: `docs/changes/CR-WISKEY-HMAC-ROTATION-295.md` (sections 3-16), `docs/user-guide/he/84-bridge-key_HE.md`,
`services/bridge_rotation.py`, `services/bridge_keys.py`, `services/bridge_rotation_peer.py`, `routers/bridge_key.py`, `routers/ha.py`,
`custom_components/smplwise_bridge/keyset.py` and `__init__.py`, tests `test_bridge_key_{rotation,activation,pause}_295.py` +
`fake_bridge_rotation_peer.py`. Paths below are relative to `smplwise_vms/backend/smplwise/` unless stated. "L" = line in the file named.
Every statement about behaviour is read from code at this sha; a live bridge has NEVER been run against it (CR section 15 "Remaining";
user guide: "not checked against a live bridge in 2.11.0 / 2.12.0"). The whole run is therefore the first live evidence.

## 1. What is being proven

1. The Arx add-on and the real `smplwise_bridge` integration (0.9.6, `keyset.py`) complete one routine rotation end to end: the first
   rotation leaves the legacy pairing secret (`g0-legacy`) and ends `verified`.
2. A second routine rotation (v2 -> v2) completes.
3. Door opening is refused (503 `bridge_key_rotating`, `outcome=not_sent`) for exactly the window the code defines and works before and after.
4. The recovery paths (R1/R2/R3, `needs_repair`, resume, re-pair) behave as designed on the real peer - only the ones the owner approves to provoke.
5. No key material reaches audit, logs, API answers or backups (live check of the fake-tested guarantee).

`hard_cut` is NOT needed for 2.13.0 and is listed as optional (section 9): it is the only mode that can set `anchor_eligible` (R-25).

## 2. Preconditions (all must hold before step 0)

| # | Precondition | How checked (read-only) | Source |
|---|---|---|---|
| P1 | Arx add-on at release 2.12.x/2.13.0 candidate; `GO_LIVE_PERMITTED = True` in the build | build identifier from the add-on; `GET /system/bridge-key` -> `go_live_permitted: true` | bridge_rotation.py L49, `view` L653 |
| P2 | Bridge integration 0.9.6 loaded in Home Assistant (needs ONE Home Assistant restart on install). 0.9.5 also has `rotate`; 0.9.6 adds lease + hardening | `bridge.integration_version` setting is set by `/ha/bridge/ping` (ha.py L646); manifest version in the repo is 0.9.6 | manifest.json, ha.py L646 |
| P3 | Bridge paired with the legacy pairing secret and announcing `rotation: "rotation_v1"` in its signed 60 s directory push; announcement fresh (TTL 600 s) | card/`GET`: `peer_available: true`, `automatic: awaiting_click` (first rotation), `can_start: true` | bridge_rotation_peer.py L29, L54, L68; ha.py L659; bridge `__init__.py` L559 |
| P4 | Switch `bridge.key_rotation` on (default on). Reminder interval `0` for the first run so the worker cannot start a second rotation on its own | `GET` -> `enabled: true`, `reminder_days: 0` | bridge_rotation.py L108-L121 |
| P5 | No rotation active, last rotation not `needs_repair` | `GET` -> `rotation: null`, `blocked_by: null` | preflight L251-L262 |
| P6 | The operator running the click is a system administrator holding `bridge.key.rotate` (system_admin role only; `system.configure` alone is refused 403). A local (Arx-only) identity needs the second factor (`LOCAL_ADMIN_PERMISSIONS`) | owner confirms role | CR 16.1; routers/bridge_key.py L53-L58, L129 |
| P7 | Request comes from a local session (not remote/Cloudflare channel; `BLOCKED_ON_REMOTE`) | owner uses the LAN UI | routers/bridge_key.py docstring |
| P8 | Wall clocks of the add-on host and the Home Assistant host agree within a few seconds (signature window is 60 s, budget uses Arx wall clock, bridge cap uses its monotonic clock) | read-only time compare, recorded as an offset only | bridge_keys.py WINDOW_S; keyset.py L221 |
| P9 | Door-opening test target agreed with the owner: ONE designated door/test station, owner physically present, no real person depends on that door during the window. (Door opens are physical actions: see approvals A6.) | owner statement | CLAUDE.md |
| P10 | Fresh backup of the Arx data directory incl. the per-install key file, and a note of how to re-pair (guide 84, "three states") taken by the owner BEFORE the first rotation. Reason: the first rotation deletes `bridge.secret` from `settings`; after it the pairing code cannot be shown again | owner confirms | bridge_keys.py L304-L316; ha_bridge.py L87-L96 |
| P11 | Evidence folder `private-evidence/keyrot-<date>/` exists, gitignored; redaction rule: kids may be recorded (they are not secret by design, `g<gen>-<8 hex>`), hosts/IPs/entity ids may not leave it | - | CLAUDE.md |
| P12 | Owner is told the dependency on the legacy kid-less recipe: until a rotation completes both sides sign the old recipe; after the first rotation EVERY bridge call (media, devices, alarm, directory, trusted door, lease) carries a `kid` and the old pairing secret is gone. A bridge/HA restored from a pre-rotation backup then needs a re-pair | - | CR 15 upgrade order, 15.1 HA-02 |

Not defined by code (cannot be pre-checked): how the owner knows the bridge has actually loaded 0.9.6 other than the version field and
the announcement; whether the HA service call `smplwise_bridge.rotate` timeout of 20 s (peer.py L31) is enough on the lab network.

## 3. How the code drives a rotation (state machine)

Rotation states: `prepared -> publishing -> published -> confirmed -> switching -> switched -> retiring -> retired -> verified`;
terminal: `verified`, `verify_failed`, `rolled_back`, `retired`; stuck: `needs_repair` (bridge_rotation.py L61-L63, L84).
Key states: `pending -> next -> current -> retiring -> retired`; `discarded` for a rolled-back next (CR section 3).
Every step is its own committed write transaction BEFORE the next peer call (write-ahead). The HTTP request drives S0-S5 synchronously.
Retirement (S6-S7) after the overlap is driven by the worker (`worker_loop`, every 5 s while a rotation is active, 60 s idle, L752-L768,
first pass 45 s after start) or by a `GET /system/bridge-key` (which itself calls `tick`, routers/bridge_key.py L82-L83) or `resume`.
IMPORTANT for evidence: a status GET is not purely passive - it can retire a key or roll back an interrupted rotation (L517-L544).

Constants: overlap default 90 s (L60), allowed 0..120 (L268), whole two-key window cap 180 s from t0 (L57), commit only if >= 100 s
budget left (L58, L359), Arx retiring window ends at most t0+170 s (L59, L381). Peer call timeout 20 s (peer.py L31).
Timing consequence (derived, not stated in code): begin + two probes can use up to 3 x 20 s; if they exceed ~80 s from t0 the commit is
refused (`budget_exceeded`, rolled back). On a healthy LAN each call is expected well under a second.

### Sequence table (routine mode)

| Step | Code | What happens | Peer op / signed with | Persisted before call | On failure |
|---|---|---|---|---|---|
| S0 preflight | `preflight` L251-L262, `start` L264 | switch on, permit, peer capability fresh, no active rotation, last not `needs_repair`; request must carry `confirm: true` (router L126-L138) | - | - | 409 refusal (`rotation_off`, `rotation_not_permitted`, `peer_unavailable`, `rotation_in_progress`, `repair_required`, `key_unreadable`, `not_paired`); nothing written; audit `bridge.rotation.requested` denied |
| S1 prepare | `_start` L278-L304 | one transaction: adopt the pairing secret as `g0-legacy` (sealed) and DELETE `settings.bridge.secret` (first rotation only; audit `bridge.key.adopted`); new key `g<n>-<hex>` derived by HKDF from K_cur + 32-byte salt, sealed `pending`; rotation row `prepared` | - | state `prepared` | R1 not needed (nothing sent) |
| S2 publish | `_publish` L308-L329 | step `publish_sent` with t0 written first; `begin{kid_next, gen_next, salt, overlap_s, mode}` | `begin` / K_cur; answer must be signed by K_cur (H-09) and contain `proof = HMAC(K_next, "rotation-ack|"+id)`; Arx compares constant time | `publishing` | R1 with code `peer_unreachable`, peer code, `peer_bad_answer`, `derivation_mismatch`, `key_unreadable`. Bridge side: `_op_begin` keyset.py L268-L287 refuses if kid != signing key, a rotation open, or bad fields |
| S3 confirm | `_confirm` L339-L352 | probe signed with K_next must be answered ok (by K_cur); probe signed with K_cur must be answered ok | `probe` / K_next, then K_cur | key `next`, rotation `published` | R1 `probe_next_failed:<code>`, `probe_current_failed:<code>` |
| S4 switch | `_switch` L358-L375, `_finish_switch` L377-L392 | budget check; step `commit_sent`; `commit` signed with K_next; answer must be signed by K_next. On ok: ONE transaction K_cur -> `retiring` (`verify_until = min(now+overlap, t0+170)`), K_next -> `current`, rotation `switched`; then capture leases revoked + lease event stream reset (T9) | `commit` / K_next | `switching` | `budget_exceeded` -> R1. Peer refusal -> R1 `commit_rejected:<code>`. No/untrusted answer -> R2 |
| S5 post-switch probe | `_after_switch` L394-L401 | probe under K_next, answered under K_next | `probe` / K_next | - | R3 (`post_switch_probe_failed:<code>`) |
| wait | `tick` L533-L539 | rotation stays `switched` until `verify_until` (default ~90 s after the switch) - doors stay paused throughout | - | - | - |
| S6 retire | `_retire` L405-L422 | step `retire_sent`; `retire` under K_next; K_cur wiped (`retired`, `value_enc = NULL`) whatever the peer says; WAL scrub (`PRAGMA wal_checkpoint(TRUNCATE)`, bridge_keys.py L294-L301) | `retire` / K_next | `retiring` | peer refuses/no answer: still wiped, rotation records `peer_retire_unconfirmed`; the bridge's own cap (keyset.py L157-L170) drops the old key at t0+180 s |
| S7 verify | `_verify` L424-L446 | probe under K_next must be ok; routine mode: `status` under K_next must say `old_key_present == false` and `active_kid == K_next` (no probe with the old key: its material is wiped) | `probe`, `status` / K_next | - | `verify_failed` (alert on card; keys stay as they are), result code `old_key_not_rejected` or the probe code |

Bridge side, for reference: `commit` swaps signing key and keeps `old` (keyset.py L293-L303); `retire` drops `old` and closes the
rotation (L305-L314); `status` reports `rotation`, `active_kid`, `old_key_present` (L336-L339); every control message that does not
verify gets an UNSIGNED refusal (L246-L253, HA-01). Bridge persists state before answering (`__init__.py` L584-L594); a failed save
reloads the old state and raises (outcome unknown for Arx -> `status` recovery).

### Door pause (what is observable)

`door_commands_paused` (L89-L101) is true while the switch is on AND (a rotation is in any state `prepared..retiring` OR the latest
rotation is `needs_repair`). It therefore starts at S1 and ends only after S7 writes `verified` (or any terminal state). Effects, scope
exactly as coded: `door_open` / `door_open_status` -> 503 `bridge_key_rotating`, `outcome: not_sent`, audited as `intercom.release`
denied (routers/doors.py L404); access-control door route (routers/access_control.py L893); capture-lease start 503; lease event worker holds and
retries (services/lease_events.py L124). NOT paused (by design, CR 16.2): media, devices, alarm and other bridge calls - they are signed by
whichever key is current and the peer verifies both during overlap. Residual stated in CR 16.2: a command signed with the old key just
before the switch can hit a `hard_cut` peer after it dropped that key; the peer rejects it (fail closed).

### Rollback / repair (as coded)

- R1 (before the switch) `_rollback` L450-L466: best-effort `abort` under K_cur, K_next -> `discarded` (wiped), rotation `rolled_back`, scrub. K_cur never touched.
- R2 (commit outcome unknown) `_unknown_commit` L468-L492: `status` under K_cur. `committed` (must be signed by K_next, else `peer_bad_answer`) -> finish the switch locally and continue; `not_committed` / `unknown_rotation` / `aborted` -> R1 `commit_not_applied`; no answer -> stays `switching`, retried by worker/`tick`/`resume`; when the budget (t0 + 180 s) is exhausted without an answer -> `needs_repair` `commit_outcome_unknown`.
- R3 (peer rejects K_next after the switch) `_switch_back` L494-L513: `abort` under K_cur; accepted -> K_next `discarded`, K_cur `current` again, `rolled_back`; not accepted -> `needs_repair` with both keys kept sealed.
- Crash recovery `tick` L517-L544: `prepared/publishing/published/confirmed` -> R1 (`interrupted`, or `restore`); `switching` -> R2; `switched` -> retire once `verify_until` passed; `retiring` -> `_retire` again (idempotent).
- `needs_repair` repair `resume` -> `_repair` L555-L608: `status` under the current key; the peer's `active_kid` must be K_from or K_to and signed by itself; when it says K_to, a probe under K_next answered under K_next is required (H-05); then align (`retired`/`rolled_back` with `aligned_to_next` / `aligned_to_current`) and audit `bridge.rotation.recovered`. If the peer stays silent or says something else, the rotation stays `needs_repair` and doors stay paused.
- Last resort re-pair: `GET /ha/bridge/pairing?regenerate=true` (ha.py L627-L637, ha_bridge.py L87-L96) wipes the whole key set (`bridge_keys.reset_set` L319-L335), closes an unfinished rotation as `rolled_back/repaired`, revokes capture leases, clears the peer capability, and shows a NEW code to type into the bridge config flow. This is the documented path for the three re-pair cases in guide 84.
- Auto-retry back-off (worker, later rotations only): 1 h doubling to 1 day after consecutive failures (L705-L716).

## 4. Execution plan, step by step

Legend: **[R]** read-only; **[W-ARX]** writes Arx state (rotation rows, keys, settings, audit); **[W-BRIDGE]** changes bridge state (via the `rotate` service the code itself calls); **[PHYS]** physical action (door).
Every [W] step is covered by an owner approval from the checklist in section 7. Evidence = what to capture read-only, stored in `private-evidence/`, redacted.

Common read-only evidence kit (each time "snapshot" is written): `GET /system/bridge-key` body (it contains kids, generations, states, times, `blocked_by`, `automatic`, rotation steps list - never material; but see the `tick` caveat above); audit rows with action prefix `bridge.` and `settings.changed` for the key flag; add-on log lines (grep `bridge_rotation`, `bridge_rotation_peer`); bridge-side log of the `rotate` service as shown in the Home Assistant log viewer by the owner (read-only); a timestamp of each event with the clock offset from P8. Never capture request/response bodies of `rotate` calls verbatim (they carry nonce/sig/salt): record op name, ok flag, code only.

| # | Step | Class | Action | Observe / read-only evidence | Expected | Abort criterion |
|---|---|---|---|---|---|---|
| 0 | Baseline | [R] | Snapshot; confirm P1-P8; confirm `bridge.secret` still present only as "paired" state (pairing endpoint reports `key_set: false`) | snapshot S0; HA integration version; clock offset; `paired_at` | `adopted: false`, `peer_available: true`, `automatic: awaiting_click`, `can_start: true`, `history: []` | Any of: `peer_available` false for > 10 min (TTL 600 s) -> stop, bridge not announcing; `blocked_by` not null; `key_unreadable` |
| 1 | Pre-rotation door baseline | [PHYS] | Owner opens the test door once via Arx | door_open audit row allowed; HA door entity change seen by owner | success | door open fails BEFORE any rotation -> stop: environment fault, not a rotation fault |
| 2 | Start first routine rotation (S0-S5) | [W-ARX][W-BRIDGE] | Owner clicks "Start rotation" (or `POST /system/bridge-key/rotations {mode: routine, confirm: true}`) as system admin | immediate response (rotation `switched`, or an error code); snapshot right after; audit chain `requested, prepared, published, confirmed, switched`; capture-lease revocation audit if any lease existed; step list with codes; elapsed wall time from t0 to `switched` | HTTP 200, rotation `state: switched`, `kid_from: g0-legacy`, `kid_to: g1-<hex>`, `gen_to: 1`; `bridge.key.adopted` audited once; `GET` shows key set with `current` = g1, g0-legacy `retiring` with `verify_until` ~ now+90 s; `bridge.secret` removed (pairing endpoint `key_set: true`, no code) | Any step code other than ok -> let the automatic rollback finish, do not retry blind; capture the code and stop (see section 6). `budget_exceeded` -> stop and investigate latency before retrying |
| 3 | Door during overlap | [PHYS] | Owner attempts the test door while state is `switched` (inside ~90 s) and once earlier if the rotation is slow enough to see `prepared..confirmed` | door_open answer: 503 `bridge_key_rotating`, `outcome: not_sent`; audit `intercom.release` denied; card shows the "doors paused" line | refused, nothing sent, door does NOT move | Door OPENS during the pause -> **stop, report as a defect** (the pause failed open); door refused outside the window -> defect (pause stuck) |
| 4 | Overlap: other bridge calls | [R] | While in overlap, view an ordinary read-only bridge-backed screen (e.g. the directory/ping appears in the next push at 60 s; ordinary devices read) - only if already available in the lab; no new writes | add-on log: pushes signed with a `kid`; no `bad_signature`/`key_*` refusals counted (`bridge_keys.REFUSALS` is internal; the visible signal is log/audit) | the bridge's next directory push verifies under `g1` (or `g0-legacy` still within window); capability announcement continues | repeated refusals of the bridge's own pushes after the switch -> suspect K_next mismatch on the bridge; go to step 6 branch |
| 5 | Retirement and verify (S6-S7) | [W-ARX][W-BRIDGE] (driven by the worker, no click) | Wait for `verify_until`; do not call `resume`. Optionally poll `GET` no faster than every 15 s (each GET can tick) | audit `bridge.rotation.retired` then `bridge.rotation.verified`; rotation `verified`, `peer_retire_ok` 1; `g0-legacy` state `retired`; `anchor_eligible: false` (routine) | within ~90-100 s of the switch (worker polls every 5 s while active); `verified`; `blocked_by: null` again; doors work again | `verify_failed` with `old_key_not_rejected` or a probe code: stop, capture, do NOT start another rotation (keys stay as they are by design); `peer_retire_unconfirmed` is acceptable ONLY if the bridge's own 180 s cap then removes the old key - confirm by a `status`-equivalent via the next rotation or owner-visible HA log; otherwise open a defect |
| 6 | Post-rotation door check | [PHYS] | Owner opens the test door again | allowed, signed with `g1` | success | refusal `bridge_key_rotating` after `verified` -> defect (pause stuck); any other failure -> go to section 6 |
| 7 | Persistence across restarts | [W-ARX]/[W-BRIDGE] (restart is a system action) | Owner restarts the Arx add-on, then (separately) Home Assistant / the integration | snapshot after each; first directory push after restart verifies; no `replay` storms (H-04 high-water persists in `bridge_keys.hw_ts` and in the bridge state) | key set still `g1` current on both sides; pushes verify; no `needs_repair` | bridge cannot verify after its restart -> the bridge state save is suspect; stop and capture; recovery by re-pair (section 6, F6) |
| 8 | Second routine rotation (v2 -> v2) | [W-ARX][W-BRIDGE] | Same click as step 2 | same evidence; `gen_to: 2`, `kid_from = g1-...`; no adoption audit (`bridge.key.adopted` appears only for the first) | `verified`, `g1` retired, `g2` current | as step 2 |
| 9 | Door and lease side effects | [R] + [PHYS] | Repeat steps 3 and 6 around rotation 2 only if the owner wants the second proof; otherwise skip | as before | as before | as before |
| 10 | Secret scan | [R] | Run the repo's secret-scan approach against the captured audit rows and add-on log from the run (the fake-tested guarantee: no key, salt, proof, nonce, signature or hash in audit/logs); compare against the known key bytes ONLY inside the add-on host with tooling that never prints them (owner-run) | zero hits | zero | any hit -> stop, treat as a security finding, escalate before 2.13.0 |
| 11 | Optional: automatic later rotation | [W-ARX] | Owner sets reminder interval 30 d (settings change) and checks the card shows `scheduled`/`idle`; the worker would start one only after the interval passes - NOT demonstrable in a lab run without changing the clock/data. Do not fake time on the live system | card state only | `automatic` `idle` -> `scheduled` semantics as coded (L673-L683) | n/a |

Result of step 11 note: the code does not define a manual way to make `reminder_due` true other than waiting (`reminder_due` L611-L619 uses `activated_at` of the current key). The only option is the unit tests (`test_first_rotation_waits_for_the_click_and_later_ones_start_by_themselves`). State this in the report instead of provoking it.

## 5. Evidence to capture per step (read-only, summary)

- Rotation row via `GET /system/bridge-key`: `state`, `kid_from`, `kid_to`, `gen_*`, `t0_at`, `switched_at`, `ended_at`, `result_code`, `peer_retire_ok`, `anchor_eligible`, `steps[]` (code + time per step).
- Key rows: kid, generation, state, `activated_at`, `verify_until`, `ended_at`. Confirm a retired key has no material (the API never returns it; the guarantee is the DB CHECK in migration 0135 - owner-run DB check shows only `value_enc IS NULL`, never the content).
- Audit rows (names in CR section 8): `bridge.rotation.requested|prepared|published|confirmed|switched|retired|verified|rolled_back|failed|needs_repair|recovered`, `bridge.key.adopted`, `intercom.release` denied for paused doors.
- Timings: t0 -> switched (budget used of 180 s), switched -> verified, any `peer_unreachable`.
- Bridge side: Home Assistant log lines of the `smplwise_bridge.rotate` service (op and ok only) and the integration version.
- Door evidence: result code, `outcome`, owner's physical observation.

## 6. Failure cases (provoke ONLY with explicit approval; each is a write or a deliberate fault)

None is needed to pass the minimal 2.13.0 gate; each proves an automatic path on the real bridge. The code gives no built-in fault injection against a live peer (injection exists only in `tests/fake_bridge_rotation_peer.py`), so each case needs an external, owner-performed action.

| # | Case | How it can be provoked (owner action, not defined by code) | Expected per code | Class |
|---|---|---|---|---|
| F1 | Peer unreachable at `begin` | Owner stops/disables the bridge integration (or HA) just before the click | `PeerUnreachable` -> R1 `peer_unreachable`; rotation `rolled_back`; K_cur untouched; doors pause only while it ran; then re-start works after the bridge returns (no back-off for manual start) | physical/system stop of HA integration |
| F2 | Interruption between steps (crash recovery) | Owner restarts the Arx add-on while a rotation is `switched` or earlier | before the switch: R1 `interrupted`; `switching`: R2; `switched`: worker retires after `verify_until` (`tick`) | add-on restart |
| F3 | Bridge restarts during the overlap | Owner restarts HA during `switched` | bridge reloads persisted state (keyset.py L94-L121), `old` stays until t0+180 s cap; Arx retires; verified. If the bridge lost the new state: R3/`needs_repair` | HA restart |
| F4 | Commit outcome unknown (R2) | Not reproducible on demand without cutting the network during the `commit` call | `status` -> finish or R1; silent past budget -> `needs_repair` | network fault |
| F5 | `needs_repair` and resume | Only if F4/R3 produces it; then `POST .../rotations/{id}/resume` (needs `bridge.key.rotate`) | `_repair` aligns to the peer's key after a probe (H-05) or stays `needs_repair` | resume click = [W] |
| F6 | Re-pair after a failed repair or key-file loss | Owner: Settings > diagnostics > "new pairing code" (`regenerate=true`) and type the new code into the bridge config flow | key set wiped, new pairing, `awaiting_click` returns, capture leases revoked | **destructive for the pairing: highest-risk approval** |
| F7 | Switch off during a rotation | Owner sets `enabled: false` mid-rotation | `door_commands_paused` becomes false at once (mode off), engine no longer drives the rotation - the code does not say what happens to the half-finished rotation on the bridge side other than its own 180 s cap; re-enabling then lets `tick` handle it | settings write |
| F8 | Hard cut | `POST ... {mode: hard_cut}` | no overlap, old key dropped at commit, V1c probe under the old key must be refused, `anchor_eligible = true` only if verified | optional, see section 9 |

Explicitly NOT to be done: tampering with the key file, the sealed blobs, the bridge state store, nonce/high-water values, HA users, tokens or go2rtc; no replay injection against the live bridge.

## 7. Owner approval checklist (every WRITE needs a task-specific yes)

| ID | Action | Why it needs approval |
|---|---|---|
| A1 | Start routine rotation #1 (adopts the pairing secret, deletes `settings.bridge.secret`, changes the bridge's signing key) | irreversible without a re-pair |
| A2 | Start routine rotation #2 | writes Arx + bridge key state |
| A3 | Let the worker run retirement; allow `resume` if a rotation sticks | wipes old key, may align keys |
| A4 | Restart the Arx add-on / HA integration during the run (F2/F3, step 7) | system action |
| A5 | Each failure case chosen from F1-F8 (named individually), incl. re-pair F6 and hard_cut F8 | deliberate fault / destructive |
| A6 | Door open attempts on the single named test door, owner present | physical action |
| A7 | Setting changes: switch off/on, reminder interval | settings write |

Rules for the run: one approval per item, no carry-over; stop at first abort criterion; no retry without a new yes.

## 8. Results template

| Step / case | Date-time (clock offset noted) | Operator | Command/click | Result code or state | Expected | Pass / Fail / NOT_RUN / BLOCKED | Evidence file (private-evidence) | Notes |
|---|---|---|---|---|---|---|---|---|
| 0 baseline | | | | | `awaiting_click` | | | |
| 1 door before | | | | | open ok | | | |
| 2 rotation #1 start | | | | | `switched` g0-legacy -> g1 | | | |
| 3 door in overlap | | | | | 503 `bridge_key_rotating`, not_sent | | | |
| 4 other bridge traffic | | | | | pushes verify | | | |
| 5 retire + verify | | | | | `verified`, old key retired | | | |
| 6 door after | | | | | open ok | | | |
| 7 restarts | | | | | state persisted | | | |
| 8 rotation #2 | | | | | `verified`, g1 -> g2 | | | |
| 10 secret scan | | | | | zero hits | | | |
| F-cases chosen | | | | | per section 6 | | | |
| Timings: t0 -> switched (s) / switched -> verified (s) | | | | | < 80 s / ~90-100 s | | | |

Honest-reporting rule (CLAUDE.md): anything not run is NOT_RUN, anything blocked by environment is BLOCKED; never "passed" without evidence.

## 9. Open questions for the owner

1. Which single door/test station may be used for the pause check, who is present, and is a door that really opens physically acceptable, or should a non-actuated test door (no mechanism) be used?
2. Is the bridge integration 0.9.6 already loaded in the lab Home Assistant (one restart needed), and who restarts it? Does the lab bridge announce `rotation_v1` today?
3. Which failure cases F1-F8 (if any) do you approve for 2.13.0, in particular F6 (re-pair, destructive) and F7? The minimal gate is steps 0-6 plus 10.
4. Is a second rotation (v2 to v2, step 8) required for the gate, or is the first rotation enough?
5. Is `hard_cut` (and thus the V1c old-key probe, anchor eligibility R-25) in scope for 2.13.0? The code needs it only for anchor decreases.
6. Reminder interval: leave at 0 (no automatic later rotation) for the run and for the release default? CR 2 item 2 asked the owner to confirm reminder vs "events only" and the answer is not recorded in the files read.
7. Contradiction 1 of the CR (key id on the wire vs. unchanged wire format): is it acknowledged that WisKey never verifies these messages today and the DTO v3 vectors stay valid only for `g0-legacy`? Needed before the extended-identity run, which uses the capture lease / trusted door path signed with `kid` after rotation.
8. Backup/re-pair readiness (P10): who holds the pairing code procedure and the key-file backup, and is a lab re-pair acceptable if the run ends `needs_repair`?
9. Evidence handling: may the redacted snapshots (kids, states, codes, timings; no hosts) be copied into `tests/fixtures/` or a release note after review, or stay in `private-evidence/`?
10. Door pause scope: CR 16.2 pauses only the trusted door path; media/devices/alarm calls keep running during the window. Accepted for the lab run?
11. Known gaps for the record, not blockers of the lab run (CR 16.3 / 15 "Remaining"): `fresh_repair` and `emergency` modes and owner notice are not built; WisKey high-water hand-over not built; no live run has ever happened; a status GET can advance a rotation (tick). Does the owner accept running 2.13.0 without them?

## 10. Not defined by the code (stated, not invented)

- How long the door pause lasts in wall-clock terms on a real bridge: derived as S1..verified, about overlap (90 s) + a few seconds; the code defines no maximum other than the 180 s cap and `needs_repair` (which pauses indefinitely until resume or switch-off).
- Behaviour of the lab Home Assistant service-call timeout beyond the 20 s `CALL_TIMEOUT_S`.
- What the bridge does with a rotation left open when the switch is turned off on the Arx side (only its own cap is defined).
- Any automatic cleanup of a `needs_repair` rotation: none; it requires `resume` or a re-pair.
