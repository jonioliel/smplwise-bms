# PRESENCE-COUNT-2400 - "count and names", the default home presence card

Branch `pilot/PRESENCE-COUNT-2400` (from `origin/release/2400-train`), target 2.40.0. No version bump, no tag, no migration (the setting
lives in the existing JSON key `presence.building.config`).

Source: the owner's answers to round 18, Q25-28, on the round-16 mockup
(`private/design-system-2026-10-27/round16-presence/index.html`, its pictures under `img/shots/`, the page source `page.tpl.html` and the
drawing code `frontend/tests/presence-design-harness/round16-options.ts`, direction A "מונה ושמות").

| Q | Answer | What was built |
|---|---|---|
| 25 | א - build direction A | New card style `count` (below). Round-9 choices kept: only the active rooms, details on hover, "ריק מ־..." when all are empty. |
| 26 | א - A becomes the default; every existing style stays | `count` is the first choice of `card_style`, so a fresh install, an older client and an unknown value read as `count`. Strip / floors / quiet / off stay in Settings > Presence > Times and display. An installation that saved a style keeps it (see "Default and saved styles"). |
| 27 | א - a tick a room up to 40, one share bar above | `TICK_CAP = 40`; 41+ rooms draw one bar filled to the active share (tooltip "167 מתוך 500 חדרים פעילים (33%)"). |
| 28 | א - (direction C only) fall back to an own small card when the alarm widget is off | **Not implemented: no code path exists.** Direction C (the line inside the alarm card) was a mockup only and was not chosen; there is no such style in the product. If C is ever built, its fallback is this answer. |

## The card (`frontend/src/screens/building-presence-widget.ts`, `count()`)

- **Number in the clock's voice**: the active rooms large (`--hm`, the clock's own size variable, times 1 / 0.82 / 0.7 for small / medium /
  large, so every layout and fit step scales it with the clock and the row never grows), `/5` beside it in light grey, LTR-isolated
  ("2/5" like the mockup). Ink colour (`--sw-heading`), never green. All empty: a grey light-weight "0"; no data: "–" (never a 0).
- **Word line**: the lamp (green only while occupied; hollow for no data - shape, not colour alone) and "חדרים פעילים" / "חדר פעיל" /
  "המבנה ריק" / "אין מידע מהחיישנים". With details inline the update time follows it (existing `pr-tm`).
- **Names line**: the active names as plain text, one text run (each name isolated with FSI/PDI, what `<bdi>` does), separated by "·",
  first eight then "+N", one line with an ellipsis. No pills. All empty: "<room> · ריק מ־HH:MM" (the room that emptied last) or "כל N החדרים ריקים" with "count only"; no data: "החדרים יופיעו
  כשהחיישנים ידווחו". With "show empty rooms" or details inline the empty / no-data names follow, muted.
- **Tick bar** (medium and large): 4 px, one tick a room - green active, grey empty, hollow (1 px ring) no data; the active first, then no
  data, then empty (the mockup's order); each tick's tooltip is "<room> · <state>". Above 40 rooms: one share bar.
- **Large**: + a quiet floor line in the server's floor order, "קרקע 1/1 · קומה 2 1/2 · קומה 3 0/2", at most 5 floors then "+N קומות";
  none for a building without floors, none in the row band or the tightest fit step (`data-fit='2'`).
- **Small**: the count line only (number, word, and the names while active), no bar.
- **Details on hover**: the count line's tooltip is the active names, the update time and the empty / no-data names (`title`, so it shows
  under a mouse only). Nothing animates except the existing lamp colour fade, now also on a tick's colour (200 ms, off under reduced motion) -
  the card updates many times a day (emil-design-eng: no motion for a frequent, ambient change).
- **Screen reader**: the number is `role="img"` named "2 מתוך 5 חדרים פעילים" (one room: "חדר פעיל אחד מתוך 5"; no data: "אין מידע
  מהחיישנים").
- **Targets**: the only control is the existing "במפה" link (44 px hit area, unchanged).
- **States**: loading = the card is absent until the first answer (unchanged: it never holds an empty slot); error = the shared failure panel
  (unchanged); empty / no data / one room / 500 rooms as above.
- Tokens only (`--sw-heading`, `--sw-text-2/3`, `--sw-surface-3`, `--sw-success`, `--sw-border-strong`, `--sw-r-pill`, `--sw-fs-*`), so every
  skin and both schemes follow; Hebrew first, English twin in `i18n/building-presence.ts`.

Logic (pure, unit-tested): `countView()` in `frontend/src/api/building-presence-logic.ts` on top of `compactView()` (which gains `ticks`,
`floorOrder`, `hasFloors`; the earlier styles read nothing new).

## Default and saved styles (backend `services/building_presence.py`)

- `CHOICES["card_style"] = ("count", "strip", "floors", "quiet", "off")`, `DEFAULTS["card_style"] = "count"`.
- A `PUT presence/building/settings` that carries `card_style` stores `card_style_chosen: true` beside it. A save that does not carry it
  stores no `card_style` at all while none was chosen, so the default keeps following the release. The marker is never returned by the API
  and is not a settable field (422).
- **Stores written before 2.40.0** have no marker and always held the whole set: the old PUT wrote the default `"strip"` on every save of any
  setting. There a stored `"strip"` cannot be told apart from "never chosen", so it reads as the new default `count`; any other stored style
  (floors / quiet / off) was a choice and is kept (and marked on the next save). Known limit: an administrator who explicitly went back to
  "strip" before 2.40.0 gets `count` and has to pick strip once more.
- Rollback: a 2.39 server reads a stored `count` as unknown and falls back to its default `strip`; the marker is ignored. No data is lost.

## Settings

Settings > Presence > Times and display > "הכרטיס במסך הראשי" > "סגנון": five choices, "מונה ושמות" first and pressed by default
(`system-building-presence.ts`).

## Tests (actually run)

| What | Where | Result |
|---|---|---|
| `npx tsc --noEmit -p .` (frontend, src + tests) | workstation | pass |
| `pytest tests/test_presence_count_2400.py tests/test_presence_compact_2310.py tests/test_presence_history_2280.py tests/test_building_presence_2271.py tests/test_area_presence_line_2351.py` | workstation (repo `.venv`, this worktree's `smplwise` imported) | 56 passed (8 new) |
| `npx playwright test -c playwright.unit.config.ts` with explicit files: `unit-presence-count-2400` (16 new), `unit-presence-compact-2310`, `unit-building-presence-logic`, `unit-area-presence-line-2351`, `unit-a11y-polished-lint`, `unit-arx-pending-tokens`, `unit-design-tokens`, `unit-designtokens-297`, `unit-token-lint`, `unit-uxfix-rtl`, `unit-motionsetting-297`, `unit-dark-polish-beds`, `unit-home-clock`, `unit-home-screen`, `unit-polish4-wp4-home`, `unit-uxrest2-295`, `unit-a11y-r4-leftovers-2380`, `unit-home-config` | workstation | 168 passed |
| `scripts/release_check.py` | workstation | ready (2.38.1 tree; no version bump on this branch) |
| `scripts/gate/lint_spec_waits.py` on the new / changed specs | workstation | 0 findings |
| `run_remote.sh spec` (Vite dev server), all three projects: `evidence-presence-count-2400` (new), `evidence-presence-design-2300`, `layout-widgets-break-297`, `layout-home-widgets-wide-298`, `layout-home-edit-bar-wp4`, `evidence-presence-round16` | runner, @ 3227e8d67, no gate running, 112 GB free | 54 passed, 0 failed, 36 skipped by design (tablet in the 2400 spec; the round-16 capture without `R16_SHOTS`; wide-298 runs on the desktop project only) |

What the runner caught on the way (fixed on this branch): the first draft drew a `<bdi>` per name and a visually hidden screen-reader
span; `layout-widgets-break-297` / `layout-home-widgets-wide-298` flagged name boxes running past the card inside the ellipsis line and a
1 px box cutting its text (34 failures). Names and floors are now one text run each (isolated with FSI/PDI), the number is `role="img"` with
its label. The skin pass iterates the picker's skins (bubble is frozen). A visual review of the pictures then showed the block pinned to the
top of the card (it grew to the full height); it is centred now, like the mockup.

Measured on the runner (fit-*.json): desktop 1440, hero band - clock 178, alarm 178, presence 178 px in every state and size (s / m / l,
ready / one / empty / no data / 500 rooms); phone 390 - presence 96 / 140 / 184 px = exactly its size's minimum (no growth), nothing clipped,
no sideways scroll, the map link 44 px, the number and the word not green. Same for classic, domus, tesla, crystal, infra and soft, light and dark.

Evidence pictures (private, not in git): `private-evidence/presence-2400/shots/` - 72 pictures, desktop 1440 and phone 390, light and dark,
loading / error / ready s m l / one / empty m l / no data / 500 rooms s m l, and every picker skin; `fit-*.json` beside them.

Pixel baselines: none changed and none re-taken - no pixel spec and no `visual-matrix` screen draws the presence card (their mocks give no
`presence/building` answer). The specs that do draw it (above) are geometry checks without baselines.

NOT_RUN: the full backend suite, the full unit sweep, the release gate, `visual-matrix`, the SW_LIVE fixture spec
`evidence-presence-2280-layout` (now pinned to `card_style: 'strip'`, the style its checks describe), and any check on the owner's live
installation. No local Vite / Playwright browser runs (per the task).

## Other specs touched

- `evidence-presence-design-2300.spec.ts`: covers `count` (default) and `count` with show / inline / count-only next to the strip; Settings
  shows five styles with `count` pressed.
- `evidence-presence-2280-layout.spec.ts` (live fixture): pins `card_style: 'strip'` - its checks are the strip's pills and state word.
- `evidence-presence-round16.spec.ts`: "current" is mounted as `strip`, so the round-16 capture still reproduces its pictures.
- `unit-presence-compact-2310.spec.ts`, `test_presence_compact_2310.py`: the default style reads `count`.

## Not done here

- No `management/tasks.json` / `test_catalog.json` entry (the lead registers the card when the train is assembled).
- No CHANGELOG line (written at the 2.40.0 release prep).

## Design skills

- impeccable (context + craft floor, detector): narrow refinement on the incumbent system (no PRODUCT.md / DESIGN.md: documentation gap,
  not acted on). The "hero metric" pattern is justified here: the clock and weather beside it already speak in a number. Detector on the widget:
  0 findings.
- emil-design-eng: no new motion; the tick colour change uses the lamp's existing state fade and stops under reduced motion; hover details are
  native tooltips (mouse only).
