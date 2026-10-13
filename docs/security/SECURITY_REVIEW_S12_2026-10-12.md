# Security review - CR-036 slice S12 (own changes, adversarial self-review)

Branch `pilot/WISKEY-s12-gaps` (from `integ/248` @ `10620d30`). Reviewer: the S12 agent itself (not an independent pass - S13's Opus review
should repeat it, CR-036 2.3). Scope: every file this branch changes. Nothing was run against a real WisKey, Home Assistant or station.

## 1. What changed, by trust boundary

| Change | Boundary | Gate |
|---|---|---|
| `GET /api/v1/access-control/parity` (`routers/access_control_reads.py`, `services/intercom_parity.py`) | browser -> Arx -> WisKey (read channel, existing allow-list; no new command) | `access.admin.read` anywhere (audited 403), then unrestricted (audited 403 `station_scoped`); `as_user` adds `system.configure` at installation (`rbac.require`, audited 403); every report audited (`intercom.parity.report`) |
| Display card (`system-access-display.ts`) | browser -> `PATCH /settings` (existing keys and validation of S6) | `system.configure`, audited by the settings router |
| Action-log filters (`system-access-audit.ts`, `api/access-status.ts`) | browser -> `GET status/audit` (existing route; `user_id` pattern-checked, `start` ISO-checked server-side) | unchanged: `access.admin.read` unrestricted |
| Parity card + checklist (`system-access-parity.ts`), station entry-log link, RTL fix | browser only | the server decides every read |

No migration, no new permission, no new WisKey command, no write to WisKey or a device, no secret, no new dependency.

## 2. Findings

| Id | Severity | Finding | Status |
|---|---|---|---|
| P1 | Medium (privacy) - fixed by design | The parity report reads WisKey UNFILTERED (the service identity sees everything). Leak paths checked: the reply carries counts, completeness flags and HMAC-SHA-256 digests (key = 32 random bytes per process, truncated to 20 hex) - never an id, a name or a value; `reason` is reduced to a code (`adapter.CODE`) or "error"; log lines name the screen and the exception TYPE only; the audit row holds the subject's Arx user id, the window and the outcome per screen. The unfiltered side is installation-wide, so only an administrator unrestricted for `access.admin.read` (who may already read the installation-wide status, conflicts and WisKey's own log) gets it. | tests: `test_counts_and_keyed_digests_only_and_an_audit_row_without_names`, `test_gates` |
| P2 | Low | A digest is a set fingerprint: two digests in one report (or two reports of one process) tell whether two subjects see the same set. The caller is an installation-wide administrator who can read the bindings anyway. Digests do not survive a restart (new key), cannot be matched against a guessed id list (keyed). | accepted |
| P3 | Low (availability) | One report makes about 15-30 WisKey reads on the shared read lane (Arx's buckets: per user 10 + 1/s, shared 20 + 1.5/s; WisKey's own limiter per service identity). During a report other operators' reads can briefly get `rate_limited` (the screens say so calmly and retry). The native reads of an `as_user` report are charged to the SUBJECT's per-user bucket. Mitigations: button only (never polled), one report at a time process-wide (409 `intercom_parity_busy`), screen-level retry with a 2 s pause inside a 50 s deadline (reads only, CR-036 2.5), scans capped at 5 pages per side. | accepted, documented; measure in S14 |
| P4 | Low (integrity of the audit trail) | Running another user's views must not write rows in their name. The subject's Authority is used only for reads that cannot refuse with an audit (`schedules` is called only when the subject is unrestricted; conflicts / WisKey audit / portraits / exports are never called for the subject). | test `test_another_users_report_writes_nothing_in_their_name` |
| P5 | Low | `as_user` resolves any ACTIVE Arx user (inactive / unknown -> 404 `user_not_found`, the id pattern-checked). The 404 tells a system administrator whether an Arx user id exists - they can list users anyway (`identity/users`). | accepted |
| P6 | Info | Opaque event cursors are issued for the subject during a restricted events scan (`adapter.cursors`, keyed by the subject's id); they are never returned to anyone and age out of the bounded cursor store. | accepted |
| P7 | Info | The parity verdict compares sets read at two moments; data changing in between (an event arriving, a person added) shows as `mismatch` - the UI says "run it again; if it repeats, it is a defect". A false `match` would need the native path and the unfiltered read to drop the same row - the expected set is computed independently from the source by the projection rules, so a native-path bug that drops a visible row is still a `mismatch`. | test `test_a_native_view_that_drops_a_row_is_a_mismatch` |
| D1 | Info | Display card: the phrases are free text (max 2000 stored; the dialog keeps 8 x 160) rendered by Lit (escaped) and spoken by the announcement engine only when an operator chooses one; the select values are pattern-checked by the server (`^(everyone|call)$` ...). The card writes only the four S6 keys it changed. | test `evidence-access-s12` (exact PATCH body) |
| D2 | Info | "Switch only in Settings" (owner answer 1): a unit guard fails if any operator screen of the area (`screens/wiskey-*`, `access-control/*`, `components/wk-*`) writes product settings, or if a non-Settings file writes an `access.ui.*` / display key. | `unit-access-parity-logic.spec.ts` |
| A1 | Info | Action-log filters: `user_id` comes from a record the server already showed (and is pattern-checked); `start` is computed client-side and ISO-checked server-side; both are WisKey's own `audit/list` filters, forwarded only for an unrestricted administrator (unchanged gate). | evidence + unit |
| X1 | Info (pre-existing, not this branch) | `intercom.events.export` (S8) stores the export's filters in the audit details, including the `person` search text an operator typed (a name or an employee number) when it was forwarded to WisKey. Not a credential; noted for S13. | for S13 |

No finding requires a fix before merge. The parity report's live behaviour (real latency, WisKey's real limiter, real shapes) is NOT_RUN until S14.

## 3. Checks run (workstation, fakes only)

- Backend: `tests/test_intercom_parity.py`, `tests/test_access_parity_wire.py` (+ `tests/test_access_control_wire.py`) - see the branch report for counts.
- Frontend: `unit-access-parity-logic.spec.ts` (incl. the settings-writer guard), `evidence-access-s12.spec.ts`, `layout-access-s12.spec.ts`.
- NOT_RUN: the full backend suite, the runner's preview / pixel runs, any live run.
