# CR-ACR7-FENCE-02 - Arx side of the WisKey remote-completion fence (ARX-N01)

Status: DESIGN (Arx design duty accepted in WisKey rounds 7-10; round 10 section 2.6 lists it as Arx work in development).
Branch: `pilot/WKPEER-295`. No product behaviour changes with this document: nothing is wired, every switch is OFF,
`GO_LIVE_PERMITTED` stays False everywhere, `signed_capture_covered` stays false. No HA user, group, token or flag is created or
changed by Arx, ever. Runtime status: NOT_RUN against any WisKey, Home Assistant, station or door.

> SUPERSEDED in part (PERSONWRITES-CLEANUP-295, W-026, 2026-10-25): WisKey never shipped `signed_person_writes/status`; the Arx
> verifier for it (`verify_receipt`, `ReceiptExpectation`, `FenceContext`, `RECEIPT_*`, `OneCommitLedger`) was removed. The real
> receipt read is `peer_receipts/resolve` (WKADAPT-295). The `person_writes/context|submit|resolve` fence of this draft was never
> built in Arx (no code to remove); WisKey confirmation that it was never shipped is not recorded. The text below is the historical
> design record and is kept as is. See docs/changes/PERSONWRITES-CLEANUP-295.md.

Inputs: WisKey `ARX_REPLY9_REMOTE_COMPLETION_FENCE.draft1.r9` (ACR7-FENCE-01, the native fence: `person_writes/context|submit|resolve`,
capability `person_write_fence_v1`, build flag `ARX_PERSON_WRITE_FENCE_V1=False`), `ARX_REPLY8_SIGNED_CAPTURE_COMPLETION_HOOK.draft1`
(ACR8-SIGNED-HOOK-01, the signed sidecar `signed_person_writes/status`), `ARX_CHANGE_REQUESTS_R7/R8` (the ACR7-FENCE-02 request),
Arx reply 10 (sections 2.4 / 2.6) and the Arx static review of round 11 (`R11-I4-02`, `R11-I4-03`).

ACR7-FENCE-02 asks Arx for five things: (1) a dedicated owner-created HA principal plan, (2) the owner pin, (3) durable immutable intents
with a unique `origin_ref` per operation, (4) a complete inventory of Arx sending paths mapped to the nine covered commands, (5) the policy
for old untracked writes and the privileged recovery workflow. Each section below is one of them.

## 1. The dedicated principal

- **What it is.** ONE Home Assistant user, created by the owner, used only by Arx's WisKey service channel for the fence commands
  (`person_writes/*`), the signed-completion sidecar read and the peer-binding registry read. It is the `query_owner_id` / `owner_id`
  the WisKey receipts name. WisKey derives `owner_id` only from the authenticated connection, never from a request field.
- **Who creates it.** The owner, in Home Assistant, with the properties WisKey specifies (the fence draft requires an "authenticated
  active HA administrator" for every new command). Arx never creates it, never changes its groups or admin flag, never rotates its
  password. The owner creates a Long-Lived Access Token for it and hands it to Arx through the existing secret path (the same way the
  current service-channel token arrives); Arx stores only the token, never a password.
- **Separation.** It must NOT be the account Arx already uses for the general service channel, nor any human's account: a shared admin
  account cannot prove which application sent a request (fence draft section 1). One principal per Arx installation. Its id is the
  32-hex HA user id; Arx learns it from the authenticated connection's own `auth/current_user` answer
  (`wiskey_peer.attest_transport`) and compares it with the owner pin - it is never typed into a form or read from a request.
- **What it is not.** It is not an Arx RBAC identity and grants nothing inside Arx. Arx RBAC stays the action authority: a fence submit
  is sent only after the Arx actor was authorized for that write exactly as today. The principal proves "this request came from the
  Arx installation's service channel", not "a human approved it".
- **Open for the owner.** Create the user when WisKey's specification is delivered (round 10 section 3.4). Until then nothing in this
  design can run.

## 2. The owner pin

Arx follows exactly one binding, pinned by the owner: setting `wiskey.peer_pin` (JSON, `wiskey_peer_registry.OwnerPin`):

| field | meaning |
|---|---|
| `query_owner_id` | the dedicated principal's HA user id |
| `repository_id` | WisKey's durable repository namespace (canonical lowercase UUID, from `person_writes/context`) |
| `verified_peer_ref` | the peer reference WisKey's verifier assigned to Arx |
| `peer_binding_ref`, `peer_binding_revision` | the registry binding (and its revision) that ties the peer to the query owner |

Rules (implemented in `services/wiskey_peer_registry.py`, fake-tested in `tests/test_wkpeer_295.py`):

- Only the owner writes the pin (no route or writer exists; a future Settings action needs its own approval and audit). A missing or
  malformed pin means no client at all.
- The pin is checked BEFORE any lookup: a connection not authenticated as the pinned owner is refused (`owner_mismatch`, nothing asked).
- A registry answer naming another owner, repository or peer is `binding_mismatch`: no automatic rebind, ever.
- A revoked binding stops every new query (`revoked`). A rotated binding answers `rotation_pending` even when WisKey names a successor:
  Arx never follows the successor by itself; the owner re-pins.
- Historical reads: a receipt recorded under an older revision of the same binding is verified only when that revision carries
  `historical_read: true` and the same owner / repository / peer; never a revision newer than the pin, never another binding.
- The fence `context` must show the pinned `repository_id` and `owner_id`; a mismatch keeps every person write blocked
  (`repository_mismatch` is a stop, not a retry). A namespace retirement (fence draft section 2, retirement path) is an owner-approved
  re-pin after per-intent reconciliation, never automatic.

## 3. Durable immutable intents

Today's journal (`intercom_write_ops`, migration 0121) records a LOCAL op id before dispatch and settles by a fresh readback. That is
local admission, not a shared receipt (round 11 R11-I4-03). The fence needs one more durable record per operation, written in the SAME
transaction as the journal admission and BEFORE the frame leaves Arx:

`intercom_fence_intents` (PROPOSED; provisional migration number in the 0140+ range, assigned by the lead at integration; NOT created on
this branch):

| column | rule |
|---|---|
| `operation_id` | client-generated canonical UUIDv4, primary key with `repository_id` + `owner_id` (WisKey's unique key) |
| `repository_id`, `owner_id` | copied from the owner pin at admission; never changed |
| `issued_epoch` | `writer_epoch` from the fresh `context` the submit is sent under |
| `command` | one of the nine covered commands |
| `user_id`, `revision` | the target person and the revision the write is admitted against (NULL / NULL for create) |
| `origin_ref` | opaque, unique per operation: `<source>:<arx id>:<n>` (e.g. `grant:<grant id>:<attempt>`, `editor:<audit id>`); 1..128 code points, no C0, no name / phone / PIN / card / payload hash |
| `journal_op_id` | the `intercom_write_ops` row admitted in the same transaction |
| `state` | `intent` -> `sent` -> `committed` / `never_committed` / `unknown` (terminal facts only from a verified receipt) |
| `receipt_*` | the verified receipt's facts (state, reason, commit user / revisions, observed epoch) - never its raw body |

Immutability: the selector columns (`operation_id`, repository, owner, epoch, command, user, revision, origin_ref) are written once
(a trigger refuses UPDATE of them); only `state` and the `receipt_*` facts advance, and a terminal state never changes again (the
`OneCommitLedger` rule in `services/wiskey_peer.py`, made durable here). No payload is stored: a lost response is resolved with
`resolve` (selectors only, no arguments), never by a blind re-submit or a new token. No PIN, PIN hash, card value, name or phone.

Consumption rules (fence draft section 6, unchanged): in_flight / unknown / any error keeps the person blocked and a withdrawing grant
`revoking` with backoff; committed / never_committed settles ONLY that intent; the next write still needs a fresh complete `users/get`
and the normal central predicates; revocation additionally needs the revision-bound ACR5-01 verdict
(`wiskey_acr5.revocation_verdict`). A committed create's receipt is the ONLY origin evidence for a lost create, matched to the original
intent's repository, owner, operation_id, `command=create`, `origin_ref` and the generated `commit.user_id`; never presence, name, phone
or PIN.

## 4. Sender inventory (every Arx path that sends a WisKey person write)

Source: `origin/integ/293` @ 90a50db90. "Journal" = `intercom_write_ops` admission today. "Fence v1" = covered by the nine native
commands of ACR7-FENCE-01.

| # | path | command(s) | journal today | fence v1 | plan |
|---|---|---|---|---|---|
| 1 | `routers/access_control.py` person editor create (`_perform`, ~1412) | `users/create` | **NO** (no target: no person id yet) | yes | intent with `origin_ref=editor:<audit id>` before submit; the gap is closed by the fence intent itself |
| 2 | person editor update (~1438) | `users/update` | yes (`person:<id>`) | yes | intent + journal in one transaction |
| 3 | person editor delete (~1465) | `users/delete` | yes | yes | same |
| 4 | `routers/access_control_writes.py` `_write` | `users/archive`, `users/unarchive`, `users/set_active`, `users/temporary_cancel`, `cards/add`, `cards/remove`, `users/update` | yes | yes | same |
| 5 | grant worker create (`access_grants` ~1949 / ~2009 -> `WiskeyServiceEngine.create_person`) | `users/create` | create intent (`create:grant:<id>`, R5-A1) | yes | the existing create intent becomes the fence intent (`origin_ref=grant:<id>:<attempt>`) |
| 6 | grant worker apply / strip / rename (`WiskeyServiceEngine.apply|strip|rename`, also `access_external` rename) | `users/update` | yes | yes | same as 2 |
| 7 | grant worker delete (`WiskeyServiceEngine.delete`) | `users/delete` | yes (`person:<id>`) | yes | same as 2 |
| 8 | PIN generation (editor ~1365, engine `pin_generate`) | `users/pin_generate` | n/a (read-only, non-reserving) | no (not a mutation) | unchanged; still refused while a write is unresolved |
| 9 | signed lease capture confirm (`_lease_confirm` ~1666, `lease_events.TRANSPORT`) | signed `capture_confirm` | yes (`begin_external`) | **no** (signed path) | never sent through `submit`; covered only by ACR8-SIGNED-HOOK-01 + this branch's peer seam, once BOTH halves are reviewed |
| 10 | WS-lane card capture confirm (~1991) | `cards/capture_confirm` | yes | no | stays blocked-on-unknown; not a fence command |
| 11 | card capture start / cancel (~1879, ~1944, `intercom_capture` poller) | `cards/capture_start`, `cards/capture_cancel` | no target | no | reader sessions, not person mutations; unchanged |
| 12 | bulk people / CSV (BULKPEOPLE branch, not merged) | n/a today | - | no (bulk not covered in v1) | must not ship person writes outside the fence once the fence is ON; review at that branch's integration |

Row 1 is a real gap of today's journal: an editor `users/create` is sent with no durable intent at all (the grant worker's create has
one, row 5). It is recorded here, not fixed on this branch (no behaviour change); the fence intent closes it.
Door opening (`door_open`, signed and interim) and messaging are not person writes and are out of scope.

Rule when the fence is ON: a covered command reaches WisKey ONLY through `person_writes/submit` with a fresh intent; the plain native
command path for the nine commands is refused locally for that installation (a single switch, never a per-request choice), so no
sender can bypass the receipt. Signed paths keep their signed route.

## 5. Old untracked writes and recovery

- Any write admitted before the fence was switched on, or without a fence intent (every row today, row 1 even without a journal row; any unknown journal row), has no
  receipt and never gets one retroactively. It stays blocked exactly as today (`outcome_pending` / `readback_required`) until a fresh
  readback settles the journal row; a lost create without a receipt stays `unknown` in the journal (`create_unresolved` in the audit).
- Recovery of such a create is the private helper `access_grants._attach_recovered_person` behind the ARX-N04 requirements: an
  authenticated ACTIVE system-admin session, user-active check, per-operation evidence VALIDATION (not reference syntax), audit of the
  decision and of the exact original create, presence never sufficient, several unresolved creates never collapsed. No caller exists.
- With the fence ON, a lost create is resolved by `resolve` on its own intent; `never_committed` may close it as `no_person_created`
  or re-request it under a NEW reviewed intent, never an automatic replay.

## 6. What Arx built on this branch (code, fakes only, all OFF)

- `services/wiskey_peer.py` - the typed seam (`VerifiedPeerRef`, `TransportAttestation`, sealed), the strict shared-receipt verifier
  (`verify_receipt`, `ReceiptExpectation`, `FenceContext`) and the in-memory one-central-commit rule (`OneCommitLedger`).
  REMOVED by PERSONWRITES-CLEANUP-295 (never-shipped draft1 contract, no caller); the seam types stay.
- `services/wiskey_peer_registry.py` - the registry client (`RegistryClient`, `OwnerPin`, the PROPOSED read
  `hikvision_intercom/peer_bindings/get`), revocation / rotation / historical-read rules.
- `services/wiskey_acr5.py` - the ACR5-01..04 consumers (see the module docstring).
- `tests/test_wkpeer_295.py`, `tests/fake_wiskey_peer.py`.

Not built: the intent table and its migration, the fence client (`person_writes/*`), any wiring into `intercom_sync`, the grant engine
or the routes, any settings UI for the pin. Each needs WisKey's delivered half, a joint review and the owner's go.

## 7. Open questions

1. WisKey to confirm or replace Arx's proposed registry read (`peer_bindings/get`, fields as in `wiskey_peer_registry.ROW_KEYS`).
2. WisKey to specify the dedicated principal's exact HA properties (admin or a narrower panel permission) so the owner can create it.
3. Owner decision (later): which Settings screen holds the pin and who may change it (proposal: system administrator, typed
   confirmation, audited; never a WisKey-side push).
