# HOME-V3-FOLLOWUP-A-2431 - home interface v3, follow-up A (owner answers 2026-11-11)

Branch `pilot/HOME-V3-FOLLOWUP-A-2431` from `origin/release/2430-train` 60d20c9de (2.43.0: phase 1 + phase 3), with
`origin/pilot/HOME-V3-P2-2431` 85f4c5e0a (phase 2, migration 0214) merged in. No version bump, no CHANGELOG, API inventory not
regenerated. Nothing in `private/`, `secrets/`, `management/*.json`, the release worktree `smplwise-train34` or the lab was touched.
Kept away from the wall panel calendar and the ticket photos (`pilot/HOME-V3-FOLLOWUP-B-2431`, parallel).

## The merge of phase 2 into the train

Four textual conflicts, each resolved by keeping BOTH sides (phase 2's lines, then phase 3's):

| File | Conflict | Resolution |
|---|---|---|
| `smplwise_vms/backend/smplwise/services/home_interface.py` | `MODULES` extended by phase 2 (5) and phase 3 (`MODULES_P3`, 6) | base 9, then phase 2's five, then `MODULES_P3` |
| `frontend/src/home/home-api.ts` | the `HomeModule` union | phase 2's five names and `HomeModuleP3` |
| `frontend/src/home/sw-home-admin.ts` | `MODULE_LABEL` | phase 2's labels and `...P3_MODULE_LABEL` |
| `frontend/src/home/sw-home.ts` | the imports; the room chips | both imports (`home-p3-ext` / `home-p3` and `home-v3-p2`); `p3.roomChips(r)` then the wall panel's `wallChips` |

One semantic conflict outside the markers: `tests/test_home_v3_p3.py` asserted that the phase 3 categories directly follow the base
nine (true only without phase 2). It now asserts the base nine are first. Migration numbers did not clash (train: 0213; phase 2: 0214).

## Owner answers implemented

1. **Recordings, the house log and the intercom in the per-person list** ("מה מופיע בממשק הביתי"), on by default: new categories
   `recordings`, `log`, `intercom` (`MODULES_FA`). The admin page labels them "הקלטות", "יומן הבית", "אינטרקום"; the doors category
   is now just "דלתות". UI gates: recordings = `cameras` AND `recordings` AND `video.playback`; the house log = `log` AND (its old
   permission rule); the intercom screen, hub tile and home chip = `intercom` AND `access.read` (was: `doors`). Server: for a home-only
   person whose list hides `recordings` / `log`, `/playback/sessions*` and `/events*` answer 403 `home_module_off`
   (`HOME_MODULE_ROUTES`). The intercom's routes are deliberately not gated (an incoming door call must still ring).
2. **Visitor invitations: off at install, an admin switch** in the home interface page > "הגדרות התקנה" > "הזמנת אורחים". It reads and
   writes the existing `access.visitors` switch through `GET|PUT /access/visitors/settings` (system administrator only, audited
   `settings.changed`) - no new route, no new authority. Someone who is not a system administrator sees the switch locked and the page
   does not ask the server (no refused read in the audit). When on but the installation's external access is off, the card says it does
   not work yet. The guest code stays hidden from the inviter (unchanged).
3. **New categories reach people with an admin-set list**: migration **0215** `0215_home_v3_categories.sql` (highest before: 0214 on
   phase 2, 0213 on the train). Appends, once, to every stored JSON-array `modules_json`: phase 2's five, phase 3's six, `recordings`
   and `log`; `intercom` only where `doors` was on (the intercom used to live under doors, so nobody gets a newly shown screen they were
   denied). NULL (= every category), invalid JSON and non-arrays are untouched. Idempotent statement. Rollback: leave the rows (the
   previous version only validates on write).
4. **"הצג חשבון" in the bill card**: the card shows "הצג חשבון אחרון" (latest issued / sent / paid bill), every previous bill row an
   icon button; both open the bill file itself (`GET /energy/bills/{id}/pdf`, a tab opened inside the click, the file as a blob; saved
   instead when no tab can open; a refused file closes the tab with a simple toast). Not on a wall panel. Home-only gate: the one
   whole route `/energy/bills/{id}/pdf`, GET/HEAD only (`HOME_READ_ONLY_PATTERNS_FA`); every other `/energy/bills*` route stays refused.
   The route keeps its `energy.bills` check; for a home-only person `home_bill_file_check` also refuses a draft / void bill
   (`home_interface_only`) and a hidden `bills` category (`home_module_off`). Bills carry no per-person owner in the billing module;
   "allowed" = the person holds `energy.bills` and the bill is one the home interface lists. Unchanged: the first account with a choice
   when there are 2-3.
5. **Confirmed unchanged, no work**: recordings play from the main stream; "who can enter" shows door counts; the personal alarm code
   only on the alarm screen; who-is-home as today; Do-Not-Disturb passes alarm / doors / safety; announce = short text + ready
   messages, room or whole house; tenants only add notes on open tickets.

## Tests

* `smplwise_vms/backend/tests/test_home_v3_followup_a.py` (new): categories on by default; migration 0215 (number, lists, doors rule,
  untouched values, idempotent; applied on start); gate for the bill file and the module routes; home-only category refusals; bill
  file permission (no `energy.bills` -> route's own 403; issued / paid -> 200; draft / void -> 403; hidden category -> 403; writes next to
  it refused; not home-only -> full-interface rules); visitor switch off at install, system administrator only.
* `frontend/tests/home-v3-followup-a.spec.ts` (new, Playwright page spec, mocked backend): bill screen without scrolling at desktop /
  tablet / phone with targets and words; "show bill" opens b1 / a row opens b2; refused file; 2 accounts; none on a wall panel; the three
  categories hidden one by one; admin page labels; the visitor switch for a system administrator and locked for others.
* `frontend/tests/home-simple-mocks.ts`: the mocked overview's default categories include the three new ones (the server's default).
* The repository has no vitest: UI unit / page specs are Playwright (`playwright.config.ts`, `playwright.unit.config.ts`). The home
  interface screens have no `toHaveScreenshot` baselines (their specs audit layout and write evidence shots to `test-results/`), so there
  are no pixel baselines to refresh for this change; the home specs were run on the runner instead (results in the closing report).
