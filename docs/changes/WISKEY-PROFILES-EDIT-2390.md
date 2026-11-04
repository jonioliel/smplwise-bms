# WISKEY-PROFILES-EDIT-2390 - groups and profile fields: edit, preview, apply, versions, compare, suggestions

Branch `pilot/WISKEY-PROFILES-EDIT-2390`, cut from `origin/main` @ `efc12d0e3` (v2.38.0), target 2.39.0. Plan:
`private/planning/WISKEY_FULL_INTEGRATION_PLAN_2026-11-03.md`, task T8 (matrix rows 26, 27, 31). Owner decision 03.11, Q4 "a": full editing
of groups and profile fields in Arx. Everything was built and tested against fakes and mocked backends only; nothing was sent to a real
WisKey, Home Assistant, station or installation; no lab access; no device write.

## 1. What an operator gets

A new Arx screen **"קבוצות ושדות"** at `#/wiskey/profiles` (the access-control area; the tab row marks "אנשים"; no new tab, so no
existing baseline moves). Entry: a "קבוצות ושדות" button in the native people screen's actions and in Settings > בקרת כניסה > קבוצות
ושדות (`frontend/src/components/wk-profiles-link.ts`) - rendered only after the server says this user may edit (`GET
/access-control/profiles/access`); for everyone else, and when the answer is missing, the screens are exactly what they were.

- **עריכה** (the draft): groups (name, active, the stations each one opens - stations without a managed lock cannot be added, offline ones are
  marked), profile fields (name, active, type text / select / number / date, required, unique, options, order, and the **condition**:
  "shown only when <parent field> = <value>"), and the photo switch. Saved definitions can be disabled, never removed (WisKey archives them);
  a new one can be removed before saving. Every WisKey limit is checked as you type (12 fields, 64 groups, 64-character names, 100 options of
  100 characters, no duplicate ids / options / stations, condition parent exists, no condition cycle, a select condition value is one of the
  parent's options) and blocks the preview; the server checks the same again before sending anything.
- **תצוגה מקדימה**: WisKey's own impact review (`profiles/settings_preview`): what changes (before -> after per property), the people whose
  stations change (gains / loses per person, how many personal overrides are kept - never their content), the stations WisKey will sync and
  the offline ones, each changed field's checks (people checked, missing required value, invalid value, duplicates in a unique field with
  example names, templates that no longer fit). Nothing is saved. A duplicate in a unique field blocks the save.
- **אישור ושמירה**: a dialog with the impact sentence ("גרסה 7 ← 8, N אנשים, M עמדות") and a "בדקתי את ההשפעה" check; then ONE apply.
- **The honest result**: "נשמר במערכת בקרת הכניסה", the readback ("נקרא בחזרה: גרסה 8 היא הגרסה שאושרה" - or a warning that the served
  version differs), how many people's access changed, and "נשלחה בקשת סנכרון ל־M עמדות. העדכון בעמדות עצמן לא אומת". A refusal says "לא
  נשמר" with the reason. No clear answer says "לא ידוע אם נשמר" and offers only **"בדוק מה קרה"** (a readback) - never a resend.
- **גרסאות**: WisKey's retained history (50 versions; when, which kind of change, how many fields / groups; never who), **השוואה לנוכחית**
  (WisKey's compare rows), and **טען כטיוטת שחזור** - a rollback DRAFT loaded into the editor with notes of what cannot be exact; it then goes
  through the same preview -> confirm -> apply.
- **הצעות קבוצה**: pick a person, choose up to three of their field values, see WisKey's read-only group suggestions (how many similar people
  are members, which doors would open). Assignment itself stays in the person editor. The person's own values are shown only to a holder of
  `access.people.sensitive` at installation scope.

## 2. WisKey commands (checked in `C:\hik intercom` @ `origin/codex/wiskey-mac-m12-policy-b-2026-11-02` = `2834aa5e`, rc.10; the static
## rc.10 extract on `pilot/WISKEY-RC10-PIN-2382` and the pinned catalog `rc37-contract.4` agree on every key)

| Command | Frame keys | Catalog class / WisKey grant | Channel | rc.10 source | Arx use |
|---|---|---|---|---|---|
| `profiles/settings_get` | - | READ, `management: view` | `read` (existing) | `websocket.py:1563-1567`, `profile_settings.py public()` | the editor's policy, the readback |
| `profiles/versions` | `offset`, `limit` (1..50) | READ, administrator / bridge only | `read` (existing) | `websocket.py:1547-1561`, `access/policy_versions.py listing()` | versions list |
| `profiles/versions_compare` | `before_revision`, `after_revision` | READ, administrator / bridge only | `profiles` (new) | `policy_versions.py compare()` | compare, rollback draft |
| `profiles/settings_preview` | `revision`, `values`, `api_contract` | non-READ, `management: manage` | `profiles` (new) | `admin_operations_api.py:32`, `access/policy_operations.py preview()` | the impact review (300 s operation id, `device_writes: 0`) |
| `profiles/settings_apply` | `operation_id`, `api_contract` | non-READ, `management: manage` | `profiles` (new) | `policy_operations.py apply()`, `repository.async_profile_settings` | the save (receipt; WisKey queues the stations' sync) |
| `users/group_suggestions` | `user_id`, `field_ids` (0..3) | READ, `users: view` (+ access / profile field rights) | `profiles` (new) | `websocket.py:1356`, `access/group_suggestions.py` | suggestions |
| `profiles/settings_update` | `revision`, `values` | non-READ, `management: manage` | **none - never sent** | `websocket.py:1569-1593` | see below |

`profiles/settings_update` is WisKey's direct save WITHOUT the impact review (it only refuses `profile_review_required` when a definition with
people changes). The reviewed `settings_preview` -> `settings_apply` pair does everything it does (same normalisation, same revision check,
same "never remove a definition" rule, and WisKey keeps the templates and older clients' omitted keys the same way), records the change as
`bulk/group_policy` with a durable receipt, and is idempotent per operation id. So every Arx write of the policy is a reviewed one, and
`settings_update` is on no channel (a test proves no guard lets it through).

**Channel**: the add-on's own live WisKey session, a new closed allow-list `profiles` in `services/wiskey_channels.py` with exactly the four
commands above (`settings_get` / `versions` stay on the existing READ channel). The apply runs in the people-write (`config`) lane: one slot,
its own rate buckets, never queued, never retried.

**WisKey's operation id never reaches the browser.** All Arx users share one WisKey identity, so WisKey's own "same actor" rule cannot tell them
apart: Arx keeps the operation id in a short-lived review of its own (`services/wiskey_profiles.Reviews`), bound to the Arx user who asked for
the preview, expiring 10 s before WisKey's 300 s. A review is applied at most once; the same confirmation again answers the stored result
without sending.

## 3. Rules kept

- **Permission**: `access.people.manage` at **installation scope** (unrestricted: allowed at the installation and no deny of it on any site,
  building or station - the policy is installation-wide and a group can grant any station). Checked first on every endpoint (audited 403 for
  a station-scoped holder, a holder with a deny somewhere, an operator). Built-in holders: `site_admin`, `system_admin`. `access.groups.manage`
  (catalogued in CR-036 S3 for exactly this, held only by `system_admin`) is NOT required - see owner question 1.
- **Draft checked before sending** (WisKey's own limits, a removed definition, an unmanaged lock on a newly granted station, a stale base
  revision): 422 / 409 with every problem's path, audited as `not_sent`, nothing sent.
- **Confirmation + envelope**: `confirmed: true` (only the dialog sends it), `client_request_id` + `expires_at` (15 s); expired, duplicate or
  unconfirmed -> refused, audited, not sent.
- **Audit** (no secrets): `intercom.profiles_preview` (review id, base revision, counts), `intercom.profiles_apply` (refusal row, or attempt row
  committed BEFORE sending with the actor, base revision, the diff **before -> after per property** of every changed field / group and the
  impact counts, then the outcome row with WisKey's code or the receipt summary and the readback), `intercom.profiles_check` (the verdict).
  Never a person's field value, a template value, a credential, a host, an HA user id or WisKey's operation id (tests assert each).
- **Honest results**: `saved` + `readback.matches` (the policy WisKey serves now is exactly the confirmed one, one revision on) +
  `sync: requested` + `physical_result: not_verified`. WisKey refusals before saving (`bulk_review_expired`, `bulk_review_stale`,
  `revision_conflict`, `profile_value_not_unique`, `operation_not_found`, ...) -> 409 with `details.outcome = refused` and WisKey's code; the
  review is dead and is never sent again. Any other failure of the apply (a storage error, a timeout, an unclear frame) -> 504
  `profiles_outcome_unknown`; the review is blocked until `POST /reviews/{id}/check` reads back: `applied`, `not_applied` (the review may be
  applied again - with the SAME operation id, which WisKey treats idempotently) or `changed_elsewhere` (dead).
- **Stale / conflict**: the draft carries the revision it was based on; Arx refuses before sending when WisKey's current revision differs
  (409 `profiles_revision_conflict`, with the current revision), and WisKey's own `revision_conflict` / `bulk_review_stale` are mapped too.
- **Feature discovery**: each part (view / edit / versions / compare / suggestions) is offered only when WisKey's `overview.api.commands`
  lists its commands; otherwise the part says "not available in the installed version" and nothing is sent.
- **No WisKey / Home Assistant text** in the screen (unit test over every string; the browser spec checks the rendered text).

## 4. Rollback to a previous version

WisKey offers no "restore version" command and no read of an old version's VALUES (`profiles/versions` is metadata only). Arx builds a
rollback **draft** from `versions_compare(N, current)` (`GET /access-control/profiles/versions/{N}/draft`; nothing is written) and the operator
sends it through the normal preview -> confirm -> apply. Exact for every property WisKey versions (field: label, enabled, type, required,
unique, options, condition; group: label, enabled, stations - a group that had no station list gets an empty one). Not exact, and said in the
draft's notes: a definition added after N cannot be removed and is **disabled** instead; the photo switch and the templates are not in
WisKey's version diff and stay as they are.

## 5. Row 31: conditional profile fields and photo crop

- **Conditional fields - mirrored (definition side).** WisKey exposes `depends_on = {field_id, value}` on each field
  (`profile_conditions.py`); the editor sets and clears it (parent picker without the field itself or its descendants, the value from the
  parent's options for a select parent) with WisKey's cycle / parent rules. Evaluating the condition while editing a PERSON (hide the field,
  required only while it applies) belongs to the person editor (T9, `pilot/WISKEY-PEOPLE-COMPLETE-2390`) - not done here.
- **Photo crop - gap.** `local_photo_crop` is a client-side capability of WisKey's own panel (no command; WisKey accepts only the final JPEG,
  at most 512x512 / 32 KB, `profile_settings.photo_value`). Nothing to mirror on the policy side; the person photo is T9's.

## 6. WisKey gaps (to raise with WisKey)

1. No restore-version command and no read of an old version's values; `photo_enabled` and templates are not versioned (section 4).
2. `profiles/versions` and `versions_compare` are administrator / bridge only in WisKey: they work only while Arx's service identity is a
   WisKey administrator (as the existing Settings history read already assumes).
3. `settings_preview` / `settings_apply` are non-READ: WisKey's panel security guard applies to them; if the owner turns on WisKey's panel
   re-authentication, the service identity's preview / apply is refused (`reauth_required`, shown as such). Plan Q-WK-11 asks WisKey to
   confirm `profiles/settings_apply` for Arx's service identity over the classic channel - still open.
4. The preview's operation id is bound to WisKey's actor only; Arx adds the per-user binding (section 2).
5. `local_photo_crop` has no server contract (section 5).
6. `overview.api.capabilities` (e.g. `conditional_profile_fields`) is not kept by Arx's feed projection (`intercom_adapter.project_api`), so
   Arx decides by command presence, not by capability flags (a shared-module change was avoided on purpose).

## 7. Files

New: `smplwise_vms/backend/smplwise/services/wiskey_profiles.py`, `.../routers/access_control_profiles.py`,
`smplwise_vms/backend/tests/test_wiskey_profiles.py`, `frontend/src/api/access-profiles.ts`, `frontend/src/access-control/profiles-logic.ts`,
`frontend/src/i18n/wiskey-profiles.ts`, `frontend/src/screens/wiskey-profiles.ts`, `frontend/src/components/wk-profiles-link.ts`,
`frontend/tests/unit-wiskey-profiles.spec.ts`, `frontend/tests/evidence-wiskey-profiles.spec.ts`, `frontend/tests/wiskey-profiles-mocks.ts`.

Shared edits (minimal, one line or one block each):
- `services/wiskey_channels.py`: the `profiles` allow-list (+ ALLOWLISTS, ADAPTER_CHANNELS, HA_FRAMES, describe). **Conflicts textually with
  `pilot/WISKEY-STATION-OPS-2390`** (its `maintenance` channel on the same lines) - resolve by keeping both entries.
- `main.py`: one `include_router` block after `access_control_writes`.
- `tests/test_wiskey_channels.py` (two tuples), `tests/test_pwclean_295.py` (exclude `profiles` from the pre-cleanup catalog) - the same lines
  station-ops edits; keep both names.
- `frontend/src/shell/sw-app.ts` (one route line), `shell/lazy-screens.ts` (one lazy entry), `shell/nav.ts` (one line: `profiles` marks the
  people tab), `screens/wiskey-people.ts` (an import + one actions-slot line - T9 also edits this file), `screens/system-access-groups.ts`
  (an import + the link in the groups card header).
- `frontend/tests/access-control-mocks.ts`: answers `access-control/profiles/access` with `can_edit: false` before recording, so the existing
  access-control specs keep their exact read lists and baselines.

Deep links (T18, `pilot/WISKEY-DEEPLINKS-2382`): not merged into main at branch time, so nothing was registered. To register: capability
rows 26 / 27 -> native route `#/wiskey/profiles` (Arx-native, no embed tab needed).

Migration: none (reviews are in process memory; audit rows use the existing table).

## 8. Tests

- Backend, fake WisKey with rc.10's policy behaviour (stateful): `tests/test_wiskey_profiles.py` - the channel, the gate (four personas),
  view, unsupported part, preview (frames, impact, operation id hidden, sensitive level), every draft refusal, a condition, stale revision
  (Arx and WisKey), apply (once, audit before / after, readback, repeat answered without sending), another user's / unknown / expired review,
  WisKey refusals (stale, expired, conflict), unique duplicates, unknown -> check applied / not applied (resent with the same operation id) /
  changed elsewhere, versions without the actor, compare + unknown version, rollback draft (+ applied through preview / apply), already
  current, suggestions (values by level, not found, unusable field, too many fields), pure helpers.
- Unit (node): `tests/unit-wiskey-profiles.spec.ts`.
- Browser (runner, desktop + mobile, mocked backend): `tests/evidence-wiskey-profiles.spec.ts`; evidence images in
  `docs/design/evidence/wiskey-profiles/`.

Results (2026-11-03): backend `test_wiskey_profiles.py` 35 passed (workstation); runner backend (`test_wiskey_profiles`, `test_wiskey_channels`,
`test_pwclean_295`, `test_wiskey_contract`, `test_wiskey_diagnostics`) 149 passed, 2 skipped @ 62c142ad6; runner unit suite (`tests/unit-*`, node)
3774 passed @ bc5cadfd4; runner evidence spec desktop + mobile 22 passed @ bc5cadfd4; regression sample on the runner @ 62c142ad6:
`evidence-access-status.spec.ts` + `pixel-wiskey-people.spec.ts` desktop + mobile passed (the entry link stays hidden there, baselines unchanged).
NOT_RUN: tablet project, the full backend suite, the full Playwright matrix, any live / lab test.

## 9. Owner questions

1. Permission for editing groups and fields: a) `access.people.manage` at installation scope (built: site and system administrators);
   b) also require `access.groups.manage` (system administrator only, unless given by a custom role).
2. Rollback of a definition added after the target version: a) disable it (built); b) refuse the rollback draft.
