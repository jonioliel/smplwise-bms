# SECFIX2-295: public-surface hardening - what changed and the switches waiting for the owner

Branch `pilot/SECFIX2-295` (from `pilot/SECFIX-293` + `integ/293`). Source findings: `private/planning/SECURITY_REVIEW_PUBLIC_2026-10-20.md`
(PUB-03, PUB-04, PUB-07) and the open item of the 2.9.3 release report (a restricted writer gets 403 instead of 404 for a malformed WisKey
person record of a person he cannot see). Every new behaviour that a user could notice ships OFF; the default is today's behaviour.

## 1. Summary

| Item | What changed | Default | Owner decision |
|---|---|---|---|
| PUB-07 | The local-identity and passkey **public** routes run their guard (remote channel only, the switch, https, login CSRF) before the request body is read or validated. A malformed body on the local channel is now the same 404 as a well-formed one; on the remote channel a switch / CSRF / transport refusal comes before any 422. | Always on (no switch) | None. Strictly safer and invisible to users: the remote sign-in page's answers are unchanged (a malformed body behind a passed guard is still the same 422). |
| PUB-03 | Retention of technicians a vendor typed on the arrival page that nobody accepted or rejected (option A of the proposal), plus a per-vendor cap of undecided technicians. | OFF (`0` / `0`) | Choose the period and the cap (section 2). |
| PUB-04 | Vendor portal `start`: the number-dependent work can run on the public listener's own worker thread (option A of the proposal). | OFF (`false`) | Measure first, then decide (section 3). |
| Unknown person 404 | A restricted writer who cannot see a person whose WisKey record is malformed / incomplete can get the uniform 404 instead of the 403. | OFF (`false` = today's 403) | Choose 404 or keep 403 (section 4). |

## 2. PUB-03 - undecided vendor-typed technicians (privacy)

- Settings (system administrator, `PUT /api/v1/access-grants/settings`; never exported in or restored from a project backup):
  - `pending_retention_days` (`access.external.pending_retention_days`): `0` = off; otherwise 7-365 days.
  - `pending_max_per_vendor` (`access.external.pending_max_per_vendor`): `0` = no cap; otherwise 1-100.
- With a period set, once an hour the janitor erases every undecided row older than the period exactly like the manager's "reject and
  delete": the name becomes the tombstone, the phone number and its keyed index are cleared, the open request for him ends (`refused`).
  It never touches a row that was accepted or rejected, a person linked to a door-system record, or a person with a decided grant. One
  audit row per run with counts only (`access.pending_contact.expired`).
- With a cap set, the arrival page refuses the next typed technician of that vendor with the existing "too many" answer (429); naming one
  of the vendor's existing persons is never capped; decided rows do not count.
- The needs-review report already lists an undecided technician from day 30, so a manager sees a real request well before any erase.
- **Recommendation:** period 90 days (option A), cap 10.

## 3. PUB-04 - vendor portal sign-in timing (residual, Low)

- Setting: `tickets.settings` -> `vendor_portal.start_worker` (system.configure; boolean).
- Off (today): the answer (identical 202 for every number) is sent, then the lookup runs as a background task inside the same request,
  so the connection stays busy a few milliseconds longer for a known number. The CR already accepts this residual.
- On: the request only queues the job (a bounded queue of 64; a full queue drops the job silently and counts it, the answer stays the
  same 202) and one worker thread of the public listener does the work. The request ends at once and identically for every number.
- Visible difference when on: none for a vendor in normal use. Under a flood (more than 64 sign-in requests waiting) some codes are not
  sent; the vendor asks again.
- **Recommendation:** run the measurement in the proposal (step zero) on the runner first; turn it on only if a difference is measurable
  above the noise.

## 4. Unknown person record: 404 instead of 403

- Setting: `access.unknown_person_uniform_404` (`PATCH /api/v1/settings`, system.configure; `true` / `false`).
- Off (today): a writer limited to some stations gets 403 "the person is linked to a station you do not manage" for a person whose WisKey
  record is malformed, even when he cannot see that person - he learns that the id exists.
- On: such a writer gets exactly the answer of an id WisKey does not know (404). A caller who can see the person (unrestricted read or
  manage) still gets the 403 with its reason. An unrestricted writer is unaffected.
- Visible difference when on: a restricted operator who tries to change a person of his own station whose WisKey record is malformed sees
  "not found" instead of the 403 - consistent with the people list, which already hides such a record from him.
- **Recommendation:** on (it removes the oracle and agrees with the read side).

## 5. Tests

`smplwise_vms/backend/tests/test_secfix2_pub07_guard_first.py`, `test_secfix2_pub03_pending_retention.py`,
`test_secfix2_pub04_portal_start_worker.py`, `test_secfix2_unknown_person_404.py`, plus the updated expectations in
`test_local_identity.py`, `test_tickets_vendor_portal.py`, `test_gate_hygiene.py`, `test_intercom_authority.py`. Results are in the
branch report (PASS / FAIL / NOT_RUN with counts).
