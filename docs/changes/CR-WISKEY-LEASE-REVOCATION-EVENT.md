# CR-WISKEY-LEASE-REVOCATION-EVENT - the Arx-side revocation event and lease ledger for WisKey's explicit-Arx-lease card capture (C04 route b)

Status: APPROVED by the owner 2026-10-16 (Arx side built and merged OFF; GO_LIVE_PERMITTED=False; go-live needs a separate owner permit)

History: written as PROPOSED (design and documents only, 2026-10-16) on branch `pilot/CR-LEASE-REVOKE` from `origin/main` 886ef3f4
(2.5.8); no device, reader, door, key, secret or live system was touched to write it. The Arx side (LEASE-BUILD / LEASE-FIX) is merged
on integ/264 with the route OFF (`access.capture_lease` default `off`, `MIN_BRIDGE_FOR_CAPTURE_LEASE = None`, `GO_LIVE_PERMITTED = False`
in code). **This approval is not the go-live permit:** switching the route on needs the owner's separate written permit (section 7.3).
Arx-only (USR2 local) actors: their authority changes are wired to the same triggers since `pilot/LEASE-ARXONLY` (integ/264 risk 8,
see section 1.4 note and `docs/release/2.6.4-INTEGRATION-NOTES.md`).

Owner decision encoded (2026-10-16, question 2 of the C04 reply): **option א** - open a separate Arx change request to design
the revocation event; the lease stays OFF until the event exists on the Arx side. Owner decision for C03 (question 1):
**option א** - whoever currently holds the Arx permission for the original action on that target may look up an old
action's status, plus an Arx-side setting (system administrator only) that can widen it later (section 5).

Companions: `CR-033-WISKEY-DOOR-PATH.md` (signed trusted-caller transport, station scope, clock rules), `CR-034` (key rotation,
on `origin/pilot/WISKEY-CRs`), `CR-036-WISKEY-NATIVE-SCREENS.md` (S3 projection authority, S11 capture permissions),
`CR-011-SECOND-FACTOR.md`, the USR2 spec (`docs/design/USR2_ARX_ONLY_IDENTITY_SPEC.md` on `origin/pilot/USR2-spec`).

## 0. Sources, precedence, evidence marks

| Source | Where | Version |
|---|---|---|
| Owner-facing C04/C03 reply (sections 4, 5, 7 are binding here) | `private/planning/ARX_REPLY_TO_WISKEY_WRC01_C04_2026-10-16_HE.md` | 2026-10-16 |
| WisKey C04 draft (route b) | `docs/WISKEY_C04_EXPLICIT_ARX_LEASE_REVISION_DRAFT_2026-10-16_HE.md` in the read-only worktree `C:\hik intercom_rev_wrc01_c04` (commit `032308f8`) | read in full, nothing run |
| Trusted-caller DTO v3 (`wiskey-trusted-door-v1`) | `docs/contracts/wiskey-trusted-caller/DTO_DRAFT_v3.md`, `GOLDEN_VECTORS_v3.json` | main |
| Identity and RBAC contract | `docs/security/HA_IDENTITY_RBAC_HE.md` (§6, §7, §8, §11, §15), `ADR-012` | main |
| Arx code facts | `services/intercom_capture.py`, `routers/access_control.py` (capture section), `services/trusted_door.py`, `services/intercom_authority.py`, `services/wiskey_channels.py`, `services/intercom_sync.py`, `services/revocation.py`, `services/leases.py`, `services/second_factor.py`, `routers/second_factor.py`, `services/ha_user_auth.py`, `routers/settings.py`, `db.py`, `audit.py`, `integration/smplwise_bridge/{__init__,signing}.py`, `main.py` | main @ 886ef3f4 |

Precedence (CLAUDE.md): an approved change request, then `MASTER_SPEC_HE.md` and `docs/security/`, then `AGENTS.md`, then
this document. Contradictions are recorded in section 8, not resolved.

Evidence marks: **V** read in Arx code at 886ef3f4; **R** reported by a source document; **W?** WisKey behaviour that is NOT
verified by Arx (no WisKey code or runtime was read or run for this CR beyond the one draft named above); **D** design
proposal of this CR.

Vocabulary. *Lease* = the Arx decision object issued at `capture_start` that lets WisKey continue ONE card-collection session
for at most 120 s (R, draft L02/L03). *Receiver* = the configured reader connection on a station (`station` = the opaque
`config_entry_id`, `reader_id` 0..8; V). *Authority of a lease* = the conjunction of facts the decision rested on: the actor's
effective permissions at `permission_revision`, the station/target binding, the person, the receiver, the feature switch, and
the installation being up. Every change of any of these is a *trigger* (section 1.4).

## 1. What Arx must add: the signed revocation event

### 1.1 Channel: the signed trusted-caller transport, one new bridge service (justified)

The C04 draft (R, 5.2 of the reply) requires that the lease be "issued only by Arx and verified by the same bridge mechanism
that verifies requests today", and that WisKey add no key, signer or crypto. Arx has exactly one mechanism that carries a
signed Arx authority object to WisKey: the trusted-caller DTO (V `services/trusted_door.py`: `ha_bridge.sign` over a closed
body, `signed_message_json`, bridge verifies stages 1-7 in `smplwise_bridge`, WisKey owns stage 8; R DTO v3 §12). The four
lease requests of route b are WisKey's generalized W1 envelope (R: "x-authority: fresh Arx decision per dispatch", "x-expiry
<= 15 s"), which is that same mechanism generalized. The revocation event therefore rides the SAME transport:

- **One new bridge service `smplwise_bridge.lease_event`** (`supports_response: ONLY`, data exactly `{signed_message_json}`),
  registered next to `execute` / `schedule` / ... (V `__init__.py:346-448`), verifying stages 1-7 exactly as `door_open` will,
  then handing the immutable internal DTO to WisKey's in-process capability (stage 8, W?). Protocol string
  `wiskey-capture-lease-v1`; `MAX_MESSAGE_BYTES` 8192; lifetime of the message itself `0 < expires_at - issued_at <= 15` s
  (the request TTL every lease-route message already has; R draft L03), not the 30 s of the door DTO.
- Why not the WS service channel (`cards/*` on `wiskey_channels.SERVICE`, V): it is authenticated by `SUPERVISOR_TOKEN`
  only, WisKey sees the add-on's one HA user, there is no pairing-key signature, no closed schema, no replay journal, and no
  binding to `permission_revision` - exactly what the review text refuses ("no periodic check as a substitute").
- Why not the HA event bus or an HA entity: unauthenticated inside HA, visible to every integration, no acknowledgement.
- Why not a bridge-to-add-on callback (WisKey pulling): the lease route's authority flows one way (Arx decides, WisKey
  verifies). A pull would make the add-on's HTTP machine routes an authority surface and needs a second verifier. Rejected.

The bridge service does not exist today, exactly as `door_open` does not (V `MIN_BRIDGE_FOR_TRUSTED_PATH is None`). It is
the minimal new route: one service name, one verifier reuse, one hand-off. It ships in the same bridge line as `door_open`
(0.9.x) and, like it, is gated on WisKey's consumer being confirmed (W?, section 7.4).

### 1.2 Message types and closed schema (D; final JSON Schema in slice L0, `additionalProperties: false` everywhere)

Common wire fields (as DTO v3 §2, same character rules, same `ts == epoch(issued_at)`, explicit 32-hex `nonce`, `sig`):
`protocol` = `wiskey-capture-lease-v1`; `action`; `actor {id, display_name}` = the Arx principal that owns the lease (for
`scope: all` the add-on's own installation id as actor id, display name `SmplWise Arx`); `station` = the lease's station
`config_entry_id` (for `scope: all`: the literal `*`); `request_id` (UUIDv4, never reused); `issued_at`, `expires_at` (≤15 s);
`params` per action:

| `action` | `params` (all required) | Meaning |
|---|---|---|
| `lease_revoke` | `stream_id` (32 hex), `sequence` (int ≥ 1), `scope` (`lease` \| `actor` \| `station` \| `all`), `lease_ref` (UUIDv4, or `*` unless `scope = lease`), `permission_revision` (int), `reason` (closed enum, 1.4), `revoked_at` (UTC whole seconds) | Authority of the named lease(s) is gone. WisKey destroys the session and the collected card, no confirm, before any cleanup await (R draft L08) |
| `lease_heartbeat` | `stream_id`, `sequence` (the LAST sequence sent, not a new one), `live_leases` (array of `lease_ref`, ≤ 8), `permission_revision` | Liveness of the revocation stream while at least one lease is live. Carries nothing that grants |
| `lease_stream_reset` | `stream_id` (the NEW stream), `previous_stream_id` (32 hex or `*`), `sequence` = 1, `reason` (`startup` \| `repair` \| `restore` \| `key_rotation`) | Every lease WisKey still holds from any earlier stream is destroyed; the sequence restarts at 1 |

The lease OBJECT itself is not a message of this CR: it is the Arx decision signed INTO the `capture_start` envelope (R draft
L02, 5.1 of the reply, WisKey's revision). This CR fixes the fields Arx will put there so the revocation can bind to them:
`lease_ref` (UUIDv4, the ledger id), `lease_issued_at`, `lease_expires_at` (`0 < expires - issued <= 120`), `actor.id`,
`station` + `binding_revision` (opaque, as WisKey published it; W? for its exact source), `person_ref` + `person_revision`,
`permission_revision`, `receiver {reader_id}` (logical id only), `stream_id`, `sequence_at_issue` (the revocation stream
position when the lease was issued), `lease_actions` = exactly the four capture commands. Never an address, serial, MAC, card
value, hash or length (R draft L09).

Answers (closed set, D): `{"result": "acknowledged", "request_id", "sequence", "destroyed": n}` ·
`{"result": "duplicate", "request_id", "sequence"}` (same sequence, same body hash, nothing done) ·
`{"result": "stale", "request_id", "sequence", "last_sequence"}` (sequence below the host's last; the named lease, if still
live, was destroyed anyway - a revoke never un-revokes) · `{"result": "gap", "request_id", "sequence", "last_sequence",
"destroyed": n}` (the host destroyed EVERY live lease because a sequence was skipped) · `{"result": "conflict", "request_id",
"sequence", "destroyed": n}` (same sequence, different body: everything destroyed) · `{"result": "unknown_stream",
"request_id"}` (the host does not know `stream_id`; it holds no lease from it) · `{"result": "rejected", "stage", "code"[,
"request_id"]}` with DTO v3's refusal rules (`request_id` echoed iff the schema stage passed). No answer carries a card value,
a person name or a station address.

### 1.3 Ordering, replay, duplicates and delivery semantics

- **Monotonic sequence.** One revocation stream per installation (`stream_id`), one counter `next_sequence` persisted in
  SQLite (section 2.3) and incremented in the same transaction that writes the ledger row for the revoke. `lease_heartbeat`
  repeats the last sequence and never advances it. WisKey keeps `(stream_id, last_sequence, last_body_sha256)` (W?).
- **Gap** (`sequence > last + 1`): the host destroys every live lease and answers `gap`. Arx records the answer, marks every
  live ledger row `revoked(reason = host_gap)` and audits. Nothing is replayed to "fill" the gap: a gap means authority was lost
  on an unknown lease and the only safe reading is "all gone" (the review text's fail-closed rule).
- **Duplicate** (same sequence, same body hash): idempotent, `duplicate`. Arx treats it as acknowledged.
- **Replay** of the wire message itself (same nonce): refused by the bridge at stage `state/replay` as every DTO message; a
  nonce is never reused by Arx (fresh 32-hex per send; V `trusted_door.sign_message`).
- **Old event** (`sequence < last`): `stale`; the named lease is destroyed if still live. Arx treats it as acknowledged.
- **At-least-once with idempotence.** Arx sends a revoke and retries every 2 s with a NEW envelope (new `request_id`, new
  nonce, SAME `sequence`, same `params`) until one of `acknowledged | duplicate | stale | gap | conflict | unknown_stream`
  arrives, or until `lease_expires_at + 15 s` has passed (after which WisKey's own expiry has destroyed the session anyway;
  R draft L03 "processing ends no later than lease_expires_at"). Retrying is allowed here because the message's only effect
  is the LOSS of authority - it is not a physical command (AGENTS.md "never queue or blindly retry physical commands"
  concerns effects on the world; recorded in 8.1).
- **Disconnect on the WisKey side.** The transport is request/response, so "disconnect" must be defined: while Arx holds at
  least one live lease it sends `lease_heartbeat` every `HEARTBEAT_S` = 5 s; a host that has seen no revoke or heartbeat for
  `SILENCE_S` = 15 s (three missed beats) destroys every live lease (W?; proposed to WisKey as part of the revised draft,
  owner question 3). While no lease is live, nothing is sent (no idle traffic). A heartbeat is liveness, not authority: it
  never extends a lease, never re-creates one, and a host must never treat its arrival as a reason to keep a lease past
  `lease_expires_at` (R draft L03 "timer alone extends nothing"; recorded in 8.2 against the draft's "no polling" sentence).
- **Order with the four lease requests.** The host applies a revoke before any `capture_status` / `capture_confirm` /
  `capture_cancel` that arrives later; a `capture_confirm` racing a revoke is decided at the host's confirm barrier (R 5.4 of
  the reply): if the barrier has already passed and dispatch is possible, the outcome is `sent_unknown`, never undone. Arx shows
  "לא ידוע אם הכרטיס נוסף" and the ledger row ends `destroyed(reason = confirm_unknown)`.

### 1.4 Triggers inside Arx (every event that changes the authority of an outstanding lease)

One hook, `capture_lease.on_authority_change(reason, *, user_ids=None, station_ids=None, all=False)`, called from the places
below. Strict rule (D, owner question 2): **a `permission_revision` bump revokes every live lease** (`scope: all`), without
re-authorizing - the lease binds the revision (R draft L02) and WisKey refuses a mismatched revision anyway; re-deciding would
only add a code path that can be wrong. Per-user and per-station triggers revoke the matching leases only.

| # | Trigger (what changed) | Where Arx learns it (V) | Scope | `reason` |
|---|---|---|---|---|
| T1 | `permission_revision` bump: binding granted / revoked / denied, group membership, custom role edit, delegable list, door_opener card, backup restore | every `db.bump_permission_revision` caller (`routers/access.py`, `access_groups.py`, `doors.py`, `ha.py:504`, `services/backup.py:390`) - the hook is called from `bump_permission_revision` itself so no caller can forget it | `all` | `permission_revision` |
| T2 | Actor disabled or removed in the directory | `routers/ha.py:695-698` (`revocation.mark(disabled)`), the directory diff that drops a user | `actor` | `actor_disabled` / `actor_removed` |
| T3 | Actor's generation moved for a narrowing reason not covered by T1 (anchor / zone / catalogue reach changes, wall drops) | `services/revocation.mark` - the hook is called from `mark` (every narrowing) and from `changed` (grants too: a grant can change the sensitive level of a person and the fresh decision is no longer the one WisKey holds) | `actor` | `access_changed` |
| T4 | Actor's session ended or locked: remote logout, "sign out everywhere", administrator revoke, session expiry, the local (USR2) chain revoked or rotated for a privilege change | `services/ha_user_auth.logout`, `revoke_sessions`, `_drop_locked` paths; USR2 `auth_local_sessions` revoke (R USR2 §8.2) | `actor` | `session_ended` |
| T5 | Actor's capture dialog went silent (`ABANDON_S` 20 s without a status read) | `services/intercom_capture._abandon` | `lease` | `abandoned` |
| T6 | Second-factor state change of the actor - enrol confirmed, disabled, or reset by an administrator - when the actor holds an administrative permission (USR2 §8.1 / CR-011: these end the user's other sign-ins); for a non-administrative actor the same change ends the lease too (one rule, no exception path) | `routers/second_factor.confirm / disable / admin_reset` | `actor` | `second_factor_changed` |
| T7 | Station / target binding change: the station's `binding_revision` observed in the feed differs from the one signed into the lease; station placement row or door map row for the station changed (CR-033 0077/0078 `revision`); the station left the overview | `services/intercom_sync` overview refresh (`STATE.sequence`), `intercom_station_placement` / `intercom_door_map` writes | `station` | `binding_changed` |
| T8 | Receiver reconfiguration or loss: the station's `online` entity false, reader set from `cards/reader_capabilities` differs from the one at issue, WisKey `access_revoked` on the feed, feed reconnect (`STATE.reconnects` moved) | `intercom_sync` station watch (`STATION_WATCH_KEYS`), `_tick` of the capture poller, feed loop | `station` (reconnect: `all`) | `receiver_changed` / `receiver_offline` / `feed_reconnect` |
| T9 | Feature switch off: `access.capture_lease` set to `off` (section 7.3), or the bridge unpaired / re-paired / key rotated (CR-034) | `routers/settings.patch_settings`; bridge pairing routes | `all` (+ `lease_stream_reset` on re-pair / rotation) | `feature_off` / `repair` |
| T10 | Emergency or windows policy becoming active for the station or installation (both OFF today, R reply header; reserved hook so the day they exist nothing is forgotten) | the future emergency / windows service | `all` | `emergency` |
| T11 | System shutdown; and startup (Arx holds no lease in memory after a restart) | `main.py` shutdown hook, before `intercom_sync.SYNC.shutdown()`, with a 2 s budget; startup hook | `all` | `shutdown` / `startup` (as `lease_stream_reset`) |
| T12 | Person changed under the lease (the person's revision moved - edited elsewhere, archived, deactivated) | the people write paths of `routers/access_control.py` (S11) when `person_id` matches a live lease; a feed `refresh` that moves the person's revision | `lease` | `person_changed` |
| T13 | Clock no longer trusted (section 3.4) | `capture_lease` clock guard | `all` | `clock_invalid` |

USR2 (Arx-only, local) actors - as built on `pilot/LEASE-ARXONLY` (integ/264 risk 8), strict, no new reason value (all are in the
closed enum of `lease.schema.json`): every local-session end goes through `services/local_identity.lease_hook` -> T4 `session_ended`
(`revoke_user_sessions`: administrator revoke, sign out everywhere, disable / delete, password change - also from the only session -,
link / self-service reset, factor enrolled / reset, passkey removed; `revoke_chain`: logout / one sign-in revoked; `revoke_all`: the
local identity switch off, scope `all`; `resolve`: a session found expired / idle / of a disabled or deleted user, a rotation for a
privilege change). T6 `second_factor_changed`: factor enrolled (TOTP confirm, first passkey), any passkey registered or removed,
`on_factor_removed` (also with a factor left), `on_factor_reset`, the passkey-first mode changed (user or administrator). T2:
`actor_disabled` / `actor_removed` on the local disable / delete routes (followed by T4, T3 and the strict T1). Role / group changes are
covered by T1 (`insert_binding` / `revoke_one` bump the revision) and T3 (`revocation.mark`) - verified by test, not assumed. Fail
closed at the issue: only principal sources whose triggers are wired (`ingress`, `remote`, `local`; `dev` in tests only) reach the
signer, and a `local` principal needs a local id, the switch on, a live account and a live session chain, read inside the issuing
write transaction (this closes the window between the request's authentication and the gate's mark).

Not triggers (deliberately): the lease's own expiry (both sides enforce `now < lease_expires_at`; Arx marks the row `expired`
and sends nothing), a status poll (never renews), an unrelated user's permission change under T3 (only the actor's generation
counts; the installation-wide T1 already covers role edits).

## 2. The Arx-side lease ledger

### 2.1 States

`issued` -> `active` -> (`revoked` | `expired` | `destroyed`). Terminal states are final; a row never goes back.

| State | Meaning | Entered by |
|---|---|---|
| `issued` | the fresh decision passed, the lease object was signed into `capture_start`, the start was sent | `card_capture_start` after the attempt audit row, before the send |
| `active` | WisKey acknowledged the start and named the session | the start's answer (`session_id` recorded) |
| `revoked` | Arx withdrew authority (any trigger). `revoke_sequence`, `reason`, `acked_at` (null until an answer of 1.2 arrives) | `on_authority_change` |
| `expired` | `lease_expires_at` passed with the row still `issued` / `active` | the ledger janitor tick (every 1 s while rows are live) |
| `destroyed` | consumed: `capture_confirm` acknowledged / `sent_unknown`, `capture_cancel` acknowledged, or WisKey reported the session gone (`lost`, `error`) | the capture flow |

A start whose answer is unknown (timeout after a possible delivery) stays `issued` until expiry and is revoked immediately
(`reason = start_unknown`), because a session Arx cannot see may be driving the reader (V today's rule: the station is held for
the rest of WisKey's 120 s).

### 2.2 Invariants (enforced in the database, not only in code)

- **One live lease per receiver:** partial unique index on `(station_id, reader_id) WHERE state IN ('issued','active')`.
  A start on a receiver with a live lease is refused (409 `capture_receiver_busy`) and never takes it over (R 5.8 of the reply).
- **One live lease per actor:** partial unique index on `actor_user_id` with the same predicate (V today's "at most one active
  capture per SMPLWISE user").
- **Installation ceiling:** at most 3 live leases (WisKey's own limit, V `intercom_capture.py` docstring); the fourth start is
  refused before anything is signed (R 5.10 "bounded resources, refusal before collector").
- **Lifetime cap:** `LEASE_MAX_S = 120` is a constant, not a setting; the issued lifetime is `min(LEASE_MAX_S,
  access.capture_lease_seconds)` (default 120; owner question 1). `lease_expires_at - lease_issued_at` is checked by a CHECK
  constraint (`> 0 AND <= 120`) and again by the signer.
- **The fresh decision at `capture_start` is the only way a row is created.** No route, job, restart path or settings change
  creates, revives or extends a lease. `capture_status`, `capture_confirm`, `capture_cancel` read the row and may only move it
  to a terminal state.

### 2.3 Tables (provisional numbers 0101+; final numbers at merge, as CR-033 11.1)

- **0101 `capture_leases`:** `id TEXT PRIMARY KEY` (= `lease_ref`, UUIDv4), `actor_user_id TEXT NOT NULL`, `actor_source TEXT
  NOT NULL CHECK (actor_source IN ('ha','local'))`, `station_id TEXT NOT NULL`, `reader_id INTEGER NOT NULL CHECK (0..8)`,
  `person_id TEXT NOT NULL`, `person_revision INTEGER`, `binding_revision TEXT`, `permission_revision INTEGER NOT NULL`,
  `selection_revision TEXT`, `stream_id TEXT NOT NULL`, `sequence_at_issue INTEGER NOT NULL`, `start_request_id TEXT NOT NULL
  UNIQUE`, `wiskey_session_id TEXT`, `lease_issued_at TEXT NOT NULL`, `lease_expires_at TEXT NOT NULL`, `state TEXT NOT NULL
  CHECK (state IN ('issued','active','revoked','expired','destroyed'))`, `state_at TEXT NOT NULL`, `reason TEXT`,
  `revoke_sequence INTEGER`, `revoke_attempts INTEGER NOT NULL DEFAULT 0`, `acked_at TEXT`, `ack_result TEXT`, `created_at
  TEXT NOT NULL`; the two partial unique indexes of 2.2; CHECK on the lifetime. Ids only - no names, no card data, no address.
- **0102 `capture_lease_stream`:** one row: `stream_id TEXT PRIMARY KEY`, `next_sequence INTEGER NOT NULL`, `created_at`,
  `reason`. A new row (and a `lease_stream_reset` message) on first start-up after the migration, on re-pair, on a restore from
  backup (`services/backup.py` keeps the table OUT of `SETTINGS_KEEP`-style preservation: a restored database gets a fresh
  stream, never the backup's counter) and on key rotation.
- Rollback: both tables are additive; older code ignores them. The lease route is behind a flag that older code does not read
  (fail closed: absent = `off`).

### 2.4 Audit (ids only) and retention

Actions (existing `audit_log` columns V `audit.py`: actor, action, resource, decision, reason, request_id, permission_revision,
scope/role/binding of the decision, `details_json`): `intercom.capture_lease.issue` (resource `lease:<id>`; details
`station`, `reader`, `person_id`, `person_revision`, `binding_revision`, `permission_revision`, `stream_id`, `sequence_at_issue`,
`lease_seconds`, `start_request_id`), `.active` (`wiskey_session_id`), `.revoke` (`reason`, `revoke_sequence`, `scope`),
`.event_sent` (`request_id`, `body_sha256` of the exact bytes, `attempt`), `.event_acked` (`ack_result`, `destroyed`,
`last_sequence`), `.event_failed` (`code` only), `.expire`, `.destroy` (`reason`), `.stream_reset` (`reason`,
`previous_stream_id`). Never the signature, key, nonce, body, card value / mask / length, person name or station address.
Heartbeats are NOT audited per message (start/stop rows only: `.heartbeat_start` / `.heartbeat_stop`, §11 "no row per frame").

Retention: ledger rows are pruned by the janitor 7 days after `state_at` (the same horizon as WisKey's replay journal, R 4.4 of
the reply, so a status lookup of an old capture (C03) finds a row exactly as long as WisKey can); audit rows follow the existing
audit retention setting. The stream counter is never pruned.

## 3. Failure modes and fail-closed rules on the Arx side

| # | Failure | Rule |
|---|---|---|
| F1 | Bridge service missing / HA unreachable / `rejected` with a stage code at REVOKE time | The row is `revoked` the moment the trigger fires (authority is gone in Arx regardless of delivery). Retries per 1.3; after 5 s without an answer Arx ALSO sends a signed `capture_cancel` for the lease (one of the four lease actions: an independent "lose authority" signal, idempotent on the host). Audit `event_failed` per attempt with the code only. The operator sees "קריאת הכרטיס הופסקה" at once |
| F2 | Bridge missing / clock invalid / message too large at ISSUE time | No lease. `card_capture_start` answers 503 `capture_lease_unavailable` ("קריאת כרטיס אינה זמינה כעת") before anything is signed; nothing is sent; attempt row only |
| F3 | Ledger or stream-counter write fails (SQLite error) | No issue (the decision and the row are one transaction). For a revoke whose counter increment fails: send `lease_revoke` with `scope: all` using the last known `next_sequence` (the host's gap/conflict logic destroys everything either way), then switch the route to `off` in memory (`capture_lease.DEGRADED = True`) until restart; audit `event_failed(code = ledger_unavailable)`; the health report shows it |
| F4 | Arx restart with live rows | Startup: every `issued` / `active` row -> `revoked(reason = startup)`; a new stream row; one `lease_stream_reset`. WisKey's heartbeat silence rule already destroyed the sessions if the restart took longer than 15 s |
| F5 | Clock skew / untrusted clock | Lease times come from Arx's host clock in UTC whole seconds (V `trusted_door._iso`). If the bridge answers `time/clock_invalid` or `time/not_yet_valid` to ANY lease-route message, Arx revokes all (`clock_invalid`), stops issuing, and shows "שעון המערכת לא אמין" until the next successful signed exchange of a non-lease message (or an administrator's explicit re-enable). The host's own skew rules apply to the lease times (R 5.9 of the reply); Arx adds no skew allowance of its own and never re-anchors |
| F6 | Answer names another `request_id`, is not one of the closed shapes, or is `unknown_stream` for a stream Arx believes current | Not an acknowledgement: retry (1.3). `unknown_stream` twice in a row -> `lease_stream_reset` and revoke all (`reason = host_lost_stream`) |
| F7 | Heartbeat answer lists a `live_leases` entry Arx has no live row for | `lease_revoke scope: all`, `reason = unknown_lease_on_host`; audit; the route stays on |
| F8 | `capture_confirm` arrives at Arx for a row that is `revoked` / `expired` / `destroyed` | Refused locally (409 `capture_lease_gone`), nothing signed, nothing sent; the UI shows one uniform state without a card value (R 5.5 of the reply) |
| F9 | Start acknowledged but `wiskey_session_id` missing / malformed | Treated as unknown start: row stays `issued`, immediate revoke (`start_unknown`), receiver held until `lease_expires_at` |
| F10 | Two Arx workers (uvicorn `workers=1` is the rule, V dev-loop) | The partial unique indexes make a double issue impossible; the sequence increment is a single-row `UPDATE ... RETURNING` inside the write lock. Documented, not relied on for more than one process |

General rule: **any error while deciding or signing is a refusal** (V `intercom_authority` "fail closed"); any error while
revoking is still a revoke in the ledger and a retry on the wire.

## 4. Interactions with RBAC, the USR2 local identity and the TOTP gate

- **No new permission name.** Issue requires exactly what the shipped capture requires today (V `routers/access_control.py`
  capture section, CR-036 S11): `access.cards.capture` AND `access.people.manage` on the reader's station chain and on every
  station of the person, at the sensitive level, decided by `rbac.authorize` with deny-overrides over
  `access_control_station -> building -> site -> installation`; kiosk, viewer, `dev` and unidentified principals never reach the
  signer. The permission of the "lookup" action (section 5) is likewise an existing one. Justification: the lease adds no new
  capability to a person - it only lets an already-authorized capture continue for ≤120 s; a new name would create a second
  authority to keep in step with the first (CR-033 "no second authority" invariant).
- **The signed actor is always the Arx principal**, `actor.id` = the Arx user id (HA-mirrored id, or a USR2 local id - the two
  id spaces are disjoint: R USR2 §5), never the add-on's HA user and never `on_behalf_of`. The service identity (the add-on's
  `SUPERVISOR_TOKEN` user; USR2 §12.2 "SmplWise Arx Service") is NOT an actor of a lease: it signs nothing on this route and
  WisKey must not accept a lease whose `actor.id` is an HA system-generated or service user (W?: WisKey's check; Arx refuses
  locally when the principal is not a person). A `lease_revoke` with `scope: all` is the only message whose actor is the
  installation itself, and it can only remove authority.
- **USR2 local identities** may hold a lease iff their one role holds both permissions at the station under the USR2 binding
  rules (R §12.1: never `system_admin`, no administrative permission unless the owner enables it - `access.cards.capture` is
  sensitive, not administrative, so a local operator with the role is possible). Their session chain revocation and rotation
  on privilege change (R §8.2) are T4 triggers. `actor_source` is recorded in the ledger for audit, not used for authority.
- **TOTP gate.** Second factor state changes are a trigger (T6). No step-up code is REQUIRED at `capture_start` by default
  (D; owner question 4): the existing gate pattern (`second_factor_step_up_required` with `X-Arx-Second-Factor`, V
  `routers/second_factor.admin_reset`) is reusable in one line if the owner chooses otherwise. `security.second_factor_policy =
  admins` and `remote.require_mfa_admin` keep refusing remote sign-ins as today; they do not change the lease rules.
- **Permission downgrade in an open session** (HA_IDENTITY_RBAC §15) is honoured by T1/T3: the camera-lease pattern (V
  `services/leases.py`: re-check on generation move and at least every 20 s) is NOT reused for capture leases - the capture
  lease is revoked on the first signal, not re-checked, because its authority is a signed object WisKey holds, not a stream Arx
  can simply stop serving.
- **Audit read** of the ledger (Settings -> אינטרקום -> "קריאות כרטיס אחרונות", ids and states only, no card data) needs
  `access.admin.read` on the station (V `intercom_authority` ADMIN rule) - existing permission.

## 5. The C03 lookup-permission setting (owner decision: option א, widenable later)

Owner decision (question 1 of the reply): who may look up the status of an OLD action = whoever currently holds the Arx
permission for that action on that target, at the current `permission_revision`. The Arx-side rule and its one setting:

- **Function** `intercom_authority.lookup_allowed(principal, original_action, logical_target_id, binding_revision)` (D): maps
  `original_action` to its Arx permission through a CLOSED table in code (`cards/capture_*` -> `access.cards.capture` +
  `access.people.manage`; `stations/test_unlock` / `door_open` -> `door_authority.check`; `users/*` writes ->
  `access.people.manage`; unknown action -> refused), then `rbac.authorize` over the station chain at the current revision. The
  answer is the fresh Arx decision WisKey asks for (R 4.3 of the reply); WisKey adds no role or same-user check.
- **Setting `access.lookup_scope`** (owner question 5 fixes the value set): `holder` (default = the decision above) |
  `holder_or_audit_readers` (also a principal holding `audit.read` at installation scope - the existing audit-view permission,
  R option ב). System administrator only (`rbac.is_system_admin`, exactly the `schedules.allow_disarm` pattern V
  `routers/settings.py:885-905`: 403 `not_system_admin` audited, confirmation word for the WIDER value, `settings.changed` with
  before/after). Restore from backup never loosens it: a wider restored value is dropped and listed in the restore report (the
  CR-033 §9 rule, `services/backup.py`).
- **Deny still wins:** an explicit deny of the original action's permission on the target refuses the lookup even under the
  wider setting (HA_IDENTITY_RBAC §15 deny-overrides). Recorded as a design choice in 8.5.
- Response and existence rules are WisKey's (R 4.5/4.6: `pending` | `not_found_or_expired` only, no oracle); Arx's
  contribution is the decision and the audit row `intercom.lookup.decide` (ids only).
- No migration: one settings row. UI: one dropdown in Settings -> הרשאות -> "בירור מצב פעולה ישנה" with the two values and
  the confirmation; nothing on operator screens.

## 6. Test plan (negative-first, fakes only; everything below is PLANNED_NOT_RUN)

Fakes: `tests/fake_wiskey.py` gains a *lease host* (stream/sequence state, `live_leases`, destroy-on-gap/conflict/silence,
confirm barrier with an injectable `sent_unknown`); `tests/fake_trusted_bridge.py` gains `lease_event` (stages 1-7 as for
`door_open`, closed answers of 1.2); a fake clock for both; `tests/intercom_station_scope.py` for station bindings; the
existing HA fake for directory disable; a `FakeSessionStore` for T4. Golden vectors for `wiskey-capture-lease-v1` (positive and
one-defect negatives) as the contract oracle, mirrored to WisKey in `NOTE_FOR_WISKEY`.

| # | Case | Expected |
|---|---|---|
| N1 | Permission change mid-lease (binding revoked; also: deny added; group membership removed; role edited) | `permission_revision` bump -> `lease_revoke scope: all` with the next sequence within 1 s; fake host destroys the session; a later `capture_confirm` is refused on both sides (Arx 409 `capture_lease_gone`, host uniform state); ledger `revoked(permission_revision)`; audit rows carry no card data or names |
| N2 | Replay / duplicate: the same signed bytes sent twice; the same sequence with a new envelope | Bridge `state/replay` for the identical bytes; `duplicate` for the new envelope; the host's state unchanged; Arx treats both as acknowledged |
| N3 | Gap: Arx (test hook) skips a sequence | Host destroys every live lease, answers `gap`; Arx marks all live rows `revoked(host_gap)`, audits, keeps the route on |
| N4 | Conflict: same sequence, different body | Host destroys everything, answers `conflict`; Arx revokes all, audits `conflict` |
| N5 | Event lost then reconnect: bridge unavailable for 7 s during a revoke | Retries every 2 s with new envelopes and the same sequence; `capture_cancel` sent at 5 s; the first answer stops retries; `acked_at` set once. Variant: unavailable past `lease_expires_at + 15 s` -> retries stop, row stays `revoked` with `acked_at` null, `event_failed` audited |
| N6 | Heartbeat silence: Arx stops beating (test hook) | Host destroys live leases after 15 s; the next Arx heartbeat gets `live_leases: []`, Arx reconciles rows to `destroyed(host_silence)` |
| N7 | Clock skew: `issued_at` 2 s in the future; lifetime 121 s; `expires_at` in the past; bridge answers `clock_invalid` | Each refused by the signer locally (nothing sent) or by the bridge at stage `time`; `clock_invalid` -> revoke all, issuing stops, UI text; a later good exchange re-enables |
| N8 | Actor disabled in HA during a lease; actor removed from the directory | T2 -> `scope: actor` revoke; the actor's other sessions unaffected beyond today's rules; a second actor's lease on another receiver untouched |
| N9 | Receiver swap: reader set changes; station offline; WisKey `access_revoked`; feed reconnect | `scope: station` (reconnect: `all`) revoke; a start on the swapped receiver refused while the old lease is live (`capture_receiver_busy`); after the revoke a new start succeeds with a new `lease_ref` |
| N10 | Session ended: logout; "sign out everywhere"; administrator revoke; second-factor enrol/disable/reset of the actor | T4/T6 -> `scope: actor` revoke; the step-up header is not required at start (default); with the owner's option ב it is |
| N11 | Shutdown / restart with live rows | Shutdown sends `scope: all` within 2 s; startup marks rows `revoked(startup)`, writes a new stream row, sends `lease_stream_reset`; the host answers `acknowledged` and holds nothing |
| N12 | Feature switch off; unpair; key rotation (CR-034 gate tool fake) | Revoke all + `lease_stream_reset`; starts refused with the operator text; the classic capture path (WS, today's) unaffected |
| N13 | Ledger invariants | Second start on the same receiver / same actor refused at the index; fourth live lease refused; lifetime > 120 refused by CHECK and signer; no route creates a row except `card_capture_start` (grep test over the routers) |
| N14 | Leak scan | Every audit row, log line and answer of a full fake run scanned for the card sentinel, the person name, the station host, the signature and the nonce: none present |
| N15 | C03 setting | Non-admin PATCH refused 403 and audited; `holder` default decides by the original action's permission; `holder_or_audit_readers` admits an `audit.read` holder; explicit deny refuses under both; restore of a wider value is dropped and reported |
| P1 | Happy path | issue -> `active` -> status polls (never renew) -> confirm -> `destroyed(confirmed)`; heartbeat start/stop audited once each |

Needs a real device or the owner's installation (**NOT_RUN** here, each with its own owner approval later): WisKey's actual
`lease_event` consumer and sequence handling (W?); the real reader's behaviour after a mid-collection revoke (does the firmware
leave collection mode; R draft L09 "no secure-erase guarantee"); HA restart timing against the 15 s silence rule; real clock
behaviour of the HA host; the Companion / phone path. Existing suites to keep green: `test_intercom.py`,
`test_intercom_authority.py`, `test_intercom_adapter.py`, `test_rbac_matrix.py`, `test_bridge_*`, `test_wiskey_golden_vectors.py`,
`test_second_factor*.py`, `test_remote_access.py`.

## 7. Phased build plan, files, migrations, open questions

### 7.1 Slices (agent-hours, CR-033 calibration; Opus for every security-sensitive slice; design-only estimates, not measured)

| Slice | Content | Files / modules that change | Hours | Model |
|---|---|---|---|---|
| L0 | Contract: closed JSON Schemas for `wiskey-capture-lease-v1` (lease object fields, three messages, answers), golden vectors, `NOTE_FOR_WISKEY` | new `docs/contracts/wiskey-capture-lease/{SCHEMA.md, lease.schema.json, GOLDEN_VECTORS.json, NOTE_FOR_WISKEY.md}` | 4 | Opus (Fable review of the wording) |
| L1 | Ledger: migrations 0101 / 0102, `services/capture_lease.py` (states, invariants, sequence, janitor, audit), unit tests N13 | `migrations/0101_capture_leases.sql`, `0102_capture_lease_stream.sql`, new `services/capture_lease.py`, `services/backup.py` (stream reset on restore), `tests/test_capture_lease_ledger.py` | 6 | Opus |
| L2 | Trigger hooks T1-T13 | `db.bump_permission_revision` (hook call), `services/revocation.py` (`mark` / `changed` call the hook), `routers/ha.py` (directory), `services/ha_user_auth.py` (logout / revoke / drop), `routers/second_factor.py`, `services/intercom_sync.py` (online, `access_revoked`, reconnect, binding_revision diff), `services/intercom_capture.py` (`_abandon`, person revision), `routers/settings.py` (switch), `main.py` (startup / shutdown) | 6 | Opus |
| L3 | Event sender: signer generalized out of `trusted_door.py` into `services/trusted_caller.py` (protocol, lifetime, actions as parameters; `door_open` unchanged in behaviour and vectors), `services/lease_events.py` (send, retry, heartbeat thread, answer classification, audit), tests N2-N7, N11 | `services/trusted_door.py` (refactor only), new `services/trusted_caller.py`, new `services/lease_events.py`, `tests/fake_trusted_bridge.py`, `tests/fake_wiskey.py` | 6 | Opus |
| L4 | Bridge `lease_event` service (stages 1-7, hand-off to WisKey's capability), bridge version bump in the 0.9.x line with `door_open`, both copies via `scripts/sync_integration.py`; `MIN_BRIDGE_FOR_CAPTURE_LEASE` | `integration/smplwise_bridge/__init__.py`, `const.py`, `services.yaml`, `strings.json`, `custom_components/...` mirror, `tests/test_bridge_lease_event.py` | 5 | Opus |
| L5 | Lease route behind `access.capture_lease` (default `off`): `card_capture_start` issues the lease into the signed start; status / confirm / cancel through the signed route; refusals and texts of section 3; the UI message; tests N1, N8-N10, N12, N14, P1 | `routers/access_control.py` (capture section), `services/intercom_capture.py`, `services/wiskey_channels.py` (a `lease` channel listing the four signed actions), `frontend/src/screens/wiskey-card-capture.ts` (one stop message), `tests/test_intercom_capture_lease.py` | 8 | Opus |
| L6 | C03 lookup setting and `lookup_allowed`, restore rule, Settings dropdown, N15 | `services/intercom_authority.py`, `routers/settings.py`, `services/backup.py`, `frontend/src/screens/system-access.ts`, `tests/test_lookup_scope.py` | 3 | Sonnet (UI) + Opus (authority) |
| L7 | Gate on fakes (N1-N15, P1), second Opus security pass over L1-L5, bilingual release notes, `management/tasks.json` + `test_catalog.json` + `python scripts/project_status.py --write` | - | 3 | Sonnet (run) + Opus (review) |
| | **Total** | | **41** (L4 only when WisKey confirms its consumer: 36 without it) | |

Order: L0 -> L1 -> (L2 ‖ L3) -> L5 (interim: the route cannot be switched on while `MIN_BRIDGE_FOR_CAPTURE_LEASE` is None,
exactly the `doors.trusted_path` pattern) -> L6 (independent) -> L4 when WisKey's side exists -> L7 -> owner-approved switch-on.

### 7.2 Migrations (provisional)

| Number | Content | Slice |
|---|---|---|
| 0101 | `capture_leases` | L1 |
| 0102 | `capture_lease_stream` | L1 |

Number note: `origin/main` is at 0087; CR-033 took 0077/0078 (merged as `rbac.STATION`), CR-034 reserved 0079, the USR2
spec reserves 0097/0098. 0101+ was assigned by the task to stay clear of all of them; final numbers at merge.

**Final numbers (integ/264, 2026-10-16):** `0099_capture_leases.sql` and `0100_capture_lease_stream.sql` (this CR's provisional
0101/0102; `pilot/LEASE-BUILD` shipped them as 0103/0104). Wherever this document says 0101 / 0102 below or above, read 0099 / 0100.

### 7.3 Settings added

| Key | Values (default first) | Who | Audit |
|---|---|---|---|
| `access.capture_lease` | `off` / `on` (selectable only when `MIN_BRIDGE_FOR_CAPTURE_LEASE` is met and the owner has approved the switch-on) | system administrator | `settings.changed` |
| `access.capture_lease_seconds` | `120` (cap) / `90` / `60` | system administrator | `settings.changed` |
| `access.lookup_scope` | `holder` / `holder_or_audit_readers` | system administrator, confirmation word for the wider value | `settings.changed` |

None holds secret material; a restore never loosens any of them (CR-033 §9 rule).

### 7.4 Dependencies outside Arx (W?)

| Dependency | Needed by | Status |
|---|---|---|
| WisKey consumer of `lease_event` (sequence / gap / conflict / silence rules of 1.3, answers of 1.2), the four lease envelopes, the confirm barrier | L4, switch-on | Not verified; to be written into WisKey's revised C04 draft after the owner forwards this CR |
| The meaning and source of `binding_revision` for a station target | lease object, T7 | Carried opaque by Arx; WisKey publishes it |
| WisKey's rejection of a lease whose actor is a system-generated / service HA user | 4 | W? |
| Bridge 0.9.x line with `door_open` (CR-033 D5b) and CR-034's multi-key verifier | L4 | planned |

**Amendment LEASEARX-295 (2026-10-21), after WisKey's answer of the same day** (contract detail and change record:
`docs/contracts/wiskey-capture-lease/SCHEMA.md` section 7): the bridge services are FINAL as `smplwise_bridge.lease_event` (the stream)
and `smplwise_bridge.lease_request` (the four lease requests), both on the DTO v3 wire with `protocol = wiskey-capture-lease-v1` and service
data exactly `{signed_message_json}` - not a generalized W1 envelope, no grant / decision field. The v1 lease wire is closed: no `kid` on
it (the key id of a rotated key is bound into the MAC and the bridge tries the key ids of its key set; review L-05). The answers are the
four closed answer schemas and the closed code table, enforced in `services/lease_answers.py`. WisKey approved the contract for
implementation with corrections; its consumer is not proven, the Arx route stays off (`GO_LIVE_PERMITTED = False`,
`MIN_BRIDGE_FOR_CAPTURE_LEASE = None`) and a go-live needs the owner's separate permit.

### 7.5 Open questions for the owner (numbered; short lettered options; the lead's recommendation marked *)

1. **אורך ברירת המחדל של ה-lease** (התקרה 120 ש' קבועה):
   א. 120 ש' * · ב. 90 ש' · ג. 60 ש'
2. **מה קורה לכל ה-leases הפעילים כששינוי הרשאה כלשהו מעלה את מהדורת ההרשאות:**
   א. כולם מתבטלים מיד, בלי בדיקה חוזרת (פשוט ובטוח; המפעיל מתחיל קריאה מחדש) * · ב. בדיקה חוזרת של ההרשאות של בעל ה-lease, וביטול רק אם ההחלטה הטרייה נכשלת
3. **"ניתוק ערוץ הביטול" בערוץ בקשה/תשובה - פעימת חיים:**
   א. Arx שולחת פעימה כל 5 ש' כל עוד יש lease פעיל; WisKey משמידה אחרי 15 ש' שקט * · ב. פעימה כל 2 ש', השמדה אחרי 6 ש' · ג. בלי פעימה (לא עומד בדרישת הסקירה; רק אם WisKey תציע מנגנון אחר)
4. **קוד אימות דו-שלבי בתחילת קריאת כרטיס:**
   א. לא נדרש; ההרשאות הקיימות מספיקות, ושינוי מצב הגורם השני מבטל את ה-lease * · ב. נדרש קוד בכל התחלה כשהמשתמש רשום לגורם שני · ג. נדרש רק למשתמש שמחזיק הרשאת ניהול
5. **ערכי ההגדרה "מי רשאי לברר מצב פעולה ישנה":**
   א. שני ערכים: מחזיק ההרשאה הנוכחי (ברירת מחדל) / גם מחזיקי הרשאת צפייה באודיט * · ב. בנוסף ערך צר יותר: רק מי שביצע את הפעולה, ואם הוא עדיין מורשה · ג. רק ברירת המחדל, בלי הגדרה כרגע

## 8. Contradictions and risks recorded (not resolved)

1. **AGENTS.md "never queue or blindly retry physical commands after reconnect" vs. at-least-once revocation.** The revoke
   removes authority and causes no effect in the world; the ONE retry path of this CR is limited to `lease_revoke`,
   `lease_heartbeat`, `lease_stream_reset` and the lease's own `capture_cancel`. `capture_start` and `capture_confirm` are
   never retried (V today's rule).
2. **WisKey draft L08 "no periodic check as a substitute" vs. the heartbeat of 1.3.** The heartbeat is liveness detection for a
   request/response transport and grants nothing; the revoke stays event-driven and immediate. Needs WisKey's written agreement
   (owner question 3).
3. **Strict T1 (revoke all on any revision bump) costs operators a restart of the capture** when an unrelated administrator
   edits a binding during the ≤120 s. Accepted for simplicity and safety (owner question 2).
4. **`binding_revision` is W?.** Arx carries the value WisKey publishes and revokes when it changes in the feed; if WisKey's
   definition differs from "the station target's binding", T7 may fire too often (safe) or too rarely (then the host's own
   check at each lease request is the backstop).
5. **Deny-overrides on the C03 lookup under the widened setting** makes the widening ineffective for a principal explicitly
   denied the original permission. Chosen on purpose (deny wins everywhere in Arx RBAC); the owner may want the opposite.
6. **Two transports for capture during the transition.** The classic WS `cards/capture_*` path (shipped, Supervisor identity,
   Arx audit) stays as is until the lease route is switched on per installation; the lease route is additive behind
   `access.capture_lease`. The classic path never carries a lease and is never revoked by this event.
7. **The bridge line.** `lease_event` needs the same bridge release train as `door_open` (0.9.x) and CR-034's multi-key
   verifier if both are ready together; order in the CR-033/034 implementation plan.
8. **Migration numbers** (CLOSED at integ/264: final 0099/0100) 0101/0102 were provisional while `main` is at 0087 and other branches reserve 0077-0079 and 0097/0098.
