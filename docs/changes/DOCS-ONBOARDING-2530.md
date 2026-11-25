# DOCS-ONBOARDING-2530 - getting started, operator guide and support (T071, target 2.53)

Branch `pilot/DOCS-ONBOARDING-2530`, based on `origin/release/2520-train` at `eadaa25b8`.

## What already existed (checked first, not rebuilt)

`git log --all --grep=T071`, `docs/user-guide`, `DOCS-GUIDE-REFRESH-2500`:

- The setup wizard (SC26, `#/system/wizard`, 0.1.133): six device steps with evidence, read-only checks, deep links, and the shell's
  "complete the installation" hint for system administrators (TKWIZHINT, 2.6.0), dismissible per user.
- Installation readiness (CR-READY96, `#/system/readiness`): computed checks with a `next` link each.
- The redacted log export (T033, `POST /health/logs/export`, the `health-log-export` card on Settings › Health and jobs, 2.44.0).
- `docs/operations/OPERATOR_GUIDE_HE.md` (install, daily use, investigation, recovery, privacy, a two-line support chapter) and the
  Hebrew user guide (`docs/user-guide/he/`), refreshed to 2.49 by DOCS-GUIDE-REFRESH-2500.

## The gap this row fills

1. **A first-run path.** Nothing told the operator of a NEW installation what to set up first beyond the wizard's device steps, and
   the existing hint showed on every installation with open steps (not only fresh ones).
2. **Settings › General › Support was a placeholder**: a disabled "יצירת חבילה (בהמשך)" button and two switches that did nothing,
   while the real redacted log export lived only on Health and jobs. No screen listed the versions to quote.
3. **The operator guide's support chapter** was two lines; there was no English operator page.

## What changed

### Backend (additive, ADR-015)

- Setting `onboarding.enabled` (`services/settings_store.py` DEFAULTS `"false"` = today's behaviour; `PATCH /settings` accepts
  `true | false` only, system.configure; readable by every viewer like the other `ui.*` switches).
- `startup_steps.mark_fresh_install_onboarding` (last in `AFTER_MIGRATE`): when THIS start applied migration 1 (the database was
  created now) it stores `onboarding.enabled = "true"` with `INSERT OR IGNORE` (never overwrites a choice). An existing installation
  never runs migration 1 again, so it stays off after the update. A developer / test backend (`SW_DEV_USER`) is left alone, so every
  existing test database behaves like an existing installation. A failure is logged and never blocks the start.
- User preference `onboarding.dismissed` (`services/user_prefs.py`, `routers/me.py` `StrictBool`): `true` or `null`, per user.
- `services/backup.SETTINGS_KEEP` += `onboarding.enabled`: a backup never carries the switch, a restore never changes it.

### Frontend

- `api/onboarding.ts`: the checklist is BUILT from what already exists - the wizard's required steps (one row, `summarizeSetup`) then
  the readiness checks in set-up order (`time, places, people, notifications, backup, remote, modules, handover`), then the support
  page. A not-applicable check is left out; the camera / integration checks are not repeated (they are the wizard's). Nothing is
  ticked by hand. Also the shared stores: the installation switch and the user's dismissal (per user, like `setup.hint`).
- `screens/system-onboarding.ts` - "תחילת עבודה" / Getting started at `#/system/onboarding` (system.configure; forbidden panel
  otherwise; demo data without a backend): a summary card (n of m, the next step, Hide / Show again, notes when hidden or off), the
  ordered list (state badge, detail, link), refresh. Existing components only (sw-page, sw-card, sw-badge, sw-button, sw-state-panel);
  tokens only (design ratchet: px-literal went DOWN by one).
- Shell (`shell/sw-app.ts`): while the switch is on, the user configures the system and has not hidden it - (a) a "ברוכים הבאים" row
  under the tabs that stands in for the setup hint (the list starts with the wizard), a "תחילת עבודה" pill in the phone's personal
  menu; (b) the DEFAULT landing of the session moves on to the list once per tab session (`sessionStorage arx.onboarding.landed`); an
  address of its own is never replaced. The row waits for the user's stored choice (no flash).
- `shell/nav.ts` (`TAB_PERMISSIONS`, `INSTALLATION_ONLY_HREFS`) and `shell/lazy-screens.ts`. No new tab in the settings tab row (no
  existing screen moves).
- Settings › General › Support (`screens/system-diagnostics.ts`, new chunk `system-diagnostics-support.ts`): the getting-started
  card (the installation switch, saved at once; this user's state with Show again / Open), Versions (server, interface build, bridge,
  home system - no platform name), the redacted log export (the same `health-log-export` card), and "דיווח על תקלה" (five steps). The
  placeholder card is gone.
- Hebrew + English for every new text (packs `api-system`, `system-a`, `system-b`, `shell`).

### Docs

- `docs/user-guide/he/71-getting-started-support_HE.md` (new; an operator chapter, so `scripts/build_guide.py` checks it for platform
  branding) and its English edition `docs/user-guide/en/71-getting-started-support_EN.md`: the list, daily operation for a shift,
  support (versions, the redacted log, reporting a problem).
- `docs/operations/OPERATOR_GUIDE_HE.md`: status line, chapter 6 (support) rewritten around Settings › Support, new chapter 17.
- `smplwise_vms/DOCS.md` / `DOCS_HE.md`: section "Getting started and support (2.53)". Index row 14א; `GUIDE_ALL_HE.html` rebuilt.

## Files

Backend: `smplwise_vms/backend/smplwise/{startup_steps.py, routers/me.py, routers/settings.py, services/settings_store.py,
services/user_prefs.py, services/backup.py}`; tests `tests/test_onboarding_2530.py` (new), `tests/test_routers_table_2440.py` (the
step order). Frontend: `src/api/onboarding.ts` (new), `src/screens/system-onboarding.ts` (new),
`src/screens/system-diagnostics-support.ts` (new), `src/screens/system-diagnostics.ts`, `src/shell/sw-app.ts`, `src/shell/nav.ts`,
`src/shell/lazy-screens.ts`, `src/api/me-prefs.ts`, `src/api/media.ts`, four English packs; tests `tests/unit-onboarding-2530.spec.ts`,
`tests/pixel-onboarding-2530.spec.ts` (+ baselines), `tests/onboarding-mocks.ts` (new), `tests/unit-diag-tabs-2440.spec.ts` (the
support tab now has a chunk). Docs as above.

Files owned by the 2.52 train rows: none of the WisKey / bridge files. `screens/system-diagnostics.ts` and `shell/sw-app.ts` are
shared, often-edited files (DESIGN-LITERALS-2510 may touch literals there); the edits are local (the support tab body, a few shell
lines).

## Tests

All on the Linux runner (slot B, `~/work/p2520_onb_run.sh`); exit codes and counts as logged.

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit -p tsconfig.json`; `npm run typecheck` | exit 0, 0 errors (r2 at 2bd3fbc3a) |
| ESLint | `npm run lint` | exit 0 |
| Design ratchet | `python scripts/design_ratchet.py` | exit 0, no count above baseline (px-literal 25510, one below) |
| Lazy tags | `node scripts/lazy-tags-check.mjs` (after `vite build`) | exit 0, OK |
| Frontend unit | `playwright -c playwright.unit.config.ts` on 13 files (unit-onboarding-2530, unit-diag-tabs-2440, unit-setup-hint, unit-i18n-en-ratchet-2490, unit-i18n-lang-packs-2443, unit-token-lint, unit-readiness-96, unit-home-lazy-2440, unit-menu-lint, unit-a11y-polished-lint, unit-shell-extract-b-2450, unit-shell-timers, unit-fleet-report) | exit 0, 123 passed (r3 at 0c6213402) |
| New page spec + pixel | `playwright test tests/pixel-onboarding-2530.spec.ts --project=desktop --project=mobile` (`--update-snapshots`, then again without) | exit 0, 15 passed, 1 skipped (the row pixel test is desktop-only) both runs; 7 Linux baselines committed |
| Setup-wizard layout guard + evidence | `LAYOUT_QUICK=1 playwright test tests/layout-setup-wizard.spec.ts tests/evidence-setup-wizard.spec.ts --project=desktop` | exit 0, 12 passed, 2 skipped (r2) |
| Backend | `pytest tests/<file>`, one process per file | test_onboarding_2530 7 passed; test_routers_table_2440 10; test_user_prefs 11; test_ui_settings 20; test_settings_patch_audit_order 8; test_setup_wizard 32; test_i18n_backend_2490 14; test_singletons_registered 4; test_backup 8; test_backup_drill 13; test_backup_offbox 25; test_backup_sensitive 32 - all exit 0 |
| Ruff | `ruff check` on the changed backend files | All checks passed |
| Guide | `python scripts/build_guide.py --check` (PC) | exit 0, up to date, no platform branding in the operator chapters (71 included) |

Note: in run r3 five backend files errored with `database or disk is full` / `could not create numbered dir` (a transient full disk on
the shared runner; the same files passed in r1 at ddadd3413). They were re-run in r4 at 0c6213402 and passed (counts above).

## Not done / NOT_RUN

- No lab, no live install, no device contact (by the brief). The fresh-install path is proven by `test_fresh_production_app_reads_on`
  (a production-shaped app on an empty data directory) and by unit tests of the step; a real first install of the add-on was not run.
- The guide pages carry no screenshots of their own; the screenshots are on the compare page
  (`private/planning/docs-onboarding-2530_compare_2026-11-25.html`, local).
- The full frontend / backend suites were not run (targeted files only, listed above).

## Open questions (recommendation first)

1. Should the landing also happen on an EXISTING installation once an administrator turns the switch on? a) yes, the same rule
   (built this way); b) only the row, never the landing.
2. When every required step is done, should the list switch itself off for everyone? a) no, it stays until hidden or switched off
   (built this way; the summary says "every step is done" and suggests hiding); b) yes, automatically.
3. Should the list also have an entry in the settings tab row? a) no, reached from the row, Settings › Support and the landing (built
   this way, so no existing screen's tab row moves); b) yes, a tab "תחילת עבודה".
