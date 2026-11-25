# WISKEY-R6-2520 - B8 `visits/record_external_v1`: Arx's consumer brought to WisKey rc.19's `external-visits-v1` contract

Row R6 of the WisKey adoption plan (`docs/changes/WISKEY-RESYNC-2520.md` section 4.4, row table section 6; plan name
WISKEY-B8-VERIFY-2520). Branch `pilot/WISKEY-R6-2520`, cut from `origin/pilot/WISKEY-RESYNC-2520` (`a7eb3159a`). Target 2.52.
Software only: nothing was installed, nothing touched the lab, no message went to WisKey.

## 1. Inputs (read only)

- WisKey hand-off `8c6b10208e3fc356581d73a49a062a7a62f726f9` (read-only checkout, never modified): `docs/contracts/external-visits-v1/`
  (CONTRACT.txt, record / request / result / error v1 schemas, EXAMPLE_INDEX, SCHEMA_INDEX, 16 synthetic examples), the producer
  `custom_components/hikvision_intercom/access/external_visits.py` (`record`, `upsert`, `project`), `access/visit_requests.py` (`visits/list`
  filters), `external_visits_api.py`; `docs/owner-development-2026-11-24/` MASTER_TASKS_REVIEWED.json (B8), CONSUMER_ADOPTION_DELTA.json
  (B8 requirement), ARX_CURRENT_CONSUMER_REVIEW.json (ARX-B8-PARTIAL). The contract directory is byte-identical at PRODUCT rc.19
  `3e7bfc585d5a30bddd97ceeed1bb0d7032ee021d`.
- WisKey's B8 statement (MASTER_TASKS_REVIEWED, B8 `current_reply`): record only (upsert by `arx` / `external_ref`, CAS, revision, audit,
  exact filter, original READs), no person / credential / activation / new grant, UNKNOWN kept without replay, store-v2 has no code-only
  downgrade to rc.17 after a write, the users / visits preimage is not a full HA / Arx backup or later history.

## 2. Gaps found in Arx (WISKEY-VISITS-2407) and what changed

| gap | risk | change |
|---|---|---|
| Every `success: false` answer of the record command was read as **refused** (`_result` raised IntercomError for any code), so `visit_record_outcome_unknown` / `bridge_outcome_unknown` - and any unlisted code - settled the link `refused`, which allows a new push: a replay after an UNKNOWN | high (contract violation: UNKNOWN must not be replayed) | `record_answer`: a closed code table. `RECORD_REFUSED` = the contract's pre-write refusals (the seven named codes, validation `invalid_*`, `visit_request_limit`, the transport / permission codes of `PRE_DISPATCH`); `RECORD_UNKNOWN` = the two UNKNOWN codes; anything else is `UnclearAnswer` -> outcome `unknown` (fail toward unknown) |
| `approval.approved_at` / `approver_ref` could be sent as null (`g.get(...)`), `end_reason` null for `ended`, timestamps / UUID / doors never checked | medium (WisKey refuses; or Arx sends a record it cannot stand behind) | `record_problems`: record.v1 + the producer's business rules (nine closed keys, exact references, lowercase UUID person, explicit-offset instants, `1970 <= from < until <= 2037-12-31T23:59:59Z`, 1..100 stations of unique locks 1/2, strict integer revision, approval kind / instant / approver, `end_reason` null for `approved` and non-empty for `ended`). A record with problems is refused **in Arx** before the claim: 409 `wiskey_visits_record_invalid`, `details.problems` = field paths only, audited `access.visitor.wiskey_push` denied `record_invalid`; nothing is sent, no link row. `pushable` in the link view is false for such a record. Nothing is filled in to make a record valid |
| `end_reason` of an ended record came from the invitation only (null when the grant ended by itself) | low | the invitation's reason, else the grant's (`ended`, `manual` ... - Arx's own words); both null -> `record_invalid`, not sent |
| The success answer was projected loosely (`_id`, revision may be null, status may be `unknown`) and never compared with what was sent | medium (a mis-shaped or foreign receipt read as "pushed") | `project_record(raw, expect=record)`: result.v1 exactly (closed four keys, lowercase UUID, strict revisions, `approved` / `ended`) and the sent `arx_revision` + `status`; anything else raises -> outcome `unknown` (settled by the reconcile) |
| The reconcile scanned up to 5 pages x 200 and called **any** found row "recorded", whatever revision WisKey held | medium (an older record read as proof of the newer one) | when WisKey offers the record command (rc.19 B8) the reconcile sends ONE `visits/list` with the exact, case-sensitive `filters.external_ref` (decided before sending; the rc.10 page scan stays only when the command is not offered - rc.10 refuses the filter `invalid_fields`; no fallback after a refusal). The verdict compares WisKey's `arx_revision`: equal -> `recorded`; older -> `absent` (code `older_revision_in_wiskey`; WisKey keeps the highest revision); newer, missing or two rows for one key -> `undecided` (nothing settled) |
| `ended` was not a known list status (an Arx record that ended showed `unknown`) | low | `ended` added to the projected statuses, and end to end on the screen (follow-up from the coordinator): `VisitStatus` in `frontend/src/api/wiskey-visits.ts`, `STATUS_TEXT` in `frontend/src/access-external/wiskey-visits-logic.ts` = "הסתיים" (tone `off`), English "Ended" in `frontend/src/i18n/lang/en/i18n/msg/misc.ts` |
| The refusal texts lumped `revision_conflict` with "newer version" and had no text for limit / missing person / not a visitor / stopping | low | `REFUSAL_TEXT`: own API code + Hebrew text per code, English in `details.message_en` (I18N-BACKEND-2490 path 2). `revision_conflict` is now `wiskey_visits_revision_conflict` (was `wiskey_visits_stale`); `visit_record_stale` keeps `wiskey_visits_stale`. The unknown and record-invalid messages carry `message_en` too |

Kept unchanged: the switch (default off), capability discovery (`push_not_offered` with rc.10), the `sending` claim, one frame on the
closed `visits_push` channel, people-write lane, R3-06 target hold, never retried, attempt + outcome audit rows, `external_ref` = the
invitation id, `arx_revision` = grant revision + invitation revision (monotonic), the read-only projections, no WisKey visit write
(`create / request / decide ...`) on any channel. No registry file changed (`wiskey_channels.py`, `intercom_client.py` untouched).

## 3. Operator / runbook text (docs)

`docs/user-guide/he/52-external-access_HE.md`, new subsection "רישום ההזמנה ב-WisKey (רישום בלבד)":
- record only - no person, code, card or activation is created and no permission changes;
- an invalid record is not sent (fields named, nothing invented); an unclear outcome is never resent - only "check against the access
  control system";
- the same revision twice changes nothing;
- **after WisKey stores its first record, a code-only downgrade of WisKey to rc.17 is not possible** (the old code refuses the visits
  schema 2), and **WisKey's users / visits backup taken at that moment is not a full Home Assistant / Arx backup** and does not cover later
  changes; take a full HA + Arx backup before the first enable; any restore only with the owner.
The combined `GUIDE_ALL_HE.html` is not rebuilt here (it is rebuilt by the release docs refresh).

## 4. Files

- `smplwise_vms/backend/smplwise/services/wiskey_visits.py` - contract constants, `record_answer`, `record_problems`, `project_record(expect)`,
  `find_external(exact)`, `record_of` end reason, claim refusal, `REFUSAL_TEXT` / `wiskey_refusal`, module note.
- `smplwise_vms/backend/smplwise/routers/access_wiskey_visits.py` - push projection with `expect`, `message_en` on the unknown answer,
  reconcile (exact read when offered + revision verdict), route note.
- `smplwise_vms/backend/tests/fake_wiskey_visits.py` - rc.19 producer semantics (independent port of `external_visits.record` / `upsert`;
  external list rows; exact filter, refused while the command is not offered; UUID visit ids; frame / store counters).
- `smplwise_vms/backend/tests/test_wiskey_visits_2407.py` - the shared fixture gives the fake engine's new people UUID ids (WisKey's ids
  are UUIDs and the record carries one); two literal visit ids updated.
- `smplwise_vms/backend/tests/test_wiskey_visits_b8_2520.py` (new).
- `smplwise_vms/backend/tests/fixtures/wiskey_rc19/external-visits-v1/` (new) - copied unchanged from `8c6b10208` (git blob ids):
  EXAMPLE_INDEX `33786d2c`, SCHEMA_INDEX `c9996d5d`, record.v1.schema `53caa40e`, request.v1.schema `90cfc8a3`, result.v1.schema `656b1a0e`,
  error.v1.schema `7eadeff6`; examples record.v1 valid `87caa5e9` missing `c3adf3a4` wrong-type `a8449173` extra `59cf4cc6`; request.v1
  valid `4d9d2e5a` missing `70e3568f` wrong-type `d44e67ad` extra `7ea143be`; result.v1 valid `9b71ae3b` missing `83632a51` wrong-type
  `d898c2b4` extra `e1f6b269`; error.v1 valid `bfaa3f6f` missing `48b8bc91` wrong-type `f8842d72` extra `8d098ce3`. A test checks the
  schema bytes against SCHEMA_INDEX's sha256.
- `frontend/src/api/wiskey-visits.ts`, `frontend/src/access-external/wiskey-visits-logic.ts`, `frontend/src/i18n/lang/en/i18n/msg/misc.ts`,
  `frontend/tests/unit-wiskey-visits.spec.ts` - the `ended` label.
- `docs/user-guide/he/52-external-access_HE.md`, this note.

One status label added in the visits panel (text only, existing tone, no layout change; no compare page made). No wire model changed (no new response key). No migration, no setting. Rollback: revert the commit.

## 5. Tests (PC, one file at a time, repo venv; real results)

| command (from `smplwise_vms/backend`, `C:\cloude\smplwisebms\.venv` python, `-p no:cacheprovider`) | exit | result |
|---|---|---|
| `pytest -q tests/test_wiskey_visits_b8_2520.py` (new) | 0 | 51 passed (first run: 4 test-side errors - a hand-inserted link row without `attempted_at`, an `end_reason` outside the grants CHECK list, and the /links wire model below; fixed in the tests, then a full re-run) |
| `pytest -q tests/test_wiskey_visits_2407.py` (after the fake / fixture changes) | 0 | 18 passed |
| `pytest -q tests/test_wiskey_rc10_pin.py tests/test_wiskey_visits_2407.py` (final tree) | 1 | 112 passed, 1 skipped, **3 failed - not R6**: `test_every_channel_command_is_an_rc10_command_including_the_formerly_unpinned_ones[system_status / relay_inventory / station_sync_v1]` - the three channels R1 registered (unpinned, newer than rc.10) are not exempted in that test's pin check. R6 changes no channel; the fix belongs to the registry owner (R1 / WISKEY-RESYNC-2520) - reported, not edited |
| `ruff check` on the five changed Python files | 0 | all checks passed |
| `npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-visits.spec.ts` (node only) | 0 | 7 passed (incl. the new `ended` label test) |
| `npx playwright test -c playwright.unit.config.ts tests/unit-i18n-en-ratchet-2490.spec.ts` | 0 | 5 passed (every catalogue key has its English) |
| frontend `tsc --noEmit` + `-p tsconfig.tests.json` (runner, slot B) | 0 | both 0 (no errors); slot granted at once, commit `3a721f7ce` |
| full backend suite, other frontend unit specs, Playwright e2e, `gen_wire_types --check`, `wire_ratchet` | - | **NOT_RUN** (PC memory rule; no wire file changed). The train gate runs them |
| producer rc.19 / live WisKey / lab | - | **NOT_RUN / NOT_MEASURED** by rule (no lab, no install, no contact with WisKey). The lab has rc.10: the push stays `push_not_offered`, nothing is sent |

Finding (not R6's file): the `/access/wiskey-visits/links` wire model (`wire/access_wiskey_visits.py` `AccessWiskeyVisitsLinksLink`)
types `pushed_revision`, `wiskey_visit_id` and `attempted_at` as non-null, written from answers recorded after a push. A never-pushed
invitation answers null there, which the strict test oracle refuses (production lets drift through). The R6 test reads that case through
the service instead. See Q5.

## 6. Open questions (owner; unanswered = recommendation)

1. A record Arx cannot make valid (e.g. a grant without an approval instant): a) refuse in Arx with the field names, nothing sent
   (recommended, built) b) fill a default (`approver_ref: "system"`, `approved_at` = now) - rejected: invents an approval fact.
2. The screen label for `ended`: done on this branch at the coordinator's request ("הסתיים" / "Ended"). Still open: the list's status
   filter (router `status` Literal and the panel) has no `ended` option. a) leave it - rc.10 refuses `ended` as a filter (recommended
   until rc.19 is installed) b) add it now, gated on the record command being offered.
3. `revision_conflict` now has its own API code `wiskey_visits_revision_conflict` (was `wiskey_visits_stale`). The screen shows the
   server text, so nothing breaks. a) keep (recommended) b) keep the old code.
4. First enable on a real WisKey: a) only after rc.19 is installed by the owner (Q7 of the plan), a full HA + Arx backup is taken, and one
   test invitation is pushed and reconciled in a set window (recommended) b) enable together with the rc.19 install.
5. The /links wire model rejects a never-pushed link in strict tests (finding in section 5): a) widen the three fields to nullable in the
   wire file in a follow-up owned by whoever owns `wire/access_wiskey_visits.py` (recommended) b) leave it.
6. `tests/test_wiskey_rc10_pin.py` fails for R1's three unpinned channels on the base `a7eb3159a`: a) R1 adds them to that test's
   unpinned exemption, like `visits_push` (recommended) b) R6 edits it (not done: registry expectations belong to R1).
