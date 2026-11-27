# HOME-PERMS-WARN-2550 - the home permissions page warns when a category shows the whole site's data (D-11)

Target 2.55. Branch `pilot/HOME-PERMS-WARN-2550`, base `origin/pilot/LOWS-BACKEND-2550` at `d65bbfd93`.
Source: `docs/changes/LOWS-BACKEND-2550.md`, finding **D-11** (billing has no per-person / per-building scope: a home-only person with
`energy.bills` reads every customer) and its question 3, answered **a** (the recommendation): a warning in the home-interface policy page
when "bills" is on for a person on a site with more than one customer; the person -> customer binding later, when tenants are a target.
D-11 is still present at the base (`GET /energy/accounts` lists every account; `services/home_interface.home_bill_file_check` checks the
category and the bill state only).

The warning itself changes no behaviour. The owner's rule (an unanswered question takes the recommendation) then added the two
recommendations of the questions below: **Q1 = a** closes a server gap (permissions only get stricter, for home-only people) and
**Q2 = a** adds one line under the room list. The API change is additive (ADR-015). **No migration.**

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

### Q1 = a - the electricity bill's routes for a home-only person (security, backend)

**Before.** `GET /energy/accounts`, `GET /energy/accounts/{id}/status`, `GET /energy/accounts/{id}/periods` were on the home-only allow-list
and kept only the billing module's own check (`energy.view` OR `energy.manage` OR `energy.bills`). A home-only person with `energy.view` and
no bill permission (the operator role) - for whom the home interface shows no bill screen - could call them directly and read every
account: the customer's name and number, the account's formula and meters, the period and the last bill's number, dates and kWh (no
money). Hiding the "חשבון חשמל" category did not stop it either (it stopped only the bill file).

**After.** `services/home_interface.enforce` (the home-only gate, run on every request) judges these routes and the bill file
(`GET /energy/bills/{id}/pdf`) for a home-only person (or a wall panel) exactly as the home bill screen decides: the "bills" category must
be on AND the person must hold `energy.bills` (installation scope). Otherwise 403 with a clear code - `home_module_off` (category hidden) or
`home_bills_permission` (no bill permission; "אין לך הרשאה לחשבונות החשמל." / "You have no permission for the electricity bills.") - and no
account data in the answer. Every refusal is audited as `home_interface.bills.refused` (reason = the code; at most once per person and code
per 5 minutes, the gate's own rule against audit floods). Not judged here, so unchanged: everybody who is not home-only (the full
interface keeps the billing module's rules), and a system administrator. A home-only person with the category on and `energy.bills` reads
as before. `GET /energy/tariffs` and `GET /energy/meters` are not bill routes and stay as they were.

### Q2 = a - the room list says what it does (frontend)

Under "חדרים שהמשתמש רואה" one line (`data-home-rooms-note`, the page's `.note` style): "הרשימה רק מסתירה חדרים במסך הראשי של הממשק
הביתי. היא לא מגבילה מצלמות, הקלטות או פעולות על מכשירים: אותן קובעות ההרשאות." English: "This list only hides rooms on the home
interface's main screen. It does not limit cameras, recordings or device actions: the permissions decide those." No server change.

## Files

* `smplwise_vms/backend/smplwise/services/home_interface.py` - `SITE_WIDE_READS`, `site_wide_reads`, `shared_scope`; `list_policies` adds `site_wide`;
  Q1: `HOME_BILLS_*`, `bills_route`, `_refuse_audited`, the bill branch in `enforce`
* `smplwise_vms/backend/smplwise/error_text_en.json` - the English of the new refusal
* `smplwise_vms/backend/smplwise/routers/home_interface.py` - `GET /home/policies` adds `shared_scope`
* `smplwise_vms/backend/smplwise/wire/home_interface.py` - the two additive fields and `HomeSharedScope`
* `frontend/src/api/generated/wire-home-interface.ts` - regenerated
* `frontend/src/home/sw-home-admin.ts` - `siteWideWarning`, its style; Q2: the room list's line
* `frontend/src/i18n/lang/en/i18n/msg/home.ts` - the nine English texts
* `smplwise_vms/backend/tests/test_home_perms_warn_2550.py`, `tests/test_home_bills_gate_2550.py` - new
* `frontend/tests/home-perms-warn-2550.spec.ts` - new (behaviour, pixel baselines, compare captures) and its `-snapshots/` (Linux)

## Tests

Final state (after Q1 = a and Q2 = a). PC: backend files one per process (`.venv` python, worktree sources). Linux test server through
`~/work/slotb.sh`: jobs `p2520_hpw_run4.sh` (head `faa3762af`) and `p2520_hpw_run5.sh` (head `a470d23bd`, the phone baseline fix); base = `d65bbfd93`.

| Check | Where / command | Result |
|---|---|---|
| Q1 new backend test, **before** (base + the new file) | runner, `pytest -q tests/test_home_bills_gate_2550.py` | exit 1: 3 failed - the home-only viewer read the accounts (200), the hidden category did not stop the accounts, `bills_route` missing; the 2 "unchanged" tests passed |
| Q1 new backend test, after | PC and runner, same file | exit 0, 5 passed |
| warning backend test, **before** / after | runner `tests/test_home_perms_warn_2550.py` | before exit 1 (3 failed); after exit 0, 3 passed (PC too) |
| PC, one process each | `test_home_interface` (29), `test_home_v3_p3` (6), `test_home_v3_followup_a` (8), `test_i18n_errors_en_2520` (9), `test_lows_backend_2550_security` (7), `test_singletons_registered` (4) | every file exit 0 |
| runner, related groups, one process each | `test_home_account_2530`, `test_home_config`, `test_home_followup_b_2431`, `test_home_interface`, `test_home_interface_doors_2421`, `test_home_links`, `test_home_scene_manage_2500`, `test_home_screen`, `test_home_screen_options_295`, `test_home_ticket_note_idem_2540`, `test_home_v3_followup_a`, `test_home_v3_gaps_2436`, `test_home_v3_p1/p2/p3`, `test_mb_home_2500`, `test_lows_backend_2550_security`, `test_energy_billing_api`, `test_bill_pdf`, `test_energy_bill_pdf_pipeline`, `test_bill_ledger_lifecycle_b`, `test_i18n_errors_en_2520`, `test_singletons_registered`, `test_wire_routers_b/c/d/e`, `test_wire_consumption_2450` | every file exit 0 |
| wire types | `python scripts/gen_wire_types.py --check` | exit 0 (regenerated earlier: 38-line diff, committed) |
| ruff (touched backend files) | PC `py -3.12 -m ruff check ...` | all checks passed |
| frontend build / typecheck | runner `npm run build`, `npm run typecheck` | exit 0 / exit 0, 0 errors |
| eslint (touched src files) | runner | exit 0 |
| English texts | `playwright -c playwright.unit.config.ts tests/unit-i18n-home.spec.ts` | exit 0, 6 passed |
| design ratchet | `python scripts/design_ratchet.py` | exit 0, no count up |
| new spec, **before** (base build + the new file) | `playwright test tests/home-perms-warn-2550.spec.ts --project=desktop -g "HOME-PERMS-WARN-2550 site-wide"` | exit 1: 5 failed (no warning, no room-list line), 2 passed (the "no warning" cases) |
| new spec, after | `--project=desktop --project=mobile --workers=2`, twice (run 5) | exit 0 both times: 11 passed (7 behaviour + 4 pixel), 15 skipped (behaviour is desktop-only; captures only with SW_SHOTS) |
| pixel baselines | `-u -g "pixel-stable"`, desktop 1440 + phone 390, light + dark (dark through `?scheme=dark`) | 4 written in run 5 and compared twice: pass. (Run 4 failed the two phone baselines: the warning sat at the viewport's edge under the phone's bottom bar; now centred and refreshed.) |
| related admin / home specs (desktop) | `home-simple-2420/2421`, `home-v3-followup-a`, `home-v3-p1`, `home-v3-p3`, `home-next-2500`, `home-wall-night-2500` | exit 0, 89 passed |

Earlier runs: `pixel-home-next-2500` "wall notice board, all dark" failed on the base build too (not this row; it was not in run 4's
list); one `home-simple-2421` load time-out in run 2 passed 27/27 with `--repeat-each=3` and passed again in run 4.

NOT_RUN: the full backend suite, the full Playwright suite, the tablet project, Windows / macOS pixel baselines (Linux only), any lab check
(not allowed for this row).

Compare page (local, Hebrew): `private/planning/home-perms-warn-2550_compare_2026-11-27.html` (desktop + phone, light + dark, before / after).

## The same gap in the other per-person data of the home categories (read in the code at the base; nothing changed)

| Category | What a home user reads | Per person? | Gap |
|---|---|---|---|
| חשבון חשמל (`bills`) | `GET /energy/accounts` (every account), `.../{id}/status`, `.../{id}/periods`, the bill file | no | **yes** - D-11; warned now; home-only access now needs the category and `energy.bills` (Q1) |
| חשמל (`energy`) | `GET /energy/meters`, `/energy/consumption` - every meter (`energy.view` at installation scope only) | no | **yes** - warned now |
| מים (`water`) | `GET /infra/water/meters`, `/consumption`, `/events/summary` - every meter for an installation-wide `water.view`; a floor-scoped holder sees his floors only | per floor only | **partly** - warned for the installation-wide holder |
| פניות שירות (`tickets`) | `GET /home/tickets` - only the tickets the caller opened (owner decision round 27 q8) | yes | no |
| יומן וחדרים משותפים (`calendar`, bookings) | `GET /calendar/occurrences`, `/calendar/rooms/day` - the calendars the caller may see, each entry at the calendar's detail level (`busy` hides title and organizer) | per calendar | no (by the calendar's own sharing) |
| הקלטות (`recordings`) | `POST /playback/sessions` - any camera the person's `video.playback` reaches (rbac scope) | per camera scope | see question 2 |
| יומן הבית (`log`), אינטרקום | `GET /events` (rbac scope), `GET /intercom/calls` (stations the caller may read) | per scope | no |
| מי בבית (`presence`) | the household, by design | - | no |

Two related things found on the way (both then decided by the owner's rule, questions 1 and 2):

* `GET /energy/accounts` (and `.../{id}/status|periods`) is on the home-only allow-list and accepts `energy.view` **or** `energy.bills`. A
  home-only person with `energy.view` only (the operator role) - for whom the home interface shows no bill screen - can still read every
  account with its customer's name and number and the last bill's kWh and dates (no money) by calling the route directly. The "bills"
  category did not gate these routes on the server either (only the bill file, `home_bill_file_check`). **Closed by Q1 = a.**
* The person's room list ("חדרים שהמשתמש רואה") filters the home overview (`routers/home_interface` `allowed_rooms`) but is not a server-side
  limit on the other home routes: cameras, recordings, device actions and the house log follow the person's permission scope. **Said on the page by Q2 = a** (no server change).

## Questions (owner rule: unanswered = the recommendation)

1. The electricity accounts for a home-only person without the bill permission - **a, built** (see Q1 above).
2. The room list is a display filter, not a permission - **a, built** (the line above); the server stays as it is.
3. The person -> customer binding - **a**: later, when tenants become a target; until then the warning.
4. The warning on a single-customer site - **a, as built**: not shown.
