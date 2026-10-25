# WKR5ADOPT-295 - adopt WisKey `features/people_csv_preview` (Arx item W-006)

Branch `pilot/WKR5ADOPT-295`, cut from `origin/release/2190` @ `e476e48ae` (2.19.0 candidate). The earlier branch `origin/pilot/WKR5-295` (`dc89c339a`,
cut from release/2170W) merged cleanly into it first (merge commit `3734bff93`): its catalog reader, discovery, lineage administration, original receipt
readers, WhatsApp v2 and emergency v2 work still applies and is reused unchanged. Its documented BLOCKED item "RowGrant / people_csv" is what this branch
answers.

Everything below ran against FAKES only. Nothing ran against a real WisKey, Home Assistant, station, go2rtc, door or the Ubuntu runner. Nothing is installed or
live. No migration was added. The default is OFF.

## Source read as data
- Mac `final/delivery/PEOPLE_CSV_PREVIEW_V1.json` (command contract, response and row field names, client recipe, authority, invalidation, private input rule).
- Mac `final/source/tests/ha/test_owner_continuation_people_csv.py` (the producer's own test: the exact request/snapshot shape, `mode: "create"`, `column_map`,
  `source_line` = file line, the returned `start` = `{request, policy_snapshot}`, tamper / stale-stamp / expiry cases).
- Mac `final/delivery/command_catalog/COMMAND_CATALOG.jsonl` (the row is registered, `transport_mode: native_bridge`, discovered for the native owner),
  `STATUS_BY_ITEM.json` item "P1 people_csv" (producer complete; installation NOT_PERFORMED; live NOT_MEASURED),
  Arx reply row W-006 in `arx-all-open-reply/ALL_OPEN_RECONCILED.json`.

## What was built
Service `smplwise/services/wiskey_people_csv.py`
- the switch `access.people_csv_preview` (default `off`) and the owner-set binding `access.people_csv_binding` (absent = blocked); both are excluded from backup restore;
- a CLOSED reader of the preview answer (exact key sets, ascending unique lines, `grants.permission == people/write`, returned `start.request` equals the request sent,
  snapshot rows count equals preview rows, expiry in the future); anything else is `invalid_response` / unknown and nothing is started from it;
- `request_preview`: builds the ordinary `people_csv` FeatureRequest + closed policy snapshot (rows `[]`, `private_input = {kind, content, mode, column_map}`) through
  the existing `FeatureAdapters.prepare` (a new `allow_empty_rows` flag, only for this preview) and calls `features/people_csv_preview` on the direct port. A READ: no intent is stored;
- `start`: `DirectFeatureClient.start` with the fresh preview's `start` unchanged = the existing durable intent log (`wiskey_feature_intents`: committed BEFORE the first byte,
  one attempt per request id, no replay); `read_result`: the original `features/result` read, projected to state + `saved` count; missing / error = `unknown`;
- the CSV text is held only in process memory (32 entries, 15 minutes), never in the database, a log, an audit row or a response; Arx never computes a stamp, a digest or a row
  origin, and never sees `fingerprint_key`.

`DirectJoin.people_csv_or_none()` returns the adapters only while BOTH `features/people_csv_preview` and `features/start` are listed by the current connection's
`direct/capabilities` (and `direct/time` admits the signing window) - the existing per-command selection rule.

Routes (bulk-people router, prefix `/api/v1/access-control/bulk-people`; API_INVENTORY not regenerated):
| Route | Who | What |
|---|---|---|
| PUT `/wiskey-csv/settings` | system administrator | `{enabled: off\|on}`, audited |
| GET `/settings` (existing) | people read/manage | gains `wiskey_csv: {enabled, available, blockers[], mode, fields[]}` |
| POST `/jobs/{id}/wiskey-preview` | `access.people.manage` anywhere, interactive session | the SAME file again (its SHA-256 must equal the job's); WisKey's preview; nothing written |
| POST `/jobs/{id}/wiskey-confirm` | system administrator, interactive | `{preview_digest, confirm: "<number of lines>"}`; fresh preview, compare, `features/start` |
| GET `/jobs/{id}/wiskey-result` | `access.people.manage` anywhere (job creator or administrator) | the original completion read |

Why the confirm takes a FRESH preview: the preview's own `start` request has Arx's wire window (<= 15 s) while a person reviews for minutes, and the start must be passed on
unchanged. Arx therefore never sends the displayed `start`. At confirm it asks again for the same file, requires the same lines, persons, revisions, `change_digest`s and both stamps
as the displayed preview (`preview_changed` otherwise, nothing sent), and passes the FRESH `start` on unchanged. A second start for the same job is refused from the durable intent
log (`csv_already_started`), also after a restart; only an attempt settled `refused` / `not_sent` frees the job.

Client (frontend)
- `api/bulk-people.ts` (typed calls), `access-control/people-csv-verify-logic.ts` (pure logic), words `v_*` in `i18n/bulk-people.ts` (he, en, ar, ru; ar/ru stay dev-marked like the rest),
  `screens/wiskey-bulk-people.ts` (the import dialog): with the switch ON the "report" step offers "Verify file" instead of the local dry-run; then lines + operations + counts +
  expiry as chips, long lists page (8 per page, no inner scrolling), the typed-count confirm (system administrator only, the server enforces it), the result line with a
  "Check result" button; an unknown result is never shown as success and never polled. With the switch OFF nothing changes for the operator. Logical CSS only (RTL-safe), no paragraphs.

Interpretation to confirm with the owner: the existing per-row apply of the bulk-people job (`/jobs/{id}/dry-run|confirm|apply`, the engine port -> native people writes) is untouched and stays the
flag-OFF path. The flag-ON path writes through WisKey's atomic `features/start` as Mac's recipe says, through the existing feature intent log. Both are explicit-confirm, administrator-only, interactive-only.

## NOT_IDENTIFIED / needed from Mac (the flag stays OFF until answered)
1. `schema` value of the answer (accepted as any 1..128 char string).
2. `mode` vocabulary beyond `create`. Arx previews only files whose every row is a create (no `person_id`); a file with updates is refused `csv_mode_not_identified`.
3. WisKey field names behind `column_map` beyond `employee_no` and `display_name` (Arx maps `phone`, `access_category`, `responsible_person`, `access_purpose` under its own canonical names - unverified).
   Columns outside that list (`doors`, `groups`, `valid_*`, `active`, `revision`, `person_id`) refuse the whole file `csv_columns_not_identified`, names only.
4. Which `authority_ref`, `authority_revision`, `scope_ref`, `source_epoch` WisKey checks for the Arx service subject: Arx invents none; the owner sets the JSON binding
   `access.people_csv_binding` (no UI for it; absent = blocker `binding_not_configured`).
5. The meaning/values of `preview_ref`, `ownership_policy_ref`, `revision_policy_ref` (Arx sends `csv-<sha256[:40]>`, `arx-explicit-person-id`, `arx-revision-compare-and-set`).
6. Whether the preview's `start` may be sent long after the preview (the contract text only states request/policy expiry are checked after awaits); Arx does not rely on it (fresh preview at confirm).
7. Whether two previews of an unchanged repository return identical `review_stamp`, `rules_stamp` and per-line `change_digest` (Arx compares them; origin refs, grant ids and the review token are NOT compared). If WisKey's digests are per-preview, `preview_changed` would always trigger.
8. The receipt shape beyond `state` and `saved` (Arx shows only a non-negative integer `saved`).
9. `source_line` semantics for multi-line quoted cells (Arx shows WisKey's line as given and does not map it to its own row numbers).
10. Installation / live: the target must list `features/people_csv_preview` in `direct/capabilities`; NOT_PERFORMED, NOT_MEASURED.

## Not done
Full suite, runner gate, Playwright browser specs, build of www, anything against a real WisKey / HA / station / door, S7 / S8, installation, activation of the switch.
