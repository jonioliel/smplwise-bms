# Guide TODO for 2.4.7 - items that land late, or that the guide pages depend on

Branch `pilot/GUIDE-2.4.7`. The guide text (Hebrew, `docs/user-guide/he/`) was written from `origin/integ/247`, `origin/pilot/ST7-ui`,
`origin/pilot/BILL-start-reading` and `origin/pilot/SEC246-fixes` only. Nothing below is described in the guide yet.

## A. Not on the branches yet - write after they land

| # | Item | Where it belongs | Notes for the writer |
|---|---|---|---|
| 1 | Touch controls for the walk: the on-screen joystick (left half moves, right half looks) and tap-to-walk | `22-realistic-3d_HE.md` ("סיור בגובה עין"), `20-map_HE.md` | `22` describes keyboard and mouse only. The 2.4.7 release notes already mention the joystick; the guide intentionally does not. Also decide whether pinch / FOV, long-press on a device and a visible stick are shipped. |
| 2 | Kiosk idle-to-still: after N seconds without change a wall display swaps to the prepared still and stops drawing | `45-wall-mode_HE.md` (map section), `22-realistic-3d_HE.md` (wall display step), `80-settings_HE.md` | The installation dial "מעבר לתמונה מוכנה במסך קיר" (`kiosk_idle_s`: never / 10 s / 30 s / 2 min / 10 min, default 30 s) is a row of the "תצוגה ריאליסטית" card (installation target) but is **deliberately left out** of the card table in `80-settings_HE.md` until the timer exists. Add the row, the explanation and the `?display=wall` note together. |
| 3 | History map and event page at level 3 | `20-map_HE.md`, `31-events_HE.md`, `22-realistic-3d_HE.md` | The release notes say they draw level 3 with the level-2 structure. Nothing written. |
| 4 | Sun location taken from the system location | `80-settings_HE.md` (site location row), `22-realistic-3d_HE.md` step 9, `21-plan-studio_HE.md` (north card note), glossary | Today an empty "מיקום האתר" means central Israel (32.0 / 34.8) and the time popover and the north card say so. When the system location is read, change those sentences ("ריק: המערכת משתמשת במיקום ברירת המחדל שלה") and the "מיקום האתר לא הוגדר" notes. |

## B. Things the written guide depends on - verify when the branches merge

1. **`pilot/ST7-ui` must be in 2.4.7.** `21-plan-studio_HE.md` (section "חומרים, צפון ועמדות סיור"), the "כרטיס תצוגה ריאליסטית" section of
   `80-settings_HE.md`, steps 24-27 of `22-realistic-3d_HE.md` and the matching rows of `11-whats-new-24x_HE.md` come from that branch.
   `docs/release/2.4.7-RELEASE-NOTES.md` on `integ/247` still says the editor controls and the settings page "come in a later release" - that
   limit has to go (or the guide sections have to come out) before release.
2. The ST7-ui settings card leaves a slot for the stills rows (`renderStillsSlot`); the guide places the stills rows in
   הגדרות › כללי › וידאו ומדיה, as on `integ/247`. If the integration merge moves them into the card, move the row text in `80-settings_HE.md`.
3. **Where the button "הכן תמונות ותאורה" lives.** The release notes say "in the plan editor". In the code of `integ/247`
   (`explore-floor-map.ts`, `renderSkinExport`) it is in the **floor map, 3D view, "שכבות" panel, next to the control-images button**, editors only,
   hidden on a phone while "הסתרת כפתור תמונות בקרה בנייד" is on. The guide follows the code. Fix the release notes or the code, then re-check `22` step 19 and `21`.
4. **"Click the floor to walk there"** (release notes) is implemented for a mouse click (`onViewSelect` -> `walkTo`) and the minimap teleports; the
   guide says so. There is no separate mouse "hold to walk".
5. Personal "quality" dial in the new card vs "מצב התצוגה שלי" (`plan.quality` in `/me/prefs`): the guide only states the precedence seen in
   `sw-plan-3d.ts` (the choice made in the 3D bar, then the `plan.view` quality dial when fixed, then the installation `plan.quality`). Confirm with the owner that two places for one choice is intended.
6. No new screenshots were added (no running 2.4.7 build; plan drawings are not published). `screens.json` was not touched. Candidate new screens:
   realistic 3D bar with the time pill, the walk bar and minimap, the "עמדות סיור" tool, the "צפון" card, the "תצוגה ריאליסטית" settings card,
   the bill's "קריאת פתיחה" card. Capture on the runner with demo data (plans stay demo screenshots).
7. SEC246: the "commands recorded before they are sent" text (`95-troubleshooting_HE.md` item 17) quotes the 503 message of the server. If the
   UI shows its own wording for that error, replace the quote.
