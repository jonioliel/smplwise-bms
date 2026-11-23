# PHONE-SKIP-DESKTOP-SHOTS-2490

Owner Q21 = yes, file by file: the Playwright phone project (`mobile`, 390x844) does not run spec files that only take
desktop-size evidence or assert the desktop layout.

## What changed
- `frontend/tests/phone-skip-list.json`: the single explicit list, one reason per file (25 files).
- `frontend/playwright.config.ts`: the `mobile` project gets `testIgnore` from that list (plus the existing archive pattern,
  because a project-level `testIgnore` replaces the global one).
- `frontend/scripts/check-phone-skip-list.mjs` (`npm run check:phone-skip`): fails when a listed file no longer exists or has no reason.
- No test assertion, test body or baseline was changed. Desktop and tablet projects are untouched.

## Decision per file
- 18 files already skipped themselves at run time on every non-desktop project (`test.beforeEach(... project.name !== 'desktop')`):
  notice board / TV pages and their pixel sets. Listed so the phone project no longer loads and reports them.
- 2 files already skipped below 1200 px (`evidence-uxrest-295`, `evidence-uxrest2-295`), 1 already skipped on touch
  (`evidence-shared-space-stations`).
- 4 files that really ran on the phone project and only repeat desktop-size evidence: `evidence-local-user-create-2438` (own 1440x900 context),
  `evidence-event-structure`, `evidence-shared-space`, `evidence-plan-studio-stairs` (live evidence with a fixed 1000 px probe; the plan editor
  is not offered on a phone).
- Kept on the phone project on purpose (they set 390 widths or check phone behaviour): e.g. `evidence-media-player-panel`,
  `evidence-protected-switches`, `evidence-system-multimedia`, `evidence-audit30g-video`, `evidence-nvr-cameras`, `layout-devices-break-297`,
  `evidence-sys-audit-quickfix-2437`, `evidence-levels-setting`, `evidence-camsuggest-live`.

## Phone test count (`npx playwright test --list --project=mobile`, static count, includes tests that skip at run time)
- before: 12811 tests in 1188 files
- after: 12374 tests in 1163 files (-437 tests, -25 files)
- desktop project after: 12811 tests in 1188 files (unchanged)

## Tests run
- `npm run check:phone-skip`: ok, 25 files (PC).
- Server slot B sample run of the phone project: see the report below.

## Follow-up: tablet project
The 20 listed files that already skipped themselves on every non-desktop project (18 notice-board / TV files with the
`project.name !== 'desktop'` hook, plus the two `evidence-uxrest*` files that skip below 1200 px) are also ignored by the `tablet` project
(1024 px). They are named in the `tabletAlso` array of `phone-skip-list.json`; the guard checks each is also in `files` and exists.
- tablet before: 12811 tests in 1188 files
- tablet after: 12385 tests in 1168 files (-426 tests, -20 files)
- phone after: 12374 tests in 1163 files (unchanged by the follow-up)
- `npm run check:phone-skip`: ok, 25 files, 20 also skipped on tablet (PC).
