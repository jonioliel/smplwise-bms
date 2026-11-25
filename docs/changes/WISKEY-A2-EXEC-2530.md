# WISKEY-A2-EXEC-2530 - WisKey's reviewed schedule execution (A2): read-only status in Arx, never an approval

Branch `pilot/WISKEY-A2-EXEC-2530`, cut from `origin/release/2520-train` `eadaa25b8`. Target version: 2.53 (the owner deferred A2 from
2.52 to 2.53). Status: gap analysis written first (section 2), then built and tested against fakes only. Nothing installed, no lab,
no Home Assistant, no WisKey contact, no device I/O.

Owner decisions applied (25.11): A2 = option b, "the owner approves in WisKey's own screen, Arx shows status only"; Arx NEVER
self-approves (no `operations_decide_v1` from Arx's identity); B2-ABI rules (short signed calls, signed status reads <= 58 s, UNKNOWN
settled only by a status read of the same id, never replay); legacy schedules never shown as open; the existing deploy warning stays
until an operation is actually approved and executed; everything behind a new setting, default OFF.

## 1. Inputs (read only; the WisKey checkout was not modified)

| what | identity |
|---|---|
| WisKey PRODUCT rc20 | `dcebb9f34c8f95638e498115a2aeb5ce2711981e` - contracts `docs/contracts/full-management-v1/schedules--operations_{status,pending,review,decide,preview,execute,cancel}_v1.*.schema.json` and `definitions.json` (`ScheduleExecutionStatus`, `ScheduleJob`, `ScheduleDeployment`, `SchedulePending`, `ScheduleReview`); source read for facts only: `schedule_execution_api.py`, `fleet_approval.py`, `operations_center.py` (`review` / `consume`), `native_owner_access.py`, `bridge_command_scope.py`, `bridge_command_auth.py` (`_dispatch_bridge_principal`, `actor_id`), `trusted_actions/direct_bridge_origin.py` (`command_names`), `api_contract.py` (`READ_COMMANDS`), `websocket.py`, `tests/ha/test_m15_schedule_execution.py` and `tests/ha/test_arx2520_adoption.py` (read, not run). |
| WisKey hand-off | `57e4615e0b943638b7e6cdcd4565c183e559483e` `docs/owner-development-2026-11-25/mac-arx-adoption/`: `OWNER_DECISIONS.json` (A2 `DEFERRED_TO_ARX253`, "no self-approval"), `MASTER_TASKS_UPDATED.json` row A2 ("operations_decide_v1 adoption deferred to 2.53; the warning stays; no self-approval"), `REMAINDERS_BY_OWNER.json` (A2-ARX253), `FORWARD_TO_ARX_HE.txt`. |

## 2. Gap analysis - what the contract lets the add-on identity do

"The add-on identity" = the signed pairing principal of Arx's direct join (the `arx-service:<entry>` subject of the direct v2
connection, R7). Over that path WisKey runs `bridge_command_auth._dispatch_bridge_principal` -> `websocket._dispatch` with a command
scope; `native_owner_access.require_owner` passes for a verified scope ("explicit paired-bridge owner delegation"), and the actor is
`arx:<entry>:<query_owner>` (or `arx:<signed actor id>`). Discovery (`command_names`) lists every registered native route for that
subject, so all nine `schedules/operations_*_v1` commands are reachable. What each one would do for Arx:

| command | WisKey class | what it does for the add-on identity | Arx |
|---|---|---|---|
| `operations_status_v1` {job_id} | READ | the job, its deployment journal (steps, issue), `terminal`, `physical_result: unproven`, `replay_available: false`; no station I/O | **used** (signed, 15 s <= 58 s) |
| `operations_pending_v1` {} | READ | every live review of the execution contract (all actors), `own_request`, remaining seconds | **used** (10 s) to count this job's reviews |
| `operations_review_v1` {review_id} | READ | one review: state pending / approved / rejected, plus the fingerprint and the draft a decider needs | **used** (10 s); only `state` is kept |
| `operations_decide_v1` | write (approval) | `fleet_approval.decide` refuses only the review's OWN actor (`separate_approver_required`). Arx's actor is not the owner's, so the add-on identity COULD approve a review the owner opened - an Arx approval. | **never sent** (owner decision) |
| `operations_execute_v1` | write (station PUTs) | `dual = ... dual_approval and not bridge_authorized(hass, user)`: for the pairing principal WisKey SKIPS its dual-approval check. An execute from Arx (after Arx's own preview) would run the schedule on the station with no owner approval at all - equivalent to a self-approval. | **never sent** |
| `operations_preview_v1` | READ class, but creates state | opens a 300 s in-memory review bound to the CALLER's actor; `operations_center.consume` refuses any other actor (`review_expired`). An Arx-opened review could be approved by the owner but executed only by Arx (the execute above). | **never sent** |
| `operations_cancel_v1` | write | cancels / discards an unstarted deployment | **never sent** (status only) |
| `operations_watch_v1` / `resume_v1` | READ (subscription / cursor) | progress events; not needed for a click-to-check status | not used |

Gap: the contract has **no "submit for the owner's approval" primitive that the owner can both approve and run**. A review is owned by
whoever opened it; the owner's screen works on WisKey's JOBS list (preview -> his own approval rules -> execute). Arx's existing deploy
(`schedules/operations_create` + WisKey's preflight `operations_check`, WISKEY-SCHED-WRITE-2390) already creates the job in that list -
that is the "request". So under option b Arx sends nothing new that writes: it reads the status of the job and points to WisKey's
screen for the approval and the run. The four writes above are refused on the direct envelope before any byte
(`wiskey_direct_catalog.SCHEDULE_EXECUTION_OWNER_ONLY` -> `owner_action_in_wiskey`, the R7 pattern of `WISKEY_OWNER_ONLY`); none of the
nine is on any classic Home Assistant channel (whose identity is not the add-on's anyway).

Producer-side finding worth forwarding to the WisKey owner (no change requested here, recorded only): the bridge path skipping dual
approval for `operations_execute_v1` means any paired service principal can run a reviewed schedule without a second approver. Arx
never calls it; WisKey may want an explicit refusal for pairing principals (`owner_action_required`) so the rule does not depend on
the consumer's restraint.

## 3. What was built

Backend (`smplwise_vms/backend/smplwise/`):

- `services/wiskey_schedule_execution.py` (new): the three reads over the installed direct join (`JoinPort`, the SCHED-READS pattern:
  discovery of the CURRENT connection first - `operations_status_v1` must be listed, else `unsupported` / `unavailable` and nothing is
  sent; pending + review are used only when both are listed); every call's timeout checked `0 < t <= 58` before anything is sent
  (`timeout_exceeds_abi`, not_sent); every frame is a fresh signed request (DirectLink: own nonce, own 10 s proof window). Closed
  readers of `ScheduleExecutionStatus` (eleven keys, `contract`, `operation_id` = the asked job, `physical_result: unproven`,
  `replay_available: false`, `all_intermediate_events_delivered: false`, the closed `ScheduleJob` and `ScheduleDeployment` with their
  enums), `SchedulePending` and `ScheduleReview` (only `state` kept; the fingerprint, the review id and the draft are never kept or
  returned). The phase: `waiting_owner`, `review_pending`, `approved`, `rejected`, `executing`, `attention`, `executed` (job `verified`
  AND deployment `verified` with every step `verified`), `failed`, `cancelled`, `not_found`, `unknown`. A verified job WITHOUT a
  deployment record (the legacy path) is `unknown` (`deployment_missing`), never executed and never "open". UNKNOWN is settled only by a
  status read of the same job id; a failed / out-of-contract read never changes what was known; a final read (executed, cancelled) is not
  read again. One check per job at a time (429). Memory only (64 jobs; a restart forgets: the warning returns until a new read).
  Switch `wiskey.schedule_execution_status` (`on` / `off`, default off).
- `routers/access_control_schedule_execution.py` (new): `GET /access-control/schedules/execution` (switch, `can_configure`, support -
  no WisKey call while off - and the jobs read), `POST /access-control/schedules/execution/{job_id}/status` (one check; 409
  `feature_disabled` while off, nothing sent), `PUT /access-control/schedules/execution/settings` `{enabled}` (system administrator,
  `require_system_admin`, audited `intercom.schedule_execution_settings` with before / after; turning it off forgets the reads).
  GET / POST use the schedules administrator gate of the writes router (audited 403).
- `wire/access_control_schedule_execution.py` (new) + `frontend/src/api/generated/wire-access-control-schedule-execution.ts`
  (generated): response models.
- `services/wiskey_direct_catalog.py`: `SCHEDULE_EXECUTION_OWNER_ONLY` (decide, execute, preview, cancel) in `direct_refusal`.
  **This file belongs to R7 (WISKEY-DIRECT-V2-2520, already on the train)**: 9 added lines, one changed condition.
- `routers/__init__.py`, `scripts/gen_wire_types.py`: one mount line, one family line (adjacent to the lines
  WISKEY-SCHED-READS-2520 adds: a trivial merge conflict, keep both).

Frontend (`frontend/src/`):

- `components/wk-schedule-exec.ts` (new): the block "מצב הביצוע ב־WisKey" under the jobs card of the library's management view.
  Off: a system administrator sees one line with the switch (`sw-toggle`); everybody else sees nothing (the host is `hidden`, so the
  library's flex gap is exactly as before). On: the hint "approving and running happen only in WisKey's screen, by the system owner;
  Arx neither approves nor runs", the support line, the newest five jobs (no inner scrolling; "+N more"), each with its phase badge,
  one line of explanation, the steps verified (when a deployment exists) and ONE action - "בדיקת מצב" (one signed read). No control
  approves, runs, previews or cancels. Existing components and tokens only.
- `components/wk-schedule-library.ts` (+14 lines): renders the block; the two `deployWritesOff` warnings stay as they are, and switch
  to `sx_writesOwnerOnly` ("deploying in Arx only creates a job and runs a preflight; the schedule reaches the station only after the
  owner approves and runs the job in WisKey's screen") only after a status read showed a job executed. The deploy confirmation and
  progress lines (which describe Arx's own deploy, still true) are unchanged.
- `api/schedule-execution.ts`, `access-control/schedule-execution-logic.ts` (new); `i18n/schedule-editor.ts` +
  `i18n/lang/en/i18n/schedule-editor.ts`: `sx_*` strings, Hebrew and English (inserted after `jobsEmpty`, away from SCHED-READS' `sr_*`).
- tests: `frontend/tests/schedule-exec-mocks.ts` (own mock file, registered after the writes mock: no edit of
  `schedule-writes-mocks.ts`), `unit-schedule-execution-2530.spec.ts`, `evidence-wiskey-schedule-exec-2530.spec.ts`,
  `pixel-wiskey-schedule-exec-2530.spec.ts` (+ Linux baselines).

## 4. Tests (real results)

See section 4.1 (filled from the runs; NOT_RUN stated where not run).

### 4.1 Results

| command | where | exit | result |
|---|---|---|---|
| `python -m pytest -q tests/test_wiskey_schedule_execution_2530.py` (main checkout venv) | PC | 0 | 21 passed |
| `py -3.12 -m ruff check` on the 5 changed / new Python files | PC | 0 | all checks passed |
| `scripts/gen_wire_types.py` (write) | PC | 0 | one new generated file |

## 5. Not done / limits

- Real WisKey rc20, the lab, the bridge: NOT_RUN by rule. The lab runs WisKey rc.10: `operations_status_v1` is not listed there, so the
  block says "unsupported" and nothing is sent (the tested path).
- No persistence of reads (memory only) - deliberate: no migration (avoids the 0225 number SCHED-READS takes), and a restart brings the
  original warning back until a new read.
- No automatic polling: a status check is one click (as SCHED-READS open question 2 recommends).
- The phase `approved` / `review_pending` exists only while WisKey's dual approval is on and the owner opened a review (reviews live
  300 s in WisKey's memory); with dual approval off the owner runs directly and Arx sees `waiting_owner` -> `executing` -> `executed`.

## 6. Open questions

1. Scope of A2 in Arx: a) status only, as built (recommended - owner option b; the contract has no owner-runnable submit) b) Arx opens
   the review and executes after the owner's approval is read as `approved` (needs a new owner decision: WisKey does not enforce the
   approval on the bridge path, Arx would be the only guard).
2. The producer finding (execute skips dual approval for a pairing principal): a) forward to the WisKey owner as information, no
   request (recommended) b) ask WisKey to refuse execute / decide / preview for pairing principals explicitly.
3. Where the switch lives: a) in the block itself, system administrators only (recommended, as built) b) in the WisKey switches screen
   (`system-security-wiskey-managed`), which has the go-live permit semantics this read does not need.
