# OVERVIEWFIT-297: the service management overview fits the desktop viewport

Branch `pilot/OVERVIEWFIT-297`, cut from `origin/pilot/NOSCROLL-297` (its open item: the overview, `#/tickets/overview`). Owner rule
2026-10-24: a control screen never scrolls on a desktop. Owner option א: two rows of widgets that fit the viewport, the rest on pages
with previous / next, a dot indicator, the keyboard and touch. Layout only: no colours, type or components restyled.

## 1. What changed (`screens/tickets-overview.ts`)

| Part | Change |
|---|---|
| When | `TicketsOverview.pagedMq` = `(min-width: 1181px) and (min-height: 700px)`: a desktop wide enough for the three-column grid and tall enough for two rows. Below that (tablet 1024, phone, a short window) the screen is unchanged: the one grid, the page scrolls. |
| Frame | `.page.paged` takes the screen's height; the header, the departments row and the numbers row stay; the widget pages take what is left (at least 420 px, below that the page scrolls as before). |
| Pages | The widgets keep their order, grid spans (wide = 2, the comparison = 3) and the comparison's place setting; `packPages` (tickets/overview-model.ts) cuts them into pages of two rows the way the grid places them. The last widget of a short row widens to the row's end (`filledSpans`), so a page never shows an empty cell. |
| Track | The pages sit side by side in `.wpages` (CSS scroll-snap, one page per stop). Every widget stays in the document: a swipe, a sideways trackpad scroll, the keyboard focus moving into a widget and the numbers row ("overdue", "waiting for approval") all bring the widget's page on screen. |
| Pager | On the controls row beside "to the board": previous, one dot per page (current = the accent pill, a page holding a red count = a red dot, its label says so), "n/m", next. Arrows in the reading direction (RTL: left = next), Home, End; key presses move at once, clicks scroll smoothly (instant under reduced motion). Hidden when everything fits on one page. |
| Widgets | Each widget's body sits in `.wb`: on a page it fills the card and scrolls inside it (a soft fade at the bottom edge); elsewhere `.wb` is `display: contents`. Folding works as before (a folded widget keeps its header in its cell). |
| Departments | On a desktop the departments segment stays one row and scrolls sideways (fades at its end only when it overflows), so many departments never push the widgets down. |

Settings kept: the folded cards (per viewer), the comparison's place (top / below the numbers / bottom; "top" keeps it above the numbers,
capped at 30% of the window with its table scrolling inside; not measured by the guards, which use the default place), the payments widget appearing only with the payment permissions. There is
no widget edit mode, custom order or hide setting on this screen today; nothing of the kind was added or removed.

## 2. Vertical page overflow in px, before -> after

Probe and skins as NOSCROLL-297 (classic / domus / tesla / crystal; bubble frozen); light and dark gave identical numbers. Data:
`tests/tickets-overview-mocks.ts` (board mock + summary + payments; "worst" = 25 departments with long names, 8x the requests with long
titles, 30 handler rows, 15 approvals of each kind, 20 requests for quotation, 15 instalments each way). Vite dev server, Chromium.

| Case | 1440x900 before (classic / domus / tesla / crystal) | after | 1920x1080 before | after |
|---|---|---|---|---|
| Overview, mock data | 1442 / 1477 / 1489 / 1464 | 0 | 1262 / 1297 / 1309 / 1284 | 0 |
| Overview, worst case | 4497 / 4569 / 4580 / 4555 | 0 | 4306 / 4381 / 4392 / 4367 | 0 |

## 3. Tests

- `layout-noscroll-297.spec.ts`: two more cases (`tickets-overview`, `tickets-overview-worst`) x 1440x900 / 1920x1080, every skin under test, light and dark.
- New `layout-overview-pages-297.spec.ts`: two rows a page, prev / next / dots, RTL arrows + Home / End, a sideways wheel, the numbers row, folding; the worst case (controls row one line, the comparison scrolls inside); tablet and phone keep the one grid with no pager.
- New `unit-overview-pages-297.spec.ts`: `packPages`, `filledSpans`, the pager texts.
- Design pass with the installed skills (owner rule 27.10): emil-design-eng, impeccable (detector: clean), break-ui, mobile-native, ui-ux-pro-max, taste-skill, apple-design; findings and fixes in the agent report.
