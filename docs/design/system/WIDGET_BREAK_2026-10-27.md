# Widget break test, 2026-10-27 (WIDGETBREAK-297)

Scope: the home widgets (all except the elevators card, which ELEVFIX-297 owns) and the device tiles / security strip / camera and media rows of the
area screen, fed worst-case data with the `break-ui` method. Fake data only; no device, no backend.

How it was run (all on the Ubuntu runner, Vite dev server, `--project=desktop` and `--project=mobile`):

- `frontend/tests/widget-break-harness/` mounts ONE `<home-widgets>` card at a time in a cell of a chosen width. Widgets: clock, weather, shabbat,
  alarm, quick actions, agenda, launcher, temperature, generators, doors, notices. Sizes s / m / l. Cell widths 240 / 280 / 320 / 360 px.
  Datasets: normal, worst, empty (the empty case is drawn in edit mode so the "why is it not shown" ghost cards are measured too).
- `frontend/tests/layout-widgets-break-297.spec.ts` asserts, for every selectable skin (classic, domus, tesla, crystal) in light and dark: nothing leaves its
  card, no text is cut without an ellipsis, the card does not scroll sideways, no page error.
- `frontend/tests/layout-devices-break-297.spec.ts` renders the real area screen (mocked backend of `bubble-mocks.ts`) with every entity renamed
  from the worst-case list and asserts no horizontal scroll / escape / clipping at 320, 360, 390, 768 and 1280 px.
- Worst-case values used: 87-char Hebrew name, 60-char and 80-char unbreakable strings, mixed Hebrew / English / digits, Arabic, Russian, a single letter, emoji
  sequences, an e-mail-shaped name, a sensor value of 1,234,567.89 kWh, a 100 percent humidity / 1086 hPa / -40 degree weather, 123,456 open alerts,
  25 temperature units, 14 doors, 4 notices, 7 forecast days with 118 / -45 degree values.
- Note: the home-screen custom widget title is limited to 30 characters (`LABEL_MAX`); the harness uses 87 characters on purpose (beyond the schema), and it still holds.

Result of the final run: both specs 32 / 32 passed (8 skin x scheme cases per project, both projects). Before the fixes the first run failed for the rows marked "fixed" below.

Screenshots (not in git): `private/review/widgetbreak-2026-10-27/`

- `final/shots/<widget>-<size>-<width>-<skin>-<scheme>.png` (worst-case data, 240 and 360 px, after the fixes), 528 files
- `final/dshots/area-<width>-<skin>-<scheme>.png` (area screen, after the fixes), 40 files
- `round1/shots/` the widgets BEFORE the fixes, e.g. `round1/shots/clock-m-240-light.png`, `shabbat-m-240-light.png`, `weather-l-240-light.png`
- `devices-before/dshots/area-390-light.png`, `area-1280-light.png` the area screen BEFORE the fixes

## Findings

| Widget / card | Worst case | Result | Status |
| --- | --- | --- | --- |
| Clock, Hebrew date line | the date sensor state is a 90-character string (a wrong sensor picked, or a long holiday text): the line did not wrap and pushed the card content to 620 px | text ran out of the card | FIXED: ellipsis on the line, full text as tooltip (`home-widgets.ts` `.d2`) |
| Shabbat, holiday and date lines | holiday sensor state with a 60-character unbreakable token | text cut by the card edge | FIXED: `overflow-wrap:anywhere` on `.sub` |
| Weather large card, forecast row | 5 day columns at 240 px with highs of 118 and lows of -45 | the high and the low crossed into the neighbouring day | FIXED: high and low wrap (stack) when the column is narrow (`.fc .hl`) |
| All widgets, edit mode (also the ghost "not shown" cards) | card 240 px wide | the edit control bar (grip, size, settings, hide, arrows) stuck out 13 to 15 px | FIXED: the bar wraps (`.wg-e`) |
| Area screen, security strip (locks, alarm, camera, door chips) | device names of 60 to 80 unbreakable characters | the strip was 823 px wide in a 320 px viewport, the whole page scrolled sideways | FIXED: name ellipsis inside the chip, full name as tooltip (`devices-area.ts` `.sec-chip`) |
| Area screen, media rows | media title of 90 characters with a 60-character unbreakable token | the title ran out of the row and the page | FIXED: `.row .d` wraps anywhere |
| Clock (all sizes), weather card/small/medium, alarm, quick actions, agenda, launcher, temperature, generators, doors, notices | worst, normal and empty data, all sizes, 240 to 360 px | nothing leaves the card, long names end in an ellipsis or wrap | PASS, no change |
| Area screen, light / climate / cover / sensor tiles | names of 80 characters, emoji, Arabic, Russian, one letter, sensor value 1,234,567.89 | tile names clamp to two lines with an ellipsis; values fit | PASS, no change |
| Area screen, cover row, the kind suffix ("· roller shutter") after a very long cover name | 80-character name | the kind text is cut off by the name's ellipsis (the row tooltip has it); the guard sees the hidden span | OPEN (design): decide whether the kind should survive a long name (for example, put it on the second line) |
| Temperature large card, 25 units at 240 px | 12 rows plus 25 dots | card about 590 px tall; on a home screen that must fit the viewport it pushes the other widgets down | OPEN (design): cap the dots, or scroll inside the card, or show "+13" |
| Doors widget, 14 doors with problems | 4 rows plus the emergency button | fits, but the heading of a long custom title takes four lines at 240 px | OPEN (design): single-line title with ellipsis for every widget heading (the custom title is limited to 30 characters in the product, so low priority) |
| Weather card, long weather entity name | 87 characters | the entity name next to the title is cut with an ellipsis, the title wraps to several lines | OPEN (design): same decision as the heading above |

## Not covered (honest list)

- Elevators widget (owner: ELEVFIX-297).
- Media widget (`mediaCard`): it needs the media backend (screens / players); it has `unit-media-layout.spec.ts` and `layout-media-admin-list.spec.ts` already, not re-run.
- The camera tile as a live video element, the tickets widgets and pages, the schedules grid, electricity meter cards and the bus-times slide of the notice TV
  were not given a new worst-case pass here; they each already have layout specs (`layout-tickets-*.spec.ts`, `layout-schedules-parity.spec.ts`, `layout-electricity-meters.spec.ts`,
  `layout-bustimes-overlap-295.spec.ts`, `layout-camera-image-health.spec.ts`). A follow-up can reuse `tests/breakui-worst.ts` for those.
- The frozen bubble skin was not tested (the registry skips it; the bubble clock / weather tile styles are therefore not measured).
- Pixel baselines were not touched or created; every assertion is geometric.

## Running it

```
SW_BASE_URL=http://127.0.0.1:<vite port>/ npx playwright test tests/layout-widgets-break-297.spec.ts tests/layout-devices-break-297.spec.ts --project=desktop
```

`WB_SHOTS=<dir>` / `DB_SHOTS=<dir>` write the screenshots. About 6 minutes for the desktop project on the runner.
