# CR-COMPLY108 - compliance export: who COULD enter which door, and when (security / insurance audits)

**CR number:** provisional; the lead assigns the next free CR number at integration.
**Status:** slice 1 (backend, JSON + CSV, read-only) BUILT behind a switch that is OFF by default (branch `pilot/COMPLY108-295` from
`origin/main` @ 320e55551, v2.12.4). Board item r108. No frontend, no PDF, no migration.
**Nothing here switches anything on, writes to WisKey, a station, a door or Home Assistant.** Tests use the fake WisKey only; real-WisKey
checks are NOT_RUN.

## 1. Goal

An auditor, an insurer or a security officer asks: "who was able to open door X on date D?" and "who could have entered which doors
between D1 and D2?". Today the answer needs three screens (people, groups, schedules) and guesswork. This export answers it from the
configuration, in one file, without anyone reading personal records one by one, and without ever exposing a secret.

## 2. Definitions

| Term | Meaning |
|---|---|
| **could-enter** (this CR) | The access configuration allowed a person through a station's door at that instant: person active and not archived, instant inside the person's validity, the station enabled in the person's effective door map (groups and personal allow/deny already applied by WisKey), inside the person's daily-hours schedule when one is in force, and inside the live external grant's window when the person is an external grant holder. |
| **did-enter** (NOT this CR) | A door actually opened for a person. That is the entry log (`GET /access-control/events`, `.../events/export.csv`, permission `access.events.export`). The two are complementary: could-enter is the entitlement, did-enter is the use. The file says so on its face (`notice`). |
| **point view** | `at=<instant>`: who could enter at that instant. |
| **period view** | `start`+`end` (at most 93 days): per person and station, the exact UTC intervals inside the period in which entry was possible. |
| **free passage** | A hold-open door window (`door_window_occurrences`): while a door is held open, anyone can walk in. Listed separately (`door_windows`), per station the caller may export; it is not attributed to people. |

Limit, stated honestly: the report is the configuration as read at `generated_at`. It is not a historical reconstruction (what the
configuration was last March needs the permission-change history, a later slice) and it does not prove the door hardware holds the same
configuration (`device_sync_*` flags carry WisKey's own central sync bookkeeping, never physical proof).

## 3. Data sources (all reused; nothing is re-derived)

| Fact | Source | Reused code |
|---|---|---|
| People, active / archived, validity, group ids, enabled station assignments with relays (the effective door map) | WisKey directory through the one read adapter | `intercom_adapter.ADAPTER.people / person` (the caller's station-scoped visibility, `intercom_authority.Authority`, rbac deny-overrides over the station chain) |
| Group labels and the stations each group grants | WisKey profiles | `ADAPTER.groups` |
| Daily-hours schedule in force | the person's `access_timing_policy` (only a policy is in force; a bare draft is ignored with a flag) | `ADAPTER.person` timing projection |
| Source of a station grant: personal allow / group / direct | Arx per-station decisions + the person's enabled groups | `access_station_permissions.rows_of`; an Arx record that contradicts WisKey (`deny` recorded, station still enabled) is FLAGGED (`arx_deny_recorded_but_enabled`), never silently resolved |
| External (vendor / technician) grant window and daily hours | `access_grants` + `access_person_links` (live states, provisioned only) | `access_grants.LIVE`, the join of `access_station_permissions.grant_live`, `access_grants.parse_iso / iso / zone_of` |
| Hold-open windows | the planner's own rows (holidays and calendar already applied) | `door_window_occurrences` |

**The one new evaluator:** `services/compliance_export.schedule_intervals`. No code anywhere evaluated "is this instant inside a person's
daily-hours schedule" (the grant code compares and prints schedules; WisKey enforces them). Rather than a second rules engine, it is a
small pure function over WisKey's own schedule shape (weekly weekdays or listed dates, periods, IANA zone, `24:00`), locale-free, DST
correct, with unit tests. If the schedule cannot be parsed the person stays IN the report with `schedule_unreadable` (an audit export
must not under-report).

Fail-closed direction: unreadable WisKey, a scan that stopped early or a person that vanished mid-scan refuse the export (503
`compliance_source_unavailable` / `compliance_source_incomplete`); more than 500 people or 20000 rows refuse with 413 and ask for a narrower
station / group / period. It never returns a quietly shorter list.

## 4. Output

`GET /api/v1/compliance/access/matrix` (JSON) and `.../matrix.csv` (UTF-8 with BOM, every cell quoted, CRLF, formula-safe through the shared
`csv_cell`). Query: `at` | `start`+`end`, `station_id`, `group`, `include_excluded` (also list who could NOT enter, with a closed reason:
`archived`, `inactive`, `expired`, `not_yet_valid`, `outside_schedule`, `outside_external_grant`).

Row (person x station): `person_id, display_name, employee_no (only where the caller may see it), category, station_id, station, doors,
source (personal|group|direct|external_grant), groups, schedule {enforcement, mode, timezone}, valid_from, valid_until, external_grant {id,
state}, could_enter, intervals, reason, flags`. Wrapper: `kind, at | from+to, timezone, generated_at, complete, notice, people,
door_windows, unknown` (people whose station set WisKey did not state - never shown as "no access").

CSV: one line per (person, station, interval); columns `person_id ... could_enter, interval_from_utc, interval_to_utc, reason, flags`.
PDF (a formatted audit report with the notice, scope and signature block) is a later slice.

## 5. Who may export

- Permission: `access.events.export` (the existing sensitive, station-scoped export permission; built-in holders site_admin and
  system_admin) judged **per station together with `access.people.read`** (rbac deny-overrides over the station chain). A caller sees
  rows only for stations where both hold; asking for another station answers 404 `compliance_station_not_found`.
- Gate order: permission somewhere (audited 403) -> switch `access.compliance_export` (default `off`, 404) -> interactive human session
  (a bearer-token script is refused, 403) -> one export a minute per user (429) -> range validation.
- The switch is written by a system administrator only (`PUT /compliance/access/settings`); it is excluded from backups and restores.

## 6. Audit of the export itself

Every export and every refusal writes `compliance.access_matrix.export` (allowed / denied, reason): format, kind, the asked instants,
whether a station / group filter was used, `include_excluded`, counts of people, rows, door windows and unknown. Never a name, a row,
a person id or a value. Switch changes write `settings.changed`.

## 7. Privacy

- Minimal fields: id, display name, employee number (only at the level the caller already sees), category, station, doors, source, group
  labels, validity. Never a PIN or its presence, a card number or presence, a phone, a photo, a profile value, a responsible person or a
  purpose (tested by scanning the JSON and the CSV).
- Retention of generated files: **none**. The file is built for the request, streamed, `Cache-Control: private, no-store`; Arx stores no
  copy. The audit row is the only trace and holds counts only.
- Purpose limitation: the notice states it is an entitlement report, not a record of entries.
- Default OFF; an administrator opts in.

## 8. Tests plan

Slice 1 (`tests/test_comply108_295.py`, fake WisKey, no device): evaluator units (weekly / dates / DST / `24:00` / unreadable);
permission denial for viewer, operator, scoped operator, unknown user (audited); off by default and administrator-only switch;
non-interactive refusal; rate limit; range validation; a person with a daily-hours schedule appears only inside it (point and exact
period intervals); validity clipping; expired / revoked / inactive / archived / disabled station excluded; not-yet-valid; draft and
unreadable schedules; group inheritance and personal allow labelled; Arx deny flagged; sync flag; station-scoped exporter sees only its
station; station deny removes rows; filters; external grant window; unprovisioned grant ignored; hold-open windows per visible station
(cancelled excluded); no secret in JSON or CSV; minimal field set; CSV header, BOM, formula guard, one line per interval; audit with
counts only; unreadable source refuses; size caps refuse; nothing written but the audit row and no write command to WisKey.
NOT_RUN: real WisKey, real browsers/clients opening the CSV, large-directory performance (500 people x per-person schedule read).

## 9. Slices

1. **Backend (this branch):** service + routes + tests + this record.
2. UI: an "access report" screen in Settings (date pickers, station / group filter, download), the dedicated permission
   `access.compliance.export` in the role catalogue and contract, and a Hebrew/English user-guide entry.
3. PDF report (notice, scope, generated-by, page numbers) from the same matrix.
4. Historical view: "could enter on a past date" from the permission-change history (needs WisKey/Arx change history with revisions).
5. Scheduled / emailed export (only with a retention decision and an approver - it would create stored copies).

## 10. Owner questions (recommendation first)

1. **Permission.** Reuse `access.events.export` (built, no catalogue change) or add a dedicated `access.compliance.export`?
   Recommendation: dedicated permission in slice 2 together with the UI (an insurer-facing role should not need the entry-log export);
   until then slice 1 uses the existing one.
2. **Interactive only.** Should a bearer-token script (an auditor's tooling) be able to pull the file? Recommendation: no for now (personal
   data, human at the screen); revisit with slice 5.
3. **Names in the file.** Include display names and employee numbers (auditors need to recognise people) or only ids with a separate lookup?
   Recommendation: names at the level the caller already sees them in the people screen (as built), numbers likewise.
4. **Native-mode schedule bindings.** In `native` timing mode the schedule may bind only some stations; WisKey's projection that Arx keeps
   does not expose the bindings, so the schedule is applied to every station of the person (over-reports, never under-reports, flagged by
   `schedule.enforcement`). Recommendation: accept for slice 1; add the bindings to the projection in slice 2 if the owner wants exactness.
5. **Hold-open windows.** Listed as free passage per station (not attributed to people), only while the door-windows feature has produced
   rows. Recommendation: keep separate; confirm auditors want them in the same file.
6. **Limits.** 93 days, 500 people, 20000 rows, one export a minute. Recommendation: keep; raise only with a streaming/paged design.
