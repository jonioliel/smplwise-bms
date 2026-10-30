# PRESENCE-DESIGN-2300 - building presence: design polish

Branch `pilot/PRESENCE-DESIGN-2300` (from `release/2280-train`). Scope: the home widget "נוכחות במבנה", its settings page
(`system-building-presence`) and their states. No backend, API or setting changed; the module stays OFF by default and the area pop-up
is untouched (no presence line there today; see owner question 2).

## What changed and why (per skill)

| Skill | Finding | Change |
| --- | --- | --- |
| impeccable (polish, design-system drift) | The widget head was its own grey 13 px line, unlike every R5 widget head (`.wg-h`: heading ink, bold, accent icon). | The head is the shared `.wg-h`; the map link sits at its end. |
| impeccable (misleading state) | A failed first read of the settings drew the master switch as "המעקב כבוי" and left it clickable. | A failed read is an error state panel with "נסה שוב"; the switch is not drawn until the real value is known. |
| impeccable (missing state) | The settings page was blank while loading. | A compact loading state panel (editors only; a viewer still sees nothing). |
| impeccable craft floor | The row action was a "···" text glyph. | A drawn `more` icon, with focus ring and press feedback. |
| break-ui | A long room name pushed the room's state out of the chip ("חדר הישיבות הגדול…" with no "פעיל"); colour alone told active rooms apart. | A chip is [dot][name][state]: the name truncates (full text in the tooltip), the state never does; active rooms get the settings page's soft-green state chip; unknown keeps a dashed outline and a hollow dot (shape, not colour only). |
| break-ui | Latin room names jumped sides inside the Hebrew line. | Names in `<bdi>`; sensor names in settings get `dir="auto"`. |
| break-ui | One room read "כל 1 החדרים ריקים"; no room read "כל 0 החדרים ריקים"; 1284 / 500 / 492 had no group separator. | Words for 0 and 1 rooms (Hebrew and English), counts through `Intl.NumberFormat` ("1,284", "ועוד 1,492"). Unit test added. |
| mobile-native / ui-ux-pro-max (touch) | Row "more" button 32 px, segmented buttons ~28 px, inputs under 16 px on phones. | On a coarse pointer: 44 px "more", 40 px segments, 16 px inputs (no focus zoom); tap highlight off, `touch-action: manipulation`; hover styles gated by `(hover: hover) and (pointer: fine)`. |
| emil-design-eng / animate / apple-design | Motion should only confirm state, never decorate a screen seen all day. | Lamp and chip colours cross-fade with the existing `--sw-t-state` token; pressed buttons scale to 0.96 (120 ms ease-out). Both only under `prefers-reduced-motion: no-preference`. No entrance animation. |
| design-taste-frontend (app screen rules) | Keep quiet borders and existing tokens; no new colours, glows or gradients. | Only existing tokens (`--sw-success-soft`, `--sw-success-text`, `--sw-text-*`, `--sw-border`). |

No new behaviour was added, so no new setting was needed. RTL first; the map link points to the map, which is never mirrored.

## Evidence

- Screenshots: `docs/evidence/PRESENCE-DESIGN-2300/before/` and `after/` - desktop 1440, tablet 1024, phone 390; light and dark;
  home states ready (s/m/l), empty, unknown, one room, 500-room worst case, error, loading (no card while the first answer is pending,
  by design); settings states loading, error, off, no sensors, ready.
- Harness: `frontend/tests/presence-design-harness/` (Vite dev server, invented data, no backend).
- Spec: `frontend/tests/evidence-presence-design-2300.spec.ts` (`PD_SHOTS=<dir>` writes the screenshots).

## Tests (this workstation)

- `npx tsc --noEmit` - pass.
- `npx playwright test -c playwright.unit.config.ts tests/unit-building-presence-logic.spec.ts` - 16 passed.
- `SW_BASE_URL=http://127.0.0.1:5231/ npx playwright test tests/evidence-presence-design-2300.spec.ts` - 12 passed (3 projects x 2 schemes x 2).
- `SW_BASE_URL=... npx playwright test tests/layout-widgets-break-297.spec.ts --project=desktop` - 8 passed (all skins, light and dark).
- NOT_RUN: `tests/evidence-presence-2280-layout.spec.ts` (needs `SW_LIVE=1` and the devices fixture backend); pixel baselines
  (visual matrix) on the runner - not run (release gate in progress).

## Rollback

Revert the branch commits; no data, API or settings migration is involved.
