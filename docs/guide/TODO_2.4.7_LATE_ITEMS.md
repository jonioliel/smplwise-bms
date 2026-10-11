# Guide TODO for 2.4.7 - what is still missing

Branch `pilot/GUIDE-2.4.7b` (from `integ/247` 3783ea56). The first guide pass (7e2a4715) left four late items; they are now written
(`22-realistic-3d_HE.md`, `20-map`, `31-events`, `45-wall-mode`, `80-settings`, `11-whats-new-24x`, `91-known-limits`).

## Written, but depends on a branch that is not in `integ/247` yet

`origin/pilot/ST7-s5-kiosk` (S5-B) is still being finished. The guide describes what its CR-029 notes (`CR-029-ST7-S5B-NOTES.md`) and tests state:
the idle swap to the prepared still with zero frames, the wake rules (input, a device-state change, the screen becoming visible; a walk holds
it awake), the hidden-tab pause, and the per-screen "מפה" section in Settings > מסכי קיר (plan view, 3D quality, idle time, "show the map on
a portrait wall", the wall's theme, no doors / presence / temperatures). Places: `22-realistic-3d_HE.md` ("מסך קיר: מנוחה ותמונה מוכנה", limits),
`45-wall-mode_HE.md` ("מפת הקומה בטאבלט קיר"), `11-whats-new-24x_HE.md`, `91-known-limits_HE.md`.
**If S5-B does not merge into 2.4.7, remove those passages** (the dial "מעבר לתמונה מוכנה במסך קיר" exists on `integ/247` but does nothing without it).
The 2.4.7 release notes still list "the kiosk idle swap timer and a plan pane inside the wall display" under known limits.

## Deliberately not written (unclear or not built)

- "Route when the screen is idle" (a tour while idle): not built in S5-B. The walk bar's own "מסלול" is written.
- The browser-pinned wall options by route (`?display=wall&plan=stills&quality=...&idle=...`): only `?display=wall` / `?display=desk` are in the guide.
- Pointer lock inside the product frame: the S5-B gate (falls back to drag with a note) is not described beyond "stays on drag where refused"; not verified on the real Ingress page.
- A "deep idle" that frees the GPU context; real-device temperature, battery and wake time (NOT_RUN in the notes).
- The installation idle-time row in Settings > Video and media ("מסך קיר - מעבר לתמונה מוכנה") that S5-B adds: the guide points to the same dial in the "תצוגה ריאליסטית" card, which exists on `integ/247`.

## Still open from the first pass

1. Where "הכן תמונות ותאורה" lives: the release notes say the plan editor; the code puts it in the floor map's 3D "שכבות" panel. The guide follows the code.
2. The personal "איכות" dial in the new card vs "מצב התצוגה שלי": the guide states only the precedence read in `sw-plan-3d.ts`; confirm with the owner.
3. No new screenshots (no running 2.4.7 build); `screens.json` untouched. Candidates: the bar with the time pill, the touch walk sheet, the north card,
   "עמדות סיור", the "תצוגה ריאליסטית" card, the bill's "קריאת פתיחה" card, a wall display idling on its still.
4. `95-troubleshooting_HE.md` item 17 quotes the server's 503 text; replace it if the UI words that error differently.
