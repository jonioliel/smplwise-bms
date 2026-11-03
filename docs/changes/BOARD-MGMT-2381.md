# BOARD-MGMT-2381 - notice board management: copy / replace link, manual re-send, editor default

Branch `pilot/BOARD-MGMT-2381` from `origin/main` = v2.38.0 (`efc12d0e3`). Target: 2.38.1. Source: the owner's answers of 03.11 afternoon
(round 15, questions 5, 6 and 7) in `private/planning/OWNER_ANSWERS_2026-10-30_NIGHT_HE.md`; background in
`private/planning/NEXT_PHASE_DISPLAY_MOBILE_PLAN_2026-11-02.md` (work package D3, the three board-admin items). No migration, no version bump.

## 1. Question 5 - "העתק קישור" never replaces the link (answer A)

**What was there.** The server already had both routes: `GET /notices/boards/{id}/link` reads the stored (AEAD-sealed) token back and changes
nothing (NOTICEPERM-295), and `POST /notices/boards/{id}/rotate-token` replaces it (audited `notices.board.rotate`). The fault was in the
screen: on a board without a stored copy (saved before NOTICEPERM-295, hash only) "העתקת קישור" opened a dialog titled "העתקת הקישור" with
"הנפקה והעתקה" that called `rotate-token` - so "copy" disconnected the paired TV. The texts also still said the link is "shown once".

**Now** (`frontend/src/screens/system-notices.ts`, `frontend/src/i18n/notices.ts`; no backend change):
- "העתק קישור" (table row and board header) reads the stored link and copies it; no other call, the board is untouched, a paired TV stays on.
- "החלף קישור" is its own button (board header and the address panel), behind the owner's confirmation: heading `החלפת הקישור של "<name>"`,
  body `טלוויזיות שמחוברות בקישור הנוכחי יתנתקו. להחליף?`, a danger button "החלף קישור". Only that button calls `rotate-token`.
- A board without a stored copy: "העתק קישור" cannot copy (there is nothing to read). It opens the same replace confirmation with one more line
  saying why ("נוצר לפני שהמערכת שמרה עותק שלו..."); nothing is replaced unless the user presses "החלף קישור".
- Texts: the link dialog says "the board's permanent link" after a copy and "replaced; TVs on the previous link disconnected" after a replace;
  the address panel hint no longer says the link is shown once, and the "קישור חדש" date label reads "תאריך הקישור".
- Permissions unchanged: copy = `system.configure` + `notices.boards` (the button) and `notices.boards` (the route); replace = `notices.boards`.
- Audit unchanged and covered by tests: `notices.board.link_read` per copy (no value), `notices.board.rotate` per replace (no value).

## 2. Question 6 - manual "שלח שוב" (answer A)

**What was there.** No re-send at all: publishing pushed once (NOTICEPUSH-295) and "editing a published notice never pushes again".
`notices.push_generation` existed (migration 0165) but nothing moved it.

**Now:**
- `POST /api/v1/notices/{id}/resend` (`routers/notices.py`, `services/notices/push.py::resend`). Needs what an explicit push tick needs:
  `notices.manage` on the notice's audience (the same `_managed` check as edit) **and** `notices.push` (403, audited `notices.push` denied).
  Only a published notice that is still on (active or scheduled), else 409 `not_live`. A notice with no recipients (TV only, or an audience
  nobody is in) is refused with 409 `no_recipients` and writes nothing. At most once a minute per notice (429 `resend_too_soon`,
  `details.retry_after_s`), counted from the current generation's notification.
- The send: the notice as it is now goes out under the next dedupe key `notice:<id>:<generation+1>`; only when the pipeline took it is the
  previous open notification resolved (`superseded`) and the generation stored, so the inbox keeps one current copy; a failing pipeline
  changes nothing (answer 200 with `sent: false, error: emit_failed`). Archive / delete / the janitor resolve the current generation as before.
- Audit: `notices.resend` per send (allowed when sent, denied when the pipeline failed), details = recipients, sent, generation - no content.
- The notice answer for managers carries `push_generation` (how many re-sends).
- Never automatic: `PATCH` of a published notice still sends nothing (existing test kept, a new one added).
- UI: ראשי › לוח הודעות - a row action "שלח שוב" on a live published notice with recipients for a writer with the push right; it asks once
  ("לשלוח שוב את ...?", the recipient count from the audience preview) and reports "ההודעה נשלחה שוב ל־N נמענים". The compose dialog of a
  published notice: plain "שמירה" says `נשמר. ההודעה לא נשלחה שוב; לשליחה לנמענים: "שלח שוב".`, and a "שמירה ושליחה שוב" button (first click
  turns into "לשמור ולשלוח שוב ל־N נמענים?", second click saves, then re-sends). The rules are in `frontend/src/notices/resend-model.ts`.

## 3. Question 7 - the editor role manages notices by default (answer B)

**How role defaults are defined.** Built-in roles are code: `smplwise_vms/backend/smplwise/roles.json`, loaded into `rbac.ROLES` at start
(mirrored in `contracts/examples/role-catalog.design.json`). They are not stored per installation and cannot be edited by an administrator
(`PUT/DELETE /access/roles/{id}` answer 409 `builtin_role` for a built-in id; `role_permissions` returns `ROLES` before any custom role).
An administrator customises access only by custom roles, the grant roles (`notices_manage` etc.) and allow / deny bindings.

**So no migration is needed, and none was written** (0197 stays free): adding the permissions to `roles.json` reaches every existing editor
binding on the next start, and there is no per-installation copy of the editor role that could hold an explicit customisation to overwrite.
Existing explicit decisions keep working: a grant of `notices_manage` stays (harmless overlap); a **deny** binding that takes notice
management away still wins (test).

**Change:** editor gains `notices.view` + `notices.manage` (the same pair as the grant role `notices_manage`). Not `notices.push`,
`notices.delete` or `notices.boards` - those stay separate grants. A floor-scoped editor writes notices for his floors only (the existing
scope rule, `audience_out_of_scope` otherwise).

**Side effects to know (no code change made for them):**
- Delegation ceiling: a delegated administrator hands out a role only with all its permissions in his own scope. `site_admin` holds both
  notice permissions, so a delegated site administrator can still hand out editor (when the owner put editor on the allow-list; it is not on
  the default list). A delegate on a custom role that has `rbac.assign` but no notice management can no longer hand out editor, or manage a
  group that carries an editor binding (`group_reach_problem` ceiling). This is the effect CR-NOTICE106 section 6 warned about.
- An existing deny binding of the **editor** role now also denies `notices.view` / `notices.manage` at its scope (a deny takes away every
  permission of its role) - so a user denied "editor" somewhere and granted `notices_manage` there loses notice management at that scope.
- Notification visibility: a holder of `notices.manage` may see notice notifications (`push.can_see`); editors are now such holders. Recipients
  are unchanged (the audience).
- The demo role card text in `frontend/src/fixtures/catalog.ts` (demo mode only) was not changed.

## 4. Files

- Backend: `routers/notices.py` (resend route, `push_generation` in the manager answer, docstring), `services/notices/push.py` (`resend`,
  `resend_wait_s`, a shared `_emit`), `roles.json`; `contracts/examples/role-catalog.design.json`.
- Frontend: `screens/system-notices.ts` (copy / replace), `screens/devices-notices.ts` (row action + confirmation), `notices/compose-dialog.ts`
  (save and re-send), new `notices/resend-model.ts`, `api/notices.ts` (`resendNotice`, `push_generation`), `i18n/notices.ts` (texts).
- Tests: new `backend/tests/test_board_mgmt_2381.py`; `test_notices_106.py` (the editor assertion follows answer 7B); new
  `frontend/tests/unit-board-mgmt-2381.spec.ts`, new `frontend/tests/evidence-board-mgmt-2381.spec.ts` (runner).
- `contracts/API_INVENTORY.md` not regenerated here (the release commit regenerates it; one new route `POST /api/v1/notices/{notice_id}/resend`).

## 5. Rollback

Revert the branch commits. No schema change; `push_generation` values written by re-sends stay valid for the old code (it reads the column).

## 6. Evidence (code commit 9fae89419)

| Check | Where | Result |
|---|---|---|
| `tsc --noEmit` (src + tests) | workstation | 0 errors |
| `playwright test -c playwright.unit.config.ts` (all Node-only unit specs, incl. new `unit-board-mgmt-2381`) | workstation, 4 workers | 3816 passed, 0 failed (3883 skipped, 118 did not run - page specs outside this config) |
| `pytest tests/test_board_mgmt_2381.py` | workstation | 16 passed |
| pytest: notices 106 / perm / push / delete / security / caps / tvsettings / boardv2 / remove, access wxperm, rbac groups, access, alarm, devices, automations scope, building presence, board-mgmt | workstation | 396 passed, 0 failed |
| `run_smart.py backend` (full suite, two shards) | runner | 19733 passed, 24 skipped, 3 xfailed, **1 failed**: `test_calendar_attendees_2343.py::test_whatsapp_channel_through_the_shared_account_on_the_fake_adapter` - **fails the same way on a clean `origin/main` (v2.38.0)**, not caused by this branch |
| `run_smart.py preview`: `evidence-board-mgmt-2381`, `evidence-notices`, `evidence-noticedel-295`, `evidence-noticepage-295`, `evidence-noticeslides-295` | runner, desktop / tablet / mobile | 165 passed, 0 failed |
| `run_smart.py preview`: `evidence-board-mgmt-2381` alone, list reporter | runner, desktop / tablet / mobile | 18 passed (two phone tests stop early by design: the boards table and the notice table are desktop views) |
| Pixel baselines | - | none touched: no pixel spec covers `#/system/notices` or `#/devices/notices`; the TV page is unchanged |

Gate check before every runner job: `gate_status.json` = pass (release/2380-train), no `release_gate.py` / `release_gate2.sh` process.
