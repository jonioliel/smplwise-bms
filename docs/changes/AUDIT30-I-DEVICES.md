# AUDIT30-I-DEVICES - devices, schedules, automations, notification settings (audit round 30, branch I)

Plan: `private/design-system-2026-10-27/round30/system-audit/FIXES.md` sections 0, 1, 10, 13. Branch `pilot/AUDIT30-I-DEVICES`,
cut from `origin/pilot/AUDIT30-BASE` (main v2.43.2 + SYS-AUDIT-QUICKFIX-2437 + NOSCROLL-1366-2437). Frontend only; no device, lab,
NVR or go2rtc access; device control code paths are unchanged (only page frames, dialogs and CSS).

Owner gates: the owner has not answered yet. As instructed, every GATE item is built on the **recommended option א**:
Q3 א (a chosen chip is the light blue wash with blue text), Q9 א (one dialog and one drawer, opaque), Q11 א (settings: one structure,
page + cards, long screens split into tabs). If the owner picks another option, the lead rewrites the item (revert the commit).

## Changes

| Item | Finding | Files | Change |
|---|---|---|---|
| I1 | #3 dark: selected severity pill | `screens/system-notifications.ts` | **No visual change, recorded contradiction** (see below). A comment at the rule points here. |
| I2 | #4 (Q3 א) black chosen chip | `screens/automation-drawer.ts`, `screens/system-automations.ts`, `components/notify-css.ts`; also `screens/devices-schedules.ts`, `screens/devices-automations.ts` (the floor chips, whose black comes from `styles/media-page.ts`, Branch D's file: overridden locally), `screens/schedule-create-dialog.ts` (quick-create chips, solid accent) | `.rc[aria-pressed='true']` / `.chip[aria-pressed='true']` = `--sw-accent-soft` / `--sw-accent-text`, no shadow, 600. |
| I3 | #11 (Q9 א) dialogs | `screens/schedule-create-dialog.ts`, `screens/automation-editor-base.ts`, `screens/devices-schedules.ts`, `screens/devices-automations.ts` | "תזמון חדש" is now `<sw-dialog wide>` (the shared scrim, centred box, spring, focus trap, Escape, focus return; its own overlay, focus trap and key handler removed), opaque: `--sw-surface: var(--sw-surface-solid)`, `--sw-glass-blur: none`. The automation builder sheet: `--sw-surface-solid`, `backdrop-filter: none` (was `blur(40px) saturate(1.8)` over a translucent sheen), radius `--sw-r-xl` (was 28 px), scrim `--sw-overlay` (was an rgba literal), shadow `--sw-shadow-3`; footer opaque. The confirmation dialogs of the two lists are opaque (were the media sheet surface + blur). |
| I4 | #6, #8 page frame | `screens/devices-schedules.ts`, `screens/devices-automations.ts`, `screens/explore-floor-map.ts`, `screens/explore-presence.ts` | Each screen renders `<sw-page>`: the title is sw-page's H1 on the `--sw-h1` tokens (no local 30/700 H1), the actions sit at the end of its title row (view switch; presence's refresh / places; the map's tools), crumbs in its crumbs slot (map), subtitle in `subheading` (presence). Schedules / automations: the floor chips and the toolbar are the first rows of the body; the title row no longer sticks/compacts; trash / review use sw-page's shared back control (`backHref`). Floor map: `flush wide`, the counts line stays a light-DOM row so the short-landscape rule can still drop it; short landscape sets `--sw-h1: var(--sw-fs-lg)` and caps the tools at 60vw. |
| I5 | #5 area page scroll | `screens/devices-area.ts` | No code change here: NOSCROLL-1366-2437 (in the base) already pages the card region. Re-measured below; regression test added. |
| I6 | #18 (Q11 א) 6,699 px settings page | `screens/system-notifications.ts` | The nine existing sections are `<sw-tabs variant="underline">` above ONE section at every width (the side rail, its IntersectionObserver and the smooth scroll are gone; the phone already showed one section at a time). `?section=<id>` still selects the tab. The page frame is `<sw-page heading="התראות" crumbs="מערכת">`. Saving is unchanged (each change saves at once; the mail form keeps its own button). |

No new literals (colours, radii, sizes, durations all `--sw-*` tokens), no new native `select` / `table` / `dialog` / `h1`
(two native `<h1>` and one `<div class="box">` overlay were removed; the builder's existing native `<dialog>` stays, see below).

### Contradictions recorded

1. **I1 (Blue Wash on the severity pill) vs. DARK-SEG-ALL-2380.** The severity picker is a segmented control on a track. Measured in
   dark on the base (SYS-AUDIT-QUICKFIX-2437): label 15.6:1, key 11.3:1 from the track - readable. The Blue Wash fill on the dark track
   is about 1.3:1 from the track, under the owner-approved rule "the chosen key at least 3:1 from its track", which
   `tests/evidence-sys-audit-quickfix-2437.spec.ts` guards. The owner rule wins over the plan: left as it is. Question for the owner.
2. **I3 (host the builder in `<sw-dialog size="lg">`).** `sw-dialog` has no `size` property (it has `wide` 720 / `xl` 1120 / `fit`) and
   closes itself on Escape / ✕ / scrim with no cancelable hook, while the builder must ask "לצאת בלי לשמור?" before closing a dirty draft
   (`onSheetCancel`). `components/sw-dialog.ts` is in no branch's "Owns" list, so the hook cannot be added here. The builder keeps its
   native modal `<dialog>` and became opaque on the dialog tokens (the visible part of #11). "תזמון חדש" uses `wide` instead of `size="lg"`.

## Measurements (audit probe, `tools/shoot.mjs` + `analyze.mjs` run from a copy of the folder)

Before = the audit's own numbers (v2.43.1, `data/summary.json`; area at 1366 from FIXES I5). After = this branch, built with
`npx vite build`, served by `vite preview` on a free local port, shot with `node tools/shoot.mjs --base <preview> --routes
area,schedules,automations,floor,presence,s-notifications --wait 2600` and again with `--vps contract --schemes light` (1366x768), then
`node tools/analyze.mjs`, all from a copy of the audit folder (the owner's copy untouched).

| Screen | H1 (fs/fw) before -> after | sw-page | Page scroll 1440 / 1024 / 390 before -> after | 1366x768 after | Contrast L / D | Dialog before -> after |
|---|---|---|---|---|---|---|
| Area `/devices/areas/living` | 18/600 -> 18/600 | 1 -> 1 | D100 T1301 P1830 -> **D0** T1301 P1830 | **0** (was 232) | 0 / 0 | - |
| Schedules | 30/800 -> 30/800 | **0 -> 1** | 0 / 0 / 0 -> 0 / 0 / 0 | 0 | 0 / 0 | own `div` overlay, bg `rgba(255,255,255,.64)`, 760 px -> **`sw-dialog`**, bg `rgb(255,255,255)`, 722 px, no blur |
| Automations | 30/800 -> 30/800 | **0 -> 1** | 0 / 0 / 0 -> 0 / 0 / 0 | 0 | 0 / 0 | builder `dialog`, bg 92 % alpha, `blur(40px) saturate(1.8)`, r 28 -> bg `rgb(255,255,255)`, **no blur**, r 22 (`--sw-r-xl`) |
| Floor map | 30/**700** -> 30/800 (the `--sw-h1` tokens) | **0 -> 1** | 0 / 0 / 0 -> 0 / 0 / 0 | 0 | 0 / 0 | - |
| Presence | 30/**700** -> 30/800 | **0 -> 1** | 0 / 0 / 0 -> 0 / 0 / 0 | 0 | 0 / 0 | - |
| Notification settings | 30/800 -> 30/800 | **0 -> 1** | **D6699** T5852 P8386 -> **D1422** T5860 P8394 (the longest tab, "מקורות"; tablet and phone already showed one section) | 1554 (settings are the one screen allowed to scroll) | 0 / 0 | - |

Native controls on the notification settings: `select` 9 -> 8 visible (one tab at a time), `table` 1 -> 1 (existing, Branch B's
sw-table). Off-scale type 0 % on all six. Screenshots (all six screens, 1440 / 1024 / 390, light and dark, 1366 light, the dialogs):
`docs/design/evidence/AUDIT30-I-DEVICES/after/`.

## Tests

TESTS_TABLE

## Skills (SKILLS_BRIEF.md)

- `ui-ux-pro-max`: `search.py "settings page tabs modal dialog consistency" --domain ux` -> `docs/design/evidence/AUDIT30-I-DEVICES/inspect/ui-ux-pro-max.txt`
  (taken: "active state highlighted with an underline", "focus visible inside modals"; rejected: the image-optimisation hit, not relevant).
- `impeccable`: `impeccable.cmd detect --json` on the eight changed source files -> `inspect/impeccable-detect-source.txt` (no findings).
- `emil-design-eng`: invoked; before/after table in `inspect/emil-design-eng.txt` (modal stays centred, no blur over 20 px, no animation on
  the frequent tab switch).

## Known limits

- The quick-create dialog is centred on a phone too (it was a bottom sheet): the shared dialog has no sheet form.
- The schedules / automations title row no longer compacts on scroll (the page does not scroll at the control sizes since NOSCROLL).
- `#/system/notifications` keeps the existing native `<table class="qmx">` and the recipient `<select>`s (not new; Branch B's sw-table).
- Not measured: loading / empty / error states per screen, the automation drawer's chips in the browser (covered by a source test).

## Rollback

Revert the merge commit. No data, settings or API change is involved.
