# CR-BULKPEOPLE-295 - bulk edit and CSV import / export of access-control people (Arx side)

Status: BUILT ON FAKES (pilot/BULKPEOPLE-295, from integ/293). Not live: the bulk WRITE path refuses every call while the owner's
separate go-live permit is not in the build (`services/bulk_people.GO_LIVE_PERMITTED = False`), and the feature switch
`access.bulk_people` is `off` by default. Activation on real people / doors stays the owner's separate act.

Backlog item: `wiskey-bulk-people-csv` (private/planning/BACKLOG_RECONCILED_2026-10-20.md, was BLOCKED on "WisKey bulk/import commands
or WisKey recommendation"). Owner directive 2026-10-20: WisKey-related development is allowed with no scope restriction.

## 1. Sources followed

- WisKey's own design note for `people_csv` (reply 6 / reply 8 drafts, private/planning/wiskey_reply6_answer_2026-10-19 and
  wiskey_reply8_answer_2026-10-19): values `preview_ref, ownership_policy_ref, revision_policy_ref`; per-row ownership / revision
  checks, redacted preview / diff, conflict policy, bounded partial results and an explicit apply; preview never mutates; no PIN /
  card secret export; no name / phone auto-match; no uncontrolled replacement; no invented Arx ownership; native single-person
  receipts do not silently replace a bulk receipt / partial-result policy.
- No mockup existed for this screen; no earlier Arx spec (grep of docs/ and private/planning for bulk / CSV / ייבוא / WISKEY found only
  the WisKey notes above and the backlog line).
- Patterns reused: S11 people writes (services/intercom_writes.py: the station-scope gate, sensitive field level, revision
  compare-and-set, effect classes, "unknown is never success, never retried"), the access engine port with a refused live
  implementation (services/access_grant_engine.py), the GRANTSMIN-295 export (one per minute, row count only in the audit, UTF-8 BOM,
  every cell quoted, formula guard, phone at most masked `····NN`).

## 2. What exists (Arx side)

Routes under `/api/v1/access-control/bulk-people` (routers/bulk_people.py):

| Route | Who | What |
|---|---|---|
| GET `/settings` | `access.people.read` or `.manage` anywhere | switch state, go-live permit flag, limits |
| PUT `/settings` | system administrator | `enabled: off|on` (audited) |
| GET `/template.csv` | `access.people.manage` anywhere | header row only |
| GET `/export.csv` | `access.people.read` anywhere | the people the caller may see (projection filter), one per minute per user, at most 5,000 rows (413 above), audit = row count + column names only |
| POST `/jobs` (CSV body, `Idempotency-Key`) | `access.people.manage` anywhere | upload + parse + per-row validation report (nothing sent) |
| POST `/jobs/edit` (JSON, `Idempotency-Key`) | `access.people.manage` anywhere | bulk edit: validity window, doors add/remove, groups add/remove, activate / deactivate for up to 500 selected people |
| GET `/jobs/{id}` | the job's creator or a system administrator | state, per-row report (codes and field NAMES, no values), progress |
| POST `/jobs/{id}/dry-run` | the creator or a system administrator | diff against a fresh directory read at the CALLER's field level; stores the plan digest; never writes |
| POST `/jobs/{id}/confirm` | system administrator, interactive session | `{plan_digest, confirm: "<number of rows to write>"}` - binds the confirmation to the exact plan shown; dry-run must be at most 15 minutes old |
| POST `/jobs/{id}/apply` | the confirmer only | applies the NEXT bounded batch (25 rows) through the engine; resumable; answers progress |
| POST `/jobs/{id}/cancel` | the creator or a system administrator | stops a job; purges its row data |

Pipeline states: `staged -> previewed -> confirmed -> applying -> (paused) -> done | cancelled | expired`.

## 3. CSV format

UTF-8 (a BOM is accepted), comma separated, header row of canonical column ids (English / Hebrew labels accepted as aliases):
`person_id, revision, employee_no, display_name, phone, access_category, responsible_person, access_purpose, active, valid_from,
valid_until, doors, groups`.

- `person_id` empty = create a person; set = update exactly that WisKey person. Rows are NEVER matched by name, phone or
  employee number (WisKey: no auto-match).
- `revision` (from the export) = the revision the editor saw; if WisKey's current revision differs, the row is a
  `revision_conflict` and nothing is sent for it.
- An empty cell = unchanged. `doors` = the complete set of enabled stations with relays, `st-a:1+2; st-b:1`; `-` = no personal
  station. `groups` = the complete set of group ids separated by `;`; `-` = none.
- `phone` cells exported as `····NN` (masked) are read as "unchanged".
- `valid_from` / `valid_until` go together: ISO 8601 with a zone, or a date `YYYY-MM-DD` (start / end of that day in the installation zone).
- **No PIN, card or photo column exists.** A file with a header that names a PIN, a card, a code or a photo is refused as a whole
  (`bulk_secret_column`), before any row is parsed; the bytes are not stored.

Limits: file 512 KiB, 2,000 data rows, 13 columns, 256 characters per cell, bulk edit 500 people, 25 writes per apply call,
one export per minute per user, 5,000 exported rows, jobs expire after 24 hours.

## 4. Threat model

| # | Threat | Control |
|---|---|---|
| T1 | A restricted operator imports rows that touch people / stations outside their chain | every row passes the S11 gate (`intercom_writes.check_person` / `gate_create`): `access.people.manage` on every station of the person before AND after the change (assignments, overrides, the stations of named groups), the sensitive level for phone / responsible / purpose; checked at dry-run AND again, against a fresh read, at apply with the confirmer's authority |
| T2 | Existence oracle through row errors | a person the caller cannot see answers exactly like a missing one (`not_found`); employee-number clashes are reported only against people the caller sees |
| T3 | Stale file overwrites newer edits (lost update) | `revision` column + fresh read at apply; WisKey's own compare-and-set on `users/update`; mismatch = `revision_conflict`, nothing sent |
| T4 | Mass destructive change by mistake or by a stolen session | staged pipeline; dry-run never writes; confirm by a system administrator in an interactive session (no bearer token), typed row count, bound to the plan digest (a changed plan needs a new confirm); feature switch off by default; go-live permit constant False |
| T5 | Replay / double submit | `Idempotency-Key` per creator: same key + same content returns the same job; same key + other content 409; apply claims the job with a lease (no two appliers); a row already `ok` is never written again; an `unknown` row is never re-sent (needs a fresh check - the S11 rule) |
| T6 | Credential leakage through files | no PIN / card column at all (import refuses the file, export has none); PIN generation is not part of bulk |
| T7 | CSV / formula injection when the export is opened in a spreadsheet | every exported cell through the shared formula guard (leading apostrophe); import strips only the guard apostrophe and refuses other formula-like text cells (`formula_like`) |
| T8 | PII in logs / audit | audit rows carry job id, counts, row indexes, field NAMES and error codes only - never a name, phone, employee number or WisKey value; logs name exception types only |
| T9 | PII at rest in the staging table | only the normalized rows needed to apply are kept; purged (set NULL) when the job ends, is cancelled or expires (24 h); the uploaded bytes are never stored (only their SHA-256) |
| T10 | Resource exhaustion | size / row / cell / column caps checked before parsing completes; bounded batches; one export a minute |
| T11 | Phone over-exposure in export | below `access.people.sensitive` on every station of the person: empty; at that level: masked `····NN` (the GRANTSMIN-295 rule); never the full number |
| T12 | Accidental live writes during development | engine port; the live engine refuses writes without the permit; tests use `FakeBulkEngine` only |

## 5. Open items (owner)

1. Who may confirm: built as system administrator only (safest). Option: allow a site administrator for their own stations.
2. Live adapter (`WiskeyBulkEngine`) is NOT_RUN against any WisKey; WisKey has no bulk command, so Arx writes row by row through the
   existing `users/create` / `users/update` (config lane, never queued, never retried). WisKey may want a bulk receipt (their note).
3. Migration number 0131 is PROVISIONAL (renumber at integration).
4. Arabic / Russian texts are an initial translation (native review needed).
