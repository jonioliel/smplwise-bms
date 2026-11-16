# CR-DIAG-DEFECTS-2436 - settings screen defects (code review 2026-11-13, report 06: DIAG-1..4, MSG-1)

Branch `pilot/CR-DIAG-DEFECTS-2436`, from `origin/main` at 665ec8f24 (release 2.43.4). Master plan row: section 3.2, frontend.
Files: `frontend/src/screens/system-diagnostics.ts`, new `frontend/tests/evidence-diagnostics-defects.spec.ts`, this note.
No backend change, no version bump, no migration. The tests were written first.

## What changed

| Finding | Defect | Fix |
|---|---|---|
| DIAG-1 | Every backup action set `this.error`, which the backup tab never drew: a failed create / upload / delete / restore, a wrong restore password, a refused minimum length showed nothing. | The backup tab draws its own error line (`[data-backup-error][role=alert]`, under the saved message); while the restore dialog is open the line is drawn inside the dialog instead (`[data-restore-error][role=alert]`). Every backup action clears it when it starts; opening the restore dialog clears it too. |
| DIAG-2 | `connectedCallback` ran the tab loader (`readTab`) before `loadSettings` set `canEdit`, so an administrator arriving by `?tab=media` saw no streams and by `?tab=ha` no pairing rows until they switched tabs. | After `loadSettings` resolves, if the viewer may edit and the active tab is `media` / `ha`, that tab's loader runs again. |
| DIAG-3 | With a backend the General tab drew a fixed "partial state, HA bridge not connected yet" health row, a button with no handler, a one-option time-zone select, a fixed NVR time profile, a fixed storage policy card and always-on switches. | See "General tab" below. |
| DIAG-4 | One `error` / `message` / `loadFailed` for 13 tabs: a health-report failure appeared on another tab's save row, and a backup-list failure could be named "health report did not load". | `errors` is keyed by tab (`setError` / `errorOf`); `loadFailed` has one entry each for `ha`, `health`, `backup`. A save records its error on the tab that pressed save. The load failures of the health report and the backup list go only to their own state panel (they no longer also fill the save-row error). The settings-read failure keeps a separate flag for the layout check (`settingsFailed`). Removed the dead `isApi()` branches inside the demo-only `renderHealth` body and the unused `events` part of the `health` type. |
| MSG-1 (this file) | `this.message = ...; setTimeout(() => this.message = '', N)` at three sites: an older timer cut a newer message short, and timers fired after disconnect. | `flash(text, ms)` with one stored timer (restarted by each message, cleared on disconnect). The "copied" flag got the same single timer. |

Behaviour on success paths is unchanged. No feature was removed (the integration links on the General tab stay).

## General tab (DIAG-3) - owner decision O11 = a; wording chosen

- **Demo (no backend):** the old markup, unchanged (`renderGeneralDemo` is the previous `renderGeneral` body, literally).
- **With a backend:**
  - "בריאות המערכת" reads `GET /health/summary` (the cheap cached summary the top bar uses; never a device probe) when the
    tab opens. The row (`[data-general-health=<status>]`) says, in the health tab's own words:
    - ok: **"הכל תקין"**, detail **"כל הרכיבים תקינים"**
    - warn: **"יש מה לבדוק"**, error: **"יש תקלה"**; the detail lists only the components that are warn / error, as
      `<label>: <status label>` joined by " · " (status labels from `STATUS_LABEL`: "לתשומת לב", "שגיאה")
    - then " · נבדק HH:MM"
    - while reading: "בודק את מצב המערכת…"; when it fails: "מצב המערכת לא נטען" with the server's reason and "נסו שוב".
    - The dot is green / amber / red / grey by status (the demo's dot keeps its old amber).
    - The button "הרצת דיאגנוסטיקה" now opens the health tab (`בריאות ועבודות`), where the full report runs.
  - "זמן ומיקום": one read-only row with the installation's display zone (`time.zone`), "—" when unset. The fixed NVR time
    profile row is demo only.
  - "מדיניות אחסון (קריאה מה־NVR)": demo only (its values were fixed). NVR-less mode still shows its notice.
  - "אינטגרציות": both rows and their "הגדרה" buttons stay; the always-on go2rtc switch is demo only.

If the owner wants other words, they are all in `renderGeneralHealth` / `renderGeneral`.

## Tests

New `frontend/tests/evidence-diagnostics-defects.spec.ts` (mocked backend, desktop project only, 9 tests): refused backup create
shows `[role=alert]`; refused restore shows the alert in the dialog; `?tab=media` and `?tab=ha` deep links load; healthy summary
shows "הכל תקין" and no fixed sentence, the button opens the health tab; a warn summary names only the warn component; the demo
keeps its sample row; a failed health report does not show on the devices tab; MSG-1 with the page clock (second message still
visible 1.8 s after its save, gone at 2.6 s).

Results (workstation, Windows, `vite build` then
`SW_BASE_URL=http://127.0.0.1:4187/ npx playwright test tests/evidence-diagnostics-defects.spec.ts --project=desktop --workers=1`):

- before the fix (build of 665ec8f24 + the new spec): **8 failed, 1 passed** - each failure at the intended assertion (no
  backup alert, no dialog alert, no streams, no pairing rows, no `data-general-health` twice, a stray `.foot .msg.err` on the
  devices tab, the second message gone 2.8 s after the first save); the demo test passed (the demo row existed already).
- after the fix: **9 passed**.
- `npx tsc --noEmit`: exit 0.

## Pixels

Only the General tab with a backend changes. The pixel baselines that show this screen are demo mode (`visual-matrix`
`settings-diagnostics` is the demo health tab) or other tabs; the demo markup is unchanged, so no baseline image is expected to
change. No committed baseline captures the General tab with a backend, so there was nothing to refresh and `-u` was not run.

Proof run on the runner (1-min load checked below 30 first, one worker), no `-u`:
`py -3.12 private/runner/run_smart.py preview pilot/CR-DIAG-DEFECTS-2436 tests/visual-matrix.spec.ts tests/evidence-diagnostics-defects.spec.ts -g "settings-diagnostics|CR-DIAG-DEFECTS" --workers=1 --machine runner`
at 4ceaaf883: **15 passed, 18 skipped** - the 9 new tests (desktop; tablet / mobile skip by design) and
`visual-matrix` `settings-diagnostics` ready light + dark on desktop, tablet and mobile (6, pixel-stable against the existing
baselines).

## Rollback

Revert the commit; no data or setting is involved.
