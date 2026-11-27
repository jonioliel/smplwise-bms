# HOME-PERMS-WARN-2550 - the home permissions page warns when a category shows the whole site's data (D-11)

Target 2.55. Branch `pilot/HOME-PERMS-WARN-2550`, base `origin/pilot/LOWS-BACKEND-2550` at `d65bbfd93`.
Source: `docs/changes/LOWS-BACKEND-2550.md`, finding **D-11** (billing has no per-person / per-building scope: a home-only person with
`energy.bills` reads every customer) and its question 3, answered **a** (the recommendation): a warning in the home-interface policy page
when "bills" is on for a person on a site with more than one customer; the person -> customer binding later, when tenants are a target.
D-11 is still present at the base (`GET /energy/accounts` lists every account; `services/home_interface.home_bill_file_check` checks the
category and the bill state only).

**No behaviour change.** Nobody may read anything they could not read before, and nothing is written. The API change is additive
(ADR-015). **No migration.**

## What changed

### The warning (frontend, `frontend/src/home/sw-home-admin.ts`)

Settings > Access > Home interface > Users > a person's card. Under "מה מופיע בממשק הביתי" / "חדרים שהמשתמש רואה" a read-only note
(`role="note"`, `data-home-site-wide`) appears when **all** of these hold:

* the person is not a system administrator (he reads everything anyway);
* at least one of the categories **חשבון חשמל** (`bills`), **חשמל** (`energy`), **מים** (`water`) is on for the person, and the person's
  permission reads that category's data **for the whole site** (`site_wide`, below);
* the site has more than one billing customer (`shared_scope.customers > 1`) - a single customer means every bill is that household's
  (question 3 a). An unknown count (null, an older database) shows the note.

It names the exact scope in plain words, one line per category, with the site's counts:

* "חשבון חשמל: החשבונות והסכומים של כל הלקוחות באתר (לקוחות: 4, חשבונות פעילים: 6), לא רק של הבית שלו."
* "חשמל: הצריכה של כל מוני החשמל באתר (מונים: 14)."
* "מים: הצריכה של כל מוני המים באתר (מונים: 5). הרשאת מים לפי קומה מגבילה אותו לקומות שלו."

and closes with "there is no link yet between a person and their billing customer or meter; the permissions are set in Users and
permissions; here you can only hide the screen from the home interface". Unchecking the category removes its line (the checkbox saves
exactly as before). Hebrew + English (`frontend/src/i18n/lang/en/i18n/msg/home.ts`). Design tokens only (`--sw-warning-soft`,
`--sw-warning-text`, `--sw-text`, `--sw-text-2`, spacing / radius / font-size tokens) in the access screens' callout shape;
`scripts/design_ratchet.py`: no count up (px-literal one lower).

### The display hint (backend, additive)

`GET /api/v1/home/policies` (rbac.assign, unchanged):

* each person gains `site_wide: ["bills" | "energy" | "water"]` - `services/home_interface.site_wide_reads`: the categories whose permission
  the person holds **installation-wide** (`energy.bills`, `energy.view`, `water.view` via `rbac.authorize(..., INSTALLATION)`). A floor-scoped
  `water.view` is not listed (that holder sees his floors' meters only, `services/water_meters.Reach`). A system administrator: `[]`.
  `energy.bills` and `energy.view` have no narrower scope in the routes (`routers/energy_billing._has`, `routers/energy_meters._viewer`).
* the answer gains `shared_scope: {customers, bill_accounts, energy_meters, water_meters}` - `services/home_interface.shared_scope`: billing
  customers not deleted (the shared customer card of the electricity and water bills), active electricity accounts of those customers,
  electricity / water meters not retired. A count the database cannot answer stays `null` (unknown, never a made-up 0).

Display hints only, never an authorization. Wire models: `wire/home_interface.HomeUserPolicy.site_wide`, `HomeSharedScope`,
`HomePolicies.shared_scope`; `frontend/src/api/generated/wire-home-interface.ts` regenerated (`scripts/gen_wire_types.py`).

## Files

* `smplwise_vms/backend/smplwise/services/home_interface.py` - `SITE_WIDE_READS`, `site_wide_reads`, `shared_scope`; `list_policies` adds `site_wide`
* `smplwise_vms/backend/smplwise/routers/home_interface.py` - `GET /home/policies` adds `shared_scope`
* `smplwise_vms/backend/smplwise/wire/home_interface.py` - the two additive fields and `HomeSharedScope`
* `frontend/src/api/generated/wire-home-interface.ts` - regenerated
* `frontend/src/home/sw-home-admin.ts` - `siteWideWarning`, its style
* `frontend/src/i18n/lang/en/i18n/msg/home.ts` - the eight English texts
* `smplwise_vms/backend/tests/test_home_perms_warn_2550.py` - new
* `frontend/tests/home-perms-warn-2550.spec.ts` - new (behaviour, pixel baselines, compare captures) and its `-snapshots/` (Linux)

## Tests

All on the Linux test server through `~/work/slotb.sh` (jobs `p2520_hpw_run.sh`, `_run2.sh`, `_run3.sh`, `_re.sh`); base = `d65bbfd93`.

| Check | Command | Result |
|---|---|---|
| wire types | `python scripts/gen_wire_types.py` then `--check` | regenerated (38-line diff, committed); `--check` exit 0 |
| new backend test, **before** (base + the new file) | `pytest -q tests/test_home_perms_warn_2550.py` | exit 1: 3 failed (`site_wide` / `shared_scope` missing, `shared_scope` not defined) |
| new backend test, after | same, on the branch | exit 0, 3 passed |
| related backend files (one process each) | `pytest -q tests/<f>` for `test_home_interface`, `test_home_v3_p1/p2/p3`, `test_home_v3_followup_a`, `test_home_followup_b_2431`, `test_home_v3_gaps_2436`, `test_home_account_2530`, `test_mb_home_2500`, `test_lows_backend_2550_security`, `test_wire_routers_b/c/d/e`, `test_wire_consumption_2450` | every file exit 0 |
| ruff (touched backend files) | `ruff check ...` | exit 0 (also on the PC) |
| frontend build | `npm run build` (tsc + vite) | exit 0 (run 2) |
| typecheck (tests + scripts) | `npm run typecheck` | exit 0, 0 errors |
| eslint (touched files) | `npx eslint --pass-on-unpruned-suppressions <files>` | exit 0 (one warning: the spec file is outside eslint's scope) |
| English texts | `playwright -c playwright.unit.config.ts tests/unit-i18n-home.spec.ts` | exit 0, 6 passed |
| design ratchet | `python scripts/design_ratchet.py` | exit 0, no count up |
| new spec, **before** (base build + the new file) | `playwright test tests/home-perms-warn-2550.spec.ts --project=desktop -g "site-wide data warning"` | exit 1: 4 failed (no warning), 2 passed (the "no warning" cases) |
| new spec, after | `playwright test tests/home-perms-warn-2550.spec.ts --project=desktop --project=mobile --workers=2` | exit 0, 10 passed (6 behaviour + 4 pixel), 14 skipped (behaviour is desktop-only; captures run only with SW_SHOTS) |
| pixel baselines | same with `-u -g "pixel-stable"` | 4 written (desktop 1440 + phone 390, light + dark; dark through `?scheme=dark`), then compared: pass |
| related admin / home specs (desktop) | `playwright test home-simple-2420/2421, home-v3-followup-a, home-v3-p1, home-next-2500, home-wall-night-2500, pixel-home-next-2500` | 74 passed, 2 failed: `pixel-home-next-2500` "wall notice board, all dark" fails on the base build too (not this row); `home-simple-2421` "no exit ignores the long press" timed out waiting for the room title once - re-run `--repeat-each=3` on the branch: 27 passed, exit 0 (a load flake; the wall panel screen is not touched here) |

NOT_RUN: the full backend suite, the full Playwright suite, the tablet project, Windows / macOS pixel baselines (Linux only), any lab check
(not allowed for this row).

Compare page (local, Hebrew): `private/planning/home-perms-warn-2550_compare_2026-11-27.html` (desktop + phone, light + dark, before / after).

## The same gap in the other per-person data of the home categories (read in the code at the base; nothing changed)

| Category | What a home user reads | Per person? | Gap |
|---|---|---|---|
| חשבון חשמל (`bills`) | `GET /energy/accounts` (every account), `.../{id}/status`, `.../{id}/periods`, the bill file | no | **yes** - D-11; warned now |
| חשמל (`energy`) | `GET /energy/meters`, `/energy/consumption` - every meter (`energy.view` at installation scope only) | no | **yes** - warned now |
| מים (`water`) | `GET /infra/water/meters`, `/consumption`, `/events/summary` - every meter for an installation-wide `water.view`; a floor-scoped holder sees his floors only | per floor only | **partly** - warned for the installation-wide holder |
| פניות שירות (`tickets`) | `GET /home/tickets` - only the tickets the caller opened (owner decision round 27 q8) | yes | no |
| יומן וחדרים משותפים (`calendar`, bookings) | `GET /calendar/occurrences`, `/calendar/rooms/day` - the calendars the caller may see, each entry at the calendar's detail level (`busy` hides title and organizer) | per calendar | no (by the calendar's own sharing) |
| הקלטות (`recordings`) | `POST /playback/sessions` - any camera the person's `video.playback` reaches (rbac scope) | per camera scope | see question 2 |
| יומן הבית (`log`), אינטרקום | `GET /events` (rbac scope), `GET /intercom/calls` (stations the caller may read) | per scope | no |
| מי בבית (`presence`) | the household, by design | - | no |

Two related things found on the way (not in the row's scope, not changed):

* `GET /energy/accounts` (and `.../{id}/status|periods`) is on the home-only allow-list and accepts `energy.view` **or** `energy.bills`. A
  home-only person with `energy.view` only (the operator role) - for whom the home interface shows no bill screen - can still read every
  account with its customer's name and number and the last bill's kWh and dates (no money) by calling the route directly. The "bills"
  category does not gate these routes on the server either (only the bill file, `home_bill_file_check`). See question 1.
* The person's room list ("חדרים שהמשתמש רואה") filters the home overview (`routers/home_interface` `allowed_rooms`) but is not a server-side
  limit on the other home routes: cameras, recordings, device actions and the house log follow the person's permission scope. See question 2.

## Open questions (recommendation first)

1. **The electricity accounts for a home-only person without the bill permission.**
   a. For a home-only person, gate `GET /energy/accounts*` by the "bills" category and `energy.bills` (what the home interface itself uses);
      the full interface keeps its rules (a small backend row) **(recommended)**.
   b. Keep it: `energy.view` deliberately reads the accounts without money.
2. **The room list is a display filter, not a permission.**
   a. Say so on the page (one line under "חדרים שהמשתמש רואה": "מסתיר חדרים מהממשק הביתי; ההרשאות נקבעות במשתמשים והרשאות") and keep
      the server as it is - the role scope is the limit **(recommended)**.
   b. Enforce the room list on the server for home-only people too (cameras, recordings, device actions) - a larger row with its own tests.
3. **The person -> customer binding** (D-11 question 3, the later part of a).
   a. When tenants become a target: an optional binding person -> billing customer that narrows the bills (and the meters of the
      customer's accounts) for that person; until then the warning **(recommended)**.
   b. Build it now.
4. **Should the warning also appear on a single-customer site?**
   a. No - one customer means every bill is that household's; the note would only be noise **(recommended, as built)**.
   b. Always, as long as the category is on and the permission is site-wide.
