# HOME-T120-REST-2530 - task T120 (the home interface): gap analysis, and "my account" inside the home interface

Branch `pilot/HOME-T120-REST-2530` from `origin/release/2520-train` eadaa25b8. Task T120 (`management/tasks.json`, IN_PROGRESS, target 2.53):
"Home interface (HOME-SIMPLE-2420): a second, simpler room-centred interface next to the full one, per-person interface policy".
No migration, no new route, no new permission, no version bump, no CHANGELOG, API inventory unchanged. Nothing in `management/`,
`private/` (except the local compare page), `secrets/`, the lab or a device was touched. Files the 2.52 train rows own (WisKey R1-R7,
bridge, DESIGN-LITERALS-2510) were not touched.

## 1. Gap analysis

Read: the T120 card (`management/tasks/T120.md`, acceptance R-T120-1..5), every home row's change note (`docs/changes/HOME-SIMPLE-2420`,
`-2421`, `HOME-V3-P1-2430`, `-P2-2431`, `-P3-2432`, `-FOLLOWUP-A/B-2431`, `-GAPS-2436`, `-AUDITFIX-2437`, `HOME-R32-ANSWERS-2438`,
`HOME-INTERFACE-NEXT-2490` (branch HOME-NEXT-2500), `HOME-FAVORITES-2500`, `HOME-WALL-NIGHT-2500`, `HAND-SWITCH-HOME-*-2500`,
`MULTI-BUILDING-HOME/NEXT/SAFETY-2500`, `MULTI-BUILDING-FILTER-2520`), the commits (`git log --grep=HOME-`), the approved mockups they cite
(round25 `home-simple-v2`, round27 `home-full-v3`, the round30 audit `round30/home-audit/FIXES.md`), and the code on the base.

### 1.1 The five acceptance lines

| Line | State on the base | Where | Note |
|---|---|---|---|
| R-T120-1 per-person policy (default, may switch, home only, wall panel + room + exit code, rooms, categories) by `rbac.assign` in user management; defaults; existing users keep full | **built** | `services/home_interface.py`, `routers/home_interface.py`, migrations 0211 / 0212, `home/sw-home-admin.ts` (user management > "ממשק ביתי") | The default for NEW people was changed by the owner (HOME-SIMPLE-2421 section 5): an installation setting `home.default_mode`, default `full_all`; `home_regular` is the card's original rule. The card's wording is stale (question 1) |
| R-T120-2 home-only refused 403 `home_interface_only`, audited; the switch refused when locked | **built** | `home_interface.enforce` from `auth._principal`; `PUT /me/interface` -> 403 `interface_locked` | Pinned by `test_home_interface.py::test_home_only_user_is_refused_on_full_only_routes` |
| R-T120-3 the room-centred interface with lights / switches / climate / shutters / doors + call / cameras / electricity / alerts / scenes through existing paths; room / house off = lights and light-typed switches only | **built**, and extended by v3 (recordings, diary, intercom, alarm, family, building, media, bills, water, systems, map) | `frontend/src/home/` | Pinned by `home-simple-2420.spec.ts` and `test_house_off_and_room_off_never_reach_a_protected_or_not_light_switch_after_bulk_marking` |
| R-T120-4 favourites per person + admin seed, favourite / hidden rooms, what opens first, theme; scenes by administrators only | **built** | `home_user_prefs`, `home_favourites_seed`, settings tabs | "Scenes by administrators only" became "by whoever holds scene management" (owner Q75, HOME-FAVORITES-2500). Card wording stale (question 1) |
| R-T120-5 no scrolling at 1280x800, 390x844, 1440x900; 56 px targets on the tablet | **built** | the size sweeps of `home-simple-2420.spec.ts` and every v3 spec | |

### 1.2 What the change notes promised and is not built

| Item | Source | State | Kind |
|---|---|---|---|
| A home-only person's own account: security (authenticator, recovery codes, passkeys, phone keys, tokens), own sign-ins, interface language | not promised anywhere; found by this audit: a home-only person is sent back to `#/home` from every full-interface address (`sw-app` `enforceHome`), and the home menu had no account section. It became a real gap with the language switch (I18N-EN-SWITCH-2438, "for every signed-in user"), the second factor (2.49-2.51), the opt-in step-up of door opening / alarm disarm (a home-only person could not enrol the factor the step-up asks for) and the 2.52 passkey sign-in of home-system users | **built here** (section 2) | real gap |
| Climate "hold" | HOME-SIMPLE-2420 | not built | owner decision Q76 (leave out) |
| Intercom call picture, guest invitation weekly / show code, ticket close / reopen, calendar event key link, emergency announcement, generator test, main water valve, voice announcement, floor announcement | HOME-V3-GAPS-2436 table | not built | owner decisions (round 27 / 29) or no data (no frames in the call log) |
| Diary alarm rows show who armed / disarmed | HOME-V3-GAPS-2436 question 1 | built as recommended (a) | decision by the unanswered = recommendation rule |
| Wall panel settings per panel (not per installation); night by sunrise / sunset; dimming through the kiosk app's backlight | HOME-WALL-NIGHT-2500 known limits | not built | not asked / owner Q71, Q73 chose the built option |
| "Who is home" by building; the wall takeover only for the panel's building; the full interface's notice board building filter | MULTI-BUILDING-FILTER-2520 questions | not built | recommendations (a) = leave / later row |
| Our own floor names in the home interface | MULTI-BUILDING-HOME-2500 question 4 | not built | recommendation (a) = keep the home system's names |
| Round-30 audit items 6-29 | `round30/home-audit/FIXES.md` | built (AUDITFIX-2437, R32-ANSWERS-2438); item 8 by Q78 (HOME-FAVORITES-2500), item 21 closed by the owner | none left |

### 1.3 What is still open that code cannot close

* **Receipts.** `management/test_catalog.json`: AT-T120-1..5 are `NOT_RUN` ("until the change record's receipts are reviewed"),
  `requirements.json` R-T120-1..5 `PLANNED`, the card's `evidence` empty and `commit` null. This branch re-ran the T120 regression set on
  the runner at its head (section 3) so the lead can record them; this row does not edit `management/`.
* **Physical checks** (HOME-SIMPLE-2420 limit 3, AUDITFIX "not verified"): one real light, switch, shutter, the door (owner approval)
  and a room's bulk off from the home interface in the lab; a real phone, portrait tablet and wall panel; the five other colour themes;
  keyboard order; measured contrast. Lab / hardware: outside this row (no lab).

## 2. What was built: "החשבון שלי" in the home interface

* The home interface's personal menu (the avatar at the top) has a new row **"החשבון שלי" / "My account"**, under "ההגדרות שלי".
  It opens a sheet with three tabs: **אבטחה** (Security, first), **הכניסות שלי** (My sign-ins), **שפה** (Language).
* The tabs hold the full interface's OWN elements, unchanged: `sw-account-security` (the overview line, the authenticator app with its
  recovery codes, passkeys, phone keys, access tokens), `sw-remote-sessions compact scope="own"` (sign out a sign-in, or everywhere),
  `sw-lang-prefs` (Hebrew / English, saved per person on the server). Each is loaded on first use (the security chunk stays out of the
  entry chunk, as in the full interface: `NOT_IN_ENTRY`).
* **No new route, no permission change.** The blocks call the person's own `/auth/*` and `/me/prefs` routes, which the home-only gate
  already allowed (`HOME_ALLOWED_PREFIXES` `/auth/`, `/me/`) and which keep their own rules (the step-up of a factor change, the recovery
  code rules, the fresh sign-in before a first factor). The administrator's account pages stay outside (`/security/*`, `/identity/*`:
  403 `home_interface_only`), and the administrator's lists inside `/auth/` answer the route's own permission refusal. Pinned by the new
  `tests/test_home_account_2530.py`, which also checks that the gate neither refuses nor grants: a home-only operator gets exactly the
  answers of the same operator on the full interface.
* **Not on a wall panel** (a shared screen has no personal account; its avatar is hidden already) and not without a server.
* **Look.** The sheet is the home's own sheet (`.sheet.dialog.wide.v3`, header, `sw-segmented` tabs, 56 px keys on the tablet). The blocks
  keep their own layout (owner rule: keep module looks); the sheet lends them the home theme's colours through their `--sw-*` tokens
  (custom properties cross the shadow boundary, `home-styles-extra.ts` `.acc-body`), so the dark "midnight" home never shows a light
  block. No new literal colour or size (the design ratchet counts are unchanged).
* **No scrolling of a control screen.** The security section is longer than a phone screen, so it scrolls inside the sheet only (60 % of
  the window height), never the page or the home shell - the same rule as the notice text (owner decision 10א). The rule is on the
  reviewed allow-list of the design ratchet as a dialog body (`scripts/design_ratchet_scroll_allow.json`).
* **Step-up over the home interface.** With step-up switched on (opt-in), opening a door or disarming from the home interface gets the
  central 403 `step_up_required`; the shell's code dialog opens on top of the home sheets (browser top layer) and the request is sent once
  more after the proof. This already worked through the shared API client; it is now pinned by a spec, and a home-only person can now
  enrol the factor it asks for.
* Texts: Hebrew + English (`i18n/lang/en/i18n/msg/home.ts`: "My account", "My sign-ins", "Language"; the blocks bring their own).

### Files

| File | Change |
|---|---|
| `frontend/src/home/home-account.ts` | new: the menu row, the sheet, the lazy loading of the three blocks |
| `frontend/src/home/sw-home.ts` | 2 lines: the import and the row in the personal menu |
| `frontend/src/home/home-styles-extra.ts` | the sheet body: token bridge, inner scroll, focus ring (tokens only) |
| `frontend/src/i18n/lang/en/i18n/msg/home.ts` | 3 English texts |
| `scripts/design_ratchet_scroll_allow.json` | the sheet body as a reviewed dialog scroll |
| `smplwise_vms/backend/tests/test_home_account_2530.py` | new: the gate lets the own account through, keeps the administrator's pages out, grants nothing |
| `frontend/tests/home-account-mocks.ts`, `home-account-2530.spec.ts` | new: the mocked own-account routes; behaviour, colours, the three-size sweep, wall panel, step-up |
| `frontend/tests/pixel-home-account-2530.spec.ts` + `-snapshots/` | new: Linux baselines (menu row, security sheet; 1440 + 390; light + dark) |
| `frontend/tests/evidence-home-account-2530.spec.ts` | new: before / after captures for the compare page (`SW_SHOTS=1` only) |

## 3. Tests

All runs on the Linux runner (slot B, `~/work/p2520_t120rest_run.sh` / `_run2.sh`), except the first PC line. Backend: one pytest
process per file (`-o addopts= -q`). Playwright against the branch's own `npm run build` preview (port 4531), mocked backend.

| Command | Where | Commit | Exit | Result |
|---|---|---|---|---|
| `pytest tests/test_home_account_2530.py -p no:xdist` | PC | 8834cf569 tree | 0 | 3 passed |
| `ruff check tests/test_home_account_2530.py` | runner | 1e6d6d854 | 0 | clean |
| `pytest tests/test_home_account_2530.py` | runner | 1e6d6d854 | 0 | 3 passed |
| `pytest tests/test_home_interface.py` (T120 receipts R-T120-1/2/3/4) | runner | 1e6d6d854 | 0 | 29 passed |
| `pytest tests/test_home_interface_doors_2421.py` | runner | 1e6d6d854 | 0 | 1 passed |
| `pytest tests/test_home_v3_gaps_2436.py` | runner | 1e6d6d854 | 0 | 3 passed |
| `pytest tests/test_me_permissions.py` | runner | 1e6d6d854 | 0 | 1 passed |
| `npx tsc --noEmit -p tsconfig.json` / `-p tsconfig.tests.json` | runner | 1e6d6d854, again at f79f7114b | 0 / 0 | clean |
| `npx eslint` on the 8 changed / new frontend files | runner | 1e6d6d854 | 0 | 0 errors (4 "file ignored" warnings: the test helpers are outside the lint set) |
| `node scripts/lazy-tags-check.mjs` | runner | 1e6d6d854 | 0 | OK (33 NOT_IN_ENTRY modules, sw-account-security still out of the entry chunk) |
| `node scripts/unused-exports.mjs` | runner | 1e6d6d854 | 0 | no new item (the list is the base's) |
| `python3 scripts/design_ratchet.py` | runner | 1e6d6d854, again at f79f7114b | 0 | no count above the baseline (scroll-container 13 = baseline: the sheet body is on the allow-list) |
| `python3 scripts/gate/lint_spec_waits.py` on the 3 new specs | runner | 1e6d6d854 | 0 | 0 findings |
| unit: `unit-i18n-home`, `unit-home-v3-p1`, `unit-home-simple-logic`, `unit-home-lazy-2440`, `unit-shell-lazy-2436`, `unit-perf-2490` | runner | 1e6d6d854 | 0 | 41 passed |
| unit: `unit-i18n-home` | runner | f79f7114b | 0 | 6 passed |
| `npm run build` | runner | 1e6d6d854, f79f7114b | 0 | built |
| `playwright test tests/home-account-2530.spec.ts --project=desktop` | runner | 1e6d6d854 | 1 | 7 passed, 1 failed: the 390 sweep measured the segmented keys at 40 px without the home's 4 px hit extension (the rule of every other home audit) - spec fixed |
| same | runner | f79f7114b | 0 | **8 passed** (security first with the full interface's blocks, sign-ins + language with the `ui.lang` save, dark theme colours, the sweep at 1280x800 / 1024x768 / 390x844 on each tab, wall panel without the row, step-up over a door) |
| `playwright test tests/pixel-home-account-2530.spec.ts --project=desktop --project=mobile -u --workers=1` | runner | f79f7114b | 0 | 8 passed, 8 Linux baselines written (committed) |
| same without `-u`, twice | runner | f79f7114b | 0 / 0 | 8 passed / 8 passed |
| T120 receipts + the specs that share the menu: `home-simple-2420`, `home-simple-2421`, `home-v3-gaps-2436`, `pixel-home-gaps-2436`, `pixel-home-auditfix-2437`, `pixel-home-fb-2431`, `pixel-home-next-2500` (`--project=desktop --project=mobile`) | runner | 1e6d6d854 | 0 | 77 passed, 47 skipped (the specs' own per-project skips) |
| `home-simple-2420`, `home-v3-gaps-2436` (desktop) | runner | f79f7114b | 0 | 34 passed |
| `SW_SHOTS=1 evidence-home-account-2530` (after at f79f7114b, before at the base eadaa25b8) | runner | both | 0 / 0 | 4 passed each; 16 after + 4 before captures |

Run 1 also showed, in the dark home theme, the account buttons drawn light: the default skin (domus / classic) draws its raised button from
`--sw-surface-2-solid` and `--sw-highlight`, which the first token bridge did not cover. Fixed in f79f7114b (the baselines are from that
commit). Compare page (local, Hebrew): `private/planning/home-t120-rest-2530_compare_2026-11-25.html` (not in Git).

NOT_RUN: the full backend and Playwright suites (the train's gate runs them); a real phone / tablet / wall panel; a real passkey
registration or authenticator enrolment through the home sheet (mocked routes only; the blocks are the full interface's, whose own specs
cover them); the lab.

## 4. Open questions (recommendation first)

1. **The T120 card's wording.** Two acceptance lines no longer match owner decisions: new people open the FULL interface by default
   (installation setting, HOME-SIMPLE-2421), and scenes are edited by whoever holds scene management (Q75).
   (a) the lead updates R-T120-1 / R-T120-4 to the decisions and records the receipts of section 3, then T120 -> DONE (recommended);
   (b) keep T120 open until the lab checks of section 1.3 are run.
2. **"החשבון שלי" for everyone or by category.** Built for every person on their own screen, like the full interface (no setting).
   (a) keep (recommended: managing one's own sign-in is not something to hide); (b) add an "account" category to the per-person
   categories so the administrator can hide it.
3. **The lab check of the home interface** (one light, one switch, one shutter, the door, a room's off) needs the owner's write approval.
   (a) a short lab card when the owner is available (recommended); (b) leave it to the first customer installation.

## Rollback

Revert the branch commits. Nothing is stored; the routes were there before.
