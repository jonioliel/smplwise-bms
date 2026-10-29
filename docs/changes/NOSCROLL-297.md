# NOSCROLL-297: the remaining desktop control screens fit the viewport

Branch `pilot/NOSCROLL-297`, cut from `origin/main` (v2.23.2, `1b0ddd85c`). Owner rule 2026-10-24: a control screen never scrolls on
a desktop; it fits the viewport (reference 1440x900 and 1920x1080). Input: the design audit of 2026-10-27 (`docs/design/system/AUDIT_2026-10-27.md`
on `pilot/DESIGNAUDIT-297`, finding P1-4), which still measured page scroll on four desktop screens: the live overview, the camera wall,
the electricity meters and the service management screens. Layout only: no colours, type, radii or components were restyled; the
multimedia screens, the notice board, the elevators and the bubble skin (frozen) are not touched.

## 1. What changed

| Screen | Change (desktop only; phone and tablet unchanged unless said) |
|---|---|
| Live overview (`screens/live-overview.ts`) | From 1024 px the page takes the screen's height; the last row (recent events, "needs attention") takes what is left and each list scrolls inside its own card. New opt-in `sw-card fill` (`components/sw-card.ts`): the card takes the height it is given and its body scrolls; off by default, no other card changes. Below 200 px of room the row keeps 200 px and the page scrolls (a very short window). |
| Camera wall (`screens/live-wall.ts`) | The demo wall now uses the real wall's best fit (tiles as big as fit the window, from 768 px). The real wall (API) already fitted; it is measured too (9 cameras and all 24). |
| Electricity meters (`screens/infra-electricity.ts`, `screens/electricity/page-meters.ts`) | From 900 px the meters page takes the height left under the tab rows; the areas tree and the meters list fill the row under the tiles; the table (header row sticky), the cards view and the tree scroll inside their own boxes. Accounts / bills / customers pages keep the page scroll (documents). Below 240 px of room the page scrolls. |
| Service management lists (`screens/tickets-list.ts`) | From 1024 px the screen no longer scrolls: below the header the numbers and the cards scroll in their own region (`.scr`), the controls stay in place. The view switch moves onto the title row (one control row less above the cards). The compact title still follows the region's scroll. Below 1024 px `.scr` is `display: contents`: the page scrolls as before. |
| Manager board (`screens/tickets-board.ts`) | Same region model as the lists (the today row, the tree and the groups scroll in `.scr`; the tree stays sticky beside the cards). The departments segment and the view switch move onto the title row: two control rows (title / departments + states + search / new + view) become title + departments + view / states + search + filter + new. |

Every option stays where it was (the same buttons, the same settings); nothing was removed or hidden.

## 2. Vertical page overflow in px, before -> after

Overflow = max(scrollHeight - clientHeight) of the document, the shell's `main`, the screen's wrapper and the screen element (the
NOSCROLL-295 probe). Skins under test: classic / crystal / domus / tesla (bubble frozen); light and dark gave identical numbers.
Data: demo fixtures (live overview, demo wall), the existing mock layers (wall with 24 cameras, meters, tickets, board). Measured on
the workstation against the Vite dev server (Chromium).

| Screen | 1440x900 before (classic / crystal / domus / tesla) | 1440x900 after | 1920x1080 before | 1920x1080 after |
|---|---|---|---|---|
| Live overview | 34 / 46 / 58 / 85 | 0 | 0 | 0 |
| Camera wall, demo | 23 / 28 / 41 / 50 | 0 | 113 / 118 / 131 / 140 | 0 |
| Camera wall, 9 and all cameras (API mock) | 0 | 0 | 0 | 0 |
| Electricity meters | 71 / 79 / 86 / 107 | 0 | 0 | 0 |
| Service management, mine | 222 / 205 / 204 / 217 | 0 | not measured with the mock (demo data: 0) | 0 |
| Service management, all | 128 / 110 / 110 / 121 | 0 | not measured with the mock (demo data: 0) | 0 |
| Manager board | 1098 / 1152 / 1161 / 1140 | 0 | demo data: 406 / 463 / 473 / 484 | 0 |

Screenshots before / after (fake data): `private/review/noscroll-297/` (untracked).

## 3. Not in scope / open

- **Service management overview** (`#/tickets/overview`, a dashboard of widgets): 889-927 px at 1440x900, 709-747 px at 1920x1080. It is
  a dashboard, not a list, and fitting it means choosing which widgets give way: an owner decision (see the agent report). Done in OVERVIEWFIT-297 (owner option א: two rows a page, the rest on pages), see `docs/changes/OVERVIEWFIT-297.md`.
- Requests for quotation, handlers and vendors, the tickets calendar and table views: not measured here.
- Phone (390 px): out of scope (the rule is for desktops); the phone layouts are unchanged.
- Pixel baseline `live-wall-ready-*-{desktop,tablet}-linux.png` (visual matrix, demo wall) is expected to change with the demo wall's
  fit and must be re-accepted on the runner.

## 4. Tests

- New `frontend/tests/layout-noscroll-297.spec.ts`: 8 cases x 2 viewports, each looping the 4 skins x light / dark (desktop project only).
  `NOSCROLL_LOG=1` prints every measurement, `NOSCROLL_SHOTS=<dir>` saves screenshots.
- `evidence-tickets-ui4.spec.ts` (compact title): scrolls the cards region on a desktop, the page on a phone.
- Results: see the agent report of this branch (what ran where, with exit codes).
