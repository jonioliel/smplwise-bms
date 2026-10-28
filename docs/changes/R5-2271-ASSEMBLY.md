# R5 2.27.1 assembly

Branch: release/2271-assembly. Base: release/2270-r5-fixes @ 658e9eb1d.

## Merges (real --no-ff)
1. pilot/R5-SECURITY-WISKEY-297 (299af8209): clean, no conflicts. 16 files (security-alarm, system-alarm,
   system-presence, system-security-wiskey, wiskey-* screens, r5-security-shoot spec).
2. pilot/USERMENU-FIX-2271 (43ba53c59): clean, no conflicts. sw-user-menu.ts and unit-user-menu-sections.spec.ts.

## Shared-file decisions
No file was touched by more than one side, so no conflict and no manual resolution was needed. The two
branches share no files with each other; both merged onto the R5 base unchanged. R5 look and the frozen UI
structure (menus, tabs, logos, titles, order of controls) are therefore exactly as each approved branch
left them. No snapshots were updated.

## Base movement
release/2270-r5-fixes moved from 658e9eb1d to 95137aa7d while assembling (sw-camera-tile.ts, devices-schedules.ts).
Re-merged with --no-ff, clean, no overlap with the two merged branches.

## Second round: OVERVIEWFIT-297 and DESIGNAUDIT-297
3. pilot/OVERVIEWFIT-297 (d0115acbd, plus 92b67164d NOSCROLL-297 change note): real --no-ff merge. Both commits
   are clean and relevant (the branch's third commit 8d1e4b064 was already in the base). One conflict in
   frontend/src/screens/tickets-overview.ts, the prefers-reduced-motion block: both sides added a rule on adjacent lines.
   Decision: keep both (POLISH-CONTROL-297 transition reset and the pager `.pd i, .pgb` transition reset). No other
   change; the R5 look and the frozen structure are untouched (the pager appears only from 1181x700 desktop).
4. pilot/DESIGNAUDIT-297 (9828f7d1d): real --no-ff merge, clean; two docs under
   private/design-system-2026-10-27/audit, no product code.

## Checks
tsc --noEmit: exit 0, 0 errors. Node unit specs (playwright.unit.config.ts) for the overview files, including
unit-overview-pages-297: 162 passed. Layout (browser) specs shipped with OVERVIEWFIT are NOT_RUN. No runner, no gate.

## Snapshots
No spec with toHaveScreenshot/visual-matrix baselines references the service overview, so no snapshot spec is
expected to change pixels. No snapshots updated.

## Base movement
release/2270-r5-fixes is at 95137aa7d, release/2270-r5-final at 0c5796563 (not merged, reported only).
