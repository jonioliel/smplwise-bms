# WISKEY-VISITS-2407 - visits and guest templates connected to WisKey (card WISKEY-VISITS-2400)

Branch: `pilot/WISKEY-VISITS-2407`, cut from `origin/main` @ `a4652fda5` (release 2.40.5). Fakes only; nothing touched a device, a door
station, Home Assistant, WisKey or the lab. No merge, no tag, no runner gate.

Owner decision (07.11, question Q6 of V1-REMAINING-2406, option "ב"): connect WisKey's visit mechanism too, not only Arx's own visitor
flow. Design rule given with it: ONE place where the operator manages guests. Arx stays the source of truth and the UI; a guest created in
Arx can be recorded in WisKey's visit mechanism; visits created in WisKey are shown read only in Arx; audit on both sides; no double-write
race. A missing or gated WisKey command is built on the Arx side behind a capability check with a Hebrew reason, and asked of WisKey here.

## 1. What WisKey 2.0.1-rc.10 offers (read from the pinned extraction `docs/integrations/wiskey/catalog/rc10-extract`)

| Command | Class | What it does (rc.10 `access/visit_requests.py`, `access/guest_templates.py`, `visit_requests_api.py`) | Used by Arx |
|---|---|---|---|
| `visits/list` | READ, `users: view` | visit requests with a snapshot (name, category, window, doors), paged, filters status / scope / query | **yes** (read only) |
| `guest_templates/get` | READ, `users: view` | visit presets: label, category, duration, doors, weekly timing (no credentials) | **yes** (presets) |
| `visits/create` | write, `users: manage` | creates a NEW inactive WisKey person + a pending request; approver = another HA user | no |
| `visits/request` | write | a pending request on an EXISTING inactive temporary person | no |
| `visits/decide` | write | approve / reject / cancel; approve must be sent BY the chosen approver | no |
| `visits/operators` | READ | HA users who may approve | no |
| `guest_templates/upsert` / `delete` | write, `users: manage` | edit presets | no (WisKey keeps them) |

Why Arx sends none of WisKey's visit writes:
- `visits/create` would create a second WisKey person for a guest that Arx's grant engine already created (one person = one credential);
- `visits/request` on the grant engine's person makes WisKey's `guard_activation` refuse the engine's own activation write
  (`visit_approval_required`) until somebody approves in WisKey - two approvers of one guest, and a race between the engine's write and
  WisKey's decision;
- `visits/decide` must come from the approver chosen in WisKey (`actor == approver_id`); Arx's single service identity cannot be that
  second person (the same reason `platform/lifecycle_decide` and `jobs/approval_*` are on no channel).

So the bridge needs ONE new WisKey command: a record of an Arx-approved visit (section 4). Everything else is built on what rc.10 has.

## 2. What was built

| Piece | Where |
|---|---|
| Service: capability (with Hebrew reasons), the frames, closed projections, origin marking, the single-writer push and its settle | `smplwise_vms/backend/smplwise/services/wiskey_visits.py` |
| Routes `/api/v1/access/wiskey-visits` (home, visits, templates, links, push, reconcile, settings) | `smplwise_vms/backend/smplwise/routers/access_wiskey_visits.py`, `main.py` (one line) |
| Channels `visits` (`visits/list`, `guest_templates/get`) and `visits_push` (`visits/record_external_v1`, unpinned) | `smplwise_vms/backend/smplwise/services/wiskey_channels.py` |
| Pre-effect refusal codes of the record (the ask's) so a refusal is `refused`, everything else `unknown` | `smplwise_vms/backend/smplwise/services/intercom_client.py` `PRE_STORAGE` |
| Table `wiskey_visit_links` (claim + last outcome per invitation; ids / revisions / codes only) | `smplwise_vms/backend/smplwise/migrations/0208_wiskey_visit_links.sql` |
| Fake WisKey visit side (rc.10 shapes with bait; the record command only when `offer_record`) | `smplwise_vms/backend/tests/fake_wiskey_visits.py` |
| Backend tests | `smplwise_vms/backend/tests/test_wiskey_visits_2407.py`; `tests/test_wiskey_channels.py` (channel tuple) |
| UI: API module, pure logic, the panel; mounted as a section of the external-access Settings dialog | `frontend/src/api/wiskey-visits.ts`, `frontend/src/access-external/wiskey-visits-logic.ts`, `frontend/src/access-external/wiskey-visits-panel.ts`, `frontend/src/screens/access-external.ts`, `frontend/src/i18n/access-external.ts` (`set_visits`, 4 languages) |
| Frontend unit tests | `frontend/tests/unit-wiskey-visits.spec.ts` |

### 2.1 Roles (no double writer)

| What | Writer | In Arx |
|---|---|---|
| Arx invitation (`access_visitor_invites` + grant) | Arx | its own flow (unchanged); the grant engine provisions the person in WisKey (unchanged) |
| WisKey record of that invitation | Arx pushes, WisKey stores | `POST .../{invite_id}/push`; state per invitation in `wiskey_visit_links` |
| Visit created in WisKey's panel | WisKey (its two-person approval) | listed, `origin: wiskey`, `read_only`, no action in Arx |
| Guest templates | WisKey | listed as presets (`presetFromTemplate` turns one into doors + window) |

A WisKey row is `origin: arx` when it is the record Arx pushed (`source: arx`, `external_ref` = an Arx invitation) or its person is an Arx
visitor's linked person (`access_person_links`); otherwise `wiskey`.

### 2.2 The push (sent once, never retried)

1. Gates, all before anything is sent, each audited `access.visitor.wiskey_push` denied with its reason: Arx visitors on (else 404 like
   every visitor route); the caller is the host or holds the grant / people-manage permission on one of the invitation's stations (else the
   uniform 404); the administrator's switch `access.visitors.wiskey_push` is `on` (default `off`; `push_off`); WisKey lists
   `visits/record_external_v1` for the add-on's identity (`push_not_offered` with rc.10); the invitation is decided in Arx and its WisKey
   person exists (`wiskey_visits_not_ready`); explicit `{confirmed: true}`.
2. The claim: `wiskey_visit_links` row -> `sending` with the Arx revision, committed in its own transaction, by a conditional upsert that
   does not take a row already `sending` or `unknown` (a concurrent second push: 409 `wiskey_visits_in_flight`, nothing sent). Same revision
   already confirmed: 409 `wiskey_visits_in_sync`.
3. ONE frame on the `visits_push` guard, people-write lane, `target = visit:<invite_id>`: the feed's own R3-06 gate refuses another write to
   that target while a call is out or until a fresh read (`intercom_outcome_pending`) - a second, independent guard.
4. Outcome row + audit (`phase: attempt` then `phase: outcome`; ids, revisions, codes only - never the visitor's name, number or a code).
   `pushed` (WisKey's visit id kept) | `refused` (WisKey's pre-effect code; a new push is allowed) | `not_sent` | `unknown` (no new push
   until `POST .../reconcile` reads WisKey's list: `recorded` -> pushed, the whole list read and absent -> `not_sent`, list too long ->
   unchanged).

The record carries: `external_ref` (invitation id), `arx_revision` (grant revision + invitation revision: monotonic), `user_id` (the WisKey
person), `status` (`approved` for approved / provisioning / active grants, `ended` for revoking / ended / revoked), `valid_from`,
`valid_until`, `doors`, `approval {kind, approved_at, approver_ref}` (Arx ids), `end_reason`. A cancelled invitation gets a newer revision
and is pushed as `ended`.

### 2.3 What the screens show

The external-access Settings dialog has a section "ביקורים ותבניות אורחים" (hidden while visitors are off): three capability lines
(visits / templates / record), each "זמין" or the server's Hebrew reason; the administrator's on/off for the record (only when the access-
control system offers it); the invitations with their record state and the one allowed action (record / check); WisKey's visits with
status and origin ("נוצר במערכת בקרת הכניסה · צפייה בלבד"); the templates with length and stations. Operator text never names the vendor or
the platform. With rc.10 the record line reads: "מערכת בקרת הכניסה המותקנת עדיין אינה מציעה רישום של ביקור שנוצר ב-Arx. הבקשה הועברה
לספק; עד אז הביקורים מנוהלים ב-Arx בלבד."

### 2.4 What works now (rc.10) vs what needs WisKey

| Works now against rc.10 (fake-verified) | Needs WisKey (section 4) |
|---|---|
| WisKey's visit list in Arx, read only, closed projection, origin marking | the record of an Arx invitation (`visits/record_external_v1`) |
| Guest templates as presets | `source` / `external_ref` on `visits/list` rows (so Arx's records are told apart without the person match) |
| Capability lines with Hebrew reasons; the push refused `push_not_offered`, nothing sent | WisKey's own audit row of each record |
| Arx's visitor flow and grant engine unchanged | a list filter by `external_ref` (reconcile without scanning) |

## 3. Privacy

Read projections drop, whatever WisKey sends: `requested_by` / `approver_id` / `decided_by` / `updated_by` (HA user ids), `employee_no`,
`responsible_person`, `access_purpose`, `pin_configured`, `enabled_cards`, the timing body (only `weekly_hours: bool`), the WisKey person id.
The fake plants all of them as bait; the tests prove none reaches a reply. The pushed frame carries ids, window, doors and status only.

## 4. The exact ask for WisKey

**A1. New command `hikvision_intercom/visits/record_external_v1`** (non-READ; `api_contract` 1; area `users: manage`; listed in
`overview.api.commands` for the add-on's identity when available).

Request (top level, `additionalProperties: false`): `{id, type, api_contract, record}`; `record`:

```json
{
  "external_ref": "<Arx invitation id, [A-Za-z0-9_-]{1,128}>",
  "arx_revision": 7,
  "user_id": "<existing WisKey person id (temporary: visitor/contractor)>",
  "status": "approved | ended",
  "valid_from": "<ISO UTC>", "valid_until": "<ISO UTC>",
  "doors": {"<station_id>": [1, 2]},
  "approval": {"kind": "host_envelope | second_person", "approved_at": "<ISO UTC>", "approver_ref": "<Arx user id, opaque text>"},
  "end_reason": "<code or null>"
}
```

Semantics:
- an idempotent UPSERT keyed by `(source = "arx", external_ref)`; WisKey keeps the highest `arx_revision`: an older one is refused
  `visit_record_stale` BEFORE storing; the same one answers the stored record again (idempotent);
- it is a RECORD only: it must not create a person, must not change `active`, assignments or credentials, must not trigger
  `guard_activation`, and must not create a pending request the grant engine's writes would then be blocked by (`visit_approval_required`);
  the person's access stays the grant engine's writes;
- the record shows in `visits/list` as `status: approved` (or `cancelled` for `ended`), `source: "arx"`, `external_ref`, with the approval
  attributed to Arx (no HA approver id required);
- WisKey writes its own audit row for each accepted record (`visit_external_recorded`, with `external_ref`, `arx_revision`, `status`).

Answer: `{"visit_id": "<id>", "revision": <int>, "arx_revision": <int>, "status": "approved | ended"}`.

Refusals raised BEFORE the store is written (Arx reads them as `refused`; every other code as `unknown`): `installation_unavailable`,
`writes_disabled`, `visit_record_stale`, `revision_conflict`, `user_not_found`, `visit_user_not_temporary`, `storage_stopping`, plus the
pre-dispatch codes (`unauthorized`, `invalid_fields`, `api_incompatible`, `request_too_large`, `rate_limited`, `unknown_command`).

**A2. `visits/list` rows:** add `source` (`"arx"` | `"wiskey"`) and `external_ref` (null for WisKey's own); accept a filter
`external_ref` (exact) so Arx's reconcile is one read instead of a scan of up to 5 pages.

**A3. Confirm** that `visits/list` and `guest_templates/get` stay READ commands granted at `users: view` for the add-on's identity on a
managed install (Arx relies on that for the read-only view).

## 5. Tests (exact counts in section 7)

Backend `tests/test_wiskey_visits_2407.py` (live service session against `VisitsFake`, Arx side on the real visitor flow with
`FakeAccessEngine`): channels and allow-lists; feature state and Hebrew reasons; rc.10 (no record command): push unavailable, nothing sent,
denied audit row; the switch as a second condition and system-administrator only; everything 404 while visitors are off; the visit list
read only, closed, origin-marked; people-read unrestricted; templates without the operator / sensitive texts; projections with unknown
values; the push: confirmation, one frame of ids only, attempt + outcome audit, in-sync refusal, the record listed as Arx's; a cancelled
invitation pushed again as `ended` with a newer revision; a pre-effect refusal then a new push; an older revision never overwrites a newer
record; no answer -> unknown, no resend, reconcile `recorded`; never stored -> reconcile `absent` while the feed still holds the target
(`intercom_outcome_pending`); a `sending` claim blocks a concurrent push; only host / station manager; a requested invitation is not
pushable. `tests/test_wiskey_channels.py`: the adapter channel tuple updated.

Frontend `tests/unit-wiskey-visits.spec.ts`: capability lines, the vendor-name ban on operator texts, status / origin texts, the record
plan (an unknown is only checked), template presets, durations.

## 6. LAB steps (NOT_RUN - an owner session; read only unless stated)

1. With Arx visitors on in the lab installation, open external access › Settings › "ביקורים ותבניות אורחים": the visits and templates
   lines should read "זמין"; the record line the "not yet offered" reason (rc.10). Expected: no WisKey write (check WisKey's audit).
2. Compare the listed visits with WisKey's own panel (counts by status); confirm no HA user id, employee number, responsible person or
   purpose appears in Arx (browser devtools on `/api/v1/access/wiskey-visits/visits`).
3. Compare the templates with WisKey's panel (labels, durations, stations).
4. After WisKey ships A1/A2 (a new rc, diffed with `scripts/wiskey_contract_diff.py`): owner-approved, task-specific step - turn the
   record switch on, record ONE test invitation, check it in WisKey's visit list and audit, cancel it in Arx and record again (`ended`);
   then switch off. Rollback: switch off; WisKey's record stays as history (no access effect by the ask's definition).

## 7. Results

Run on the workstation (Windows, Python 3.12 venv, Node 24.21.0), fakes only, 2026-11-07:

| Command (from the worktree) | Outcome |
|---|---|
| `python -m pytest tests/test_wiskey_visits_2407.py tests/test_wiskey_channels.py tests/test_intercom_writes_s11.py tests/test_externalbuild_297.py tests/test_wiskey_access_diag.py -q` (in `smplwise_vms/backend`) | **153 tests: 149 passed, 4 skipped (pre-existing skips in test_wiskey_channels), 0 failed** - of which test_wiskey_visits_2407 18/18 passed, test_wiskey_channels 42 passed + 4 skipped |
| `python -m pytest tests/test_wiskey_contract.py tests/test_intercom_adapter.py tests/test_migrations.py tests/test_backup.py tests/test_backup_sensitive.py -q` | **130 tests: 130 passed, 0 failed** |
| `node node_modules/typescript/bin/tsc --noEmit` (in `frontend`) | exit 0 (clean) |
| `npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-visits.spec.ts` | **6/6 passed** |
| `python scripts/project_status.py --write` | PASS (451 tasks, 560 requirements; no application tests) |

NOT_RUN: the full backend suite and the runner gate, the UI evidence / pixel suites and screenshots, every LAB step (section 6).

## 8. Known limits

- The record is manual per invitation (one button); an automatic push after every Arx change is a follow-up once WisKey ships A1 and the
  owner approves it.
- Templates are read only in Arx (managed in WisKey); editing them from Arx (`guest_templates/upsert` exists in rc.10) was not built - one
  place to manage presets stays WisKey's until the owner asks otherwise.
- WisKey's own pending visits cannot be approved from Arx (WisKey's two-person rule needs its chosen approver).
- Migration 0208 (0207 is used by another branch); renumber at the train if needed. Rollback: drop `wiskey_visit_links`, remove the route
  line in `main.py`; nothing else changes behaviour (the switch defaults off).
- UI screenshots (desktop / mobile / RTL; loading / empty / error / ready) are NOT_RUN - runner step before a train.
