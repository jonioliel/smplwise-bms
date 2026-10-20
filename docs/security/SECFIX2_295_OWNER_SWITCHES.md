# SECFIX2-295: public-surface hardening - what changed and the switches waiting for the owner

Branch `pilot/SECFIX2-295` (from `pilot/SECFIX-293` + `integ/293`). Source findings: `private/planning/SECURITY_REVIEW_PUBLIC_2026-10-20.md`
(PUB-03, PUB-04, PUB-07) and the open item of the 2.9.3 release report (a restricted writer gets 403 instead of 404 for a malformed WisKey
person record of a person he cannot see). Every new behaviour that a user could notice shipped OFF; the owner's decisions of 2026-10-21
(below) set the PUB-03 defaults and keep the other two switches OFF.

## 1. Summary

| Item | What changed | Default | Owner decision |
|---|---|---|---|
| PUB-07 | The local-identity and passkey **public** routes run their guard (remote channel only, the switch, https, login CSRF) before the request body is read or validated. A malformed body on the local channel is now the same 404 as a well-formed one; on the remote channel a switch / CSRF / transport refusal comes before any 422. | Always on (no switch) | None. Strictly safer and invisible to users: the remote sign-in page's answers are unchanged (a malformed body behind a passed guard is still the same 422). |
| PUB-03 | Retention of technicians a vendor typed on the arrival page that nobody accepted or rejected (option A of the proposal), plus a per-vendor cap of undecided technicians. | **90 days / 10 per vendor** (owner 2026-10-21) | Decided: the recommendation. Still editable (section 5). |
| PUB-04 | Vendor portal `start`: the number-dependent work can run on the public listener's own worker thread (option A of the proposal). | OFF (`false`) | Decided 2026-10-21: stays OFF; the measurement is a documented step (section 3). |
| Unknown person 404 | A restricted writer who cannot see a person whose WisKey record is malformed / incomplete can get the uniform 404 instead of the 403. | OFF (`false` = today's 403) | Decided 2026-10-21: stays OFF until the Fable review (section 4). |

## 2. PUB-03 - undecided vendor-typed technicians (privacy)

- Settings (system administrator, `PUT /api/v1/access-grants/settings`; never exported in or restored from a project backup):
  - `pending_retention_days` (`access.external.pending_retention_days`): default **90**; `0` = off; otherwise 7-365 days.
  - `pending_max_per_vendor` (`access.external.pending_max_per_vendor`): default **10**; `0` = no cap; otherwise 1-100.
  - Upgrade: an installation that never saved a value reads the new default; a saved value (also `0`) is kept.
- With a period set, once an hour the janitor erases every undecided row older than the period exactly like the manager's "reject and
  delete": the name becomes the tombstone, the phone number and its keyed index are cleared, the open request for him ends (`refused`).
  It never touches a row that was accepted or rejected, a person linked to a door-system record, or a person with a decided grant. One
  audit row per run with counts only (`access.pending_contact.expired`).
- With a cap set, the arrival page refuses the next typed technician of that vendor with the existing "too many" answer (429); naming one
  of the vendor's existing persons is never capped; decided rows do not count.
- The needs-review report already lists an undecided technician from day 30, so a manager sees a real request well before any erase.
- **Owner decision 2026-10-21:** 90 days (option A) and 10 per vendor, as recommended.

## 3. PUB-04 - vendor portal sign-in timing (residual, Low)

- Setting: `tickets.settings` -> `vendor_portal.start_worker` (system.configure; boolean).
- Off (today): the answer (identical 202 for every number) is sent, then the lookup runs as a background task inside the same request,
  so the connection stays busy a few milliseconds longer for a known number. The CR already accepts this residual.
- On: the request only queues the job (a bounded queue of 64; a full queue drops the job silently and counts it, the answer stays the
  same 202) and one worker thread of the public listener does the work. The request ends at once and identically for every number.
- Visible difference when on: none for a vendor in normal use. Under a flood (more than 64 sign-in requests waiting) some codes are not
  sent; the vendor asks again.
- **Owner decision 2026-10-21:** stays OFF. Step zero is now a documented, opt-in test:
  `SW_MEASURE_PORTAL_START=1 SW_MEASURE_N=500 ~/run_remote.sh backend <branch> tests/test_secfix2_pub04_timing_measure.py -s`
  (alone on the runner; it prints `PUB04_TIMING {...}` - medians, p95 and the median known-minus-unknown difference for both modes -
  and leaves the switch OFF). Record the line in CR-VENDOR-PORTAL section 6; the owner decides after it.

## 4. Unknown person record: 404 instead of 403

- Setting: `access.unknown_person_uniform_404` (`PATCH /api/v1/settings`, system.configure; `true` / `false`).
- Off (today): a writer limited to some stations gets 403 "the person is linked to a station you do not manage" for a person whose WisKey
  record is malformed, even when he cannot see that person - he learns that the id exists.
- On: such a writer gets exactly the answer of an id WisKey does not know (404). A caller who can see the person (unrestricted read or
  manage) still gets the 403 with its reason. An unrestricted writer is unaffected.
- Visible difference when on: a restricted operator who tries to change a person of his own station whose WisKey record is malformed sees
  "not found" instead of the 403 - consistent with the people list, which already hides such a record from him.
- Recommendation: on (it removes the oracle and agrees with the read side). **Owner decision 2026-10-21:** stays OFF until the Fable
  review of the public surfaces (docs/security/FABLE_REVIEW_PACKAGE_2026-10-20.md, question Q20).

## 5. Screens (owner 2026-10-21)

- **Settings > Security > Public interface** (`#/system/security/public`, system.configure at installation scope): the retention period
  and the cap (shown to system administrators only - the route refuses others), the portal's separate sign-in queue (only while the
  tickets module is on) and the uniform-answer switch. Each value is saved through its existing route
  (`PUT /access-grants/settings`, `PUT /tickets/settings`, `PATCH /settings`); the server validates and audits. `screens/system-security-public.ts`.
- **External access > technicians waiting for approval** (the existing external-access screen, `#/wiskey/external`): the technicians
  vendors typed on the public page that nobody decided - name, vendor, the request number (text only, and only while the tickets module
  is on), how long waiting, the days left before the automatic deletion; approve (`POST .../pending-contacts/{id}/accept`) and reject
  and delete (`POST .../pending-contacts/{id}/reject`), each after a confirmation. The list is `GET /access-grants/pending-contacts`,
  answered only to whoever may decide (the same check as accept / reject: `access.external.grant` anywhere or `tickets.configure`);
  the panel is hidden when the server refuses or the list is empty. No phone number is ever sent to the screen.
- Words in he / en / ar / ru (`i18n/security-public.ts`; Arabic and Russian are an initial translation that needs a native review).

## 6. Tests

`smplwise_vms/backend/tests/test_secfix2_pub07_guard_first.py`, `test_secfix2_pub03_pending_retention.py`,
`test_secfix2_pub04_portal_start_worker.py`, `test_secfix2_unknown_person_404.py`, `test_secfix2_pub04_timing_measure.py` (opt-in),
frontend `unit-security-public.spec.ts`, `evidence-secfix2-295.spec.ts` (desktop + phone), plus the updated expectations in
`test_local_identity.py`, `test_tickets_vendor_portal.py`, `test_gate_hygiene.py`, `test_intercom_authority.py`. Results are in the
branch report (PASS / FAIL / NOT_RUN with counts).
