# CR-CMP2-SELECTS-2450

2.45.0 row, continuation of `CR-CMP2-TOAST-2440` (in the base: the switches family and 32 of the 39 toast copies). Owner answers of
19.11: N10 (selects / drop-downs and tables to the shared components, screen by screen), N11 (a shared `sw-segmented`), N12 (row
switches and the home `.hsw` stay), N13 (smaller toggles are fine).

Branch `pilot/CR-CMP2-SELECTS-2450`, base `origin/release/2440-train` (e9d17b5ab). Not touched: `shell/sw-app.ts`, `router.ts`
(another agent), `management/tasks.json`. One commit per screen, so the train can drop a part.

## 1. Toast adoption - the last 7 (07:F12)

`components/toast-controller.ts` gains what the copies left out by CR-CMP2-TOAST-2440 needed:

- `exitMs` + `leaving`: after its time a message keeps its text for an exit phase (the screen's slide-out plays), then goes;
- `onExpire`: called only when a message's time ran out on its own (not on `clear()`, a replacement or a disconnect);
- `ToastStackController`: several messages at once, each with its own clock (push / remove / clear; empty on disconnect).

| Screen | How |
|---|---|
| `screens/water/page-alerts.ts`, `screens/water/page-settings.ts` | `ToastController` (4 s), read-only `notice` getter |
| `screens/meters-page-base.ts` (+ `electricity/page-meters.ts` 6 s, `water/page-meters.ts` 5 s) | one controller in the base; the electricity page's own timer field and `disconnectedCallback` are gone |
| `screens/access-external.ts` | `ToastStackController` (3.2 s each) - the stack stays a stack |
| `calendars/view-calendar.ts` | `ToastController` with `exitMs: 200`; tone `undo` / `bad`; the enter animation (`toastIn`) stays local |
| `screens/nvr-undo-toast.ts` (the camera screen's undo toast) | the element's 10 s clock is a controller with `onExpire` -> `dismiss` |
| `screens/system-ha-users.ts` | the lasting ok line is a controller with `ms: 0` |

Templates and classes are unchanged: no pixel moves. Unit: 5 new cases in `tests/unit-toast-controller.spec.ts`.

Found on the way (not in the 39 of 07:F12, not changed here): more hand timers under other names - `architect-request-dialog`,
`media-player-panel`, `media-remote`, `notify-center`, `devices-notices`, `investigate-cases`, `messaging-pacing-card`,
`messaging-policy-card`, `multimedia-base`, `presence-opt-out`, `system-notices` (`say`), `system-nav-size`. Recommendation: one more
small row, the same one-line adoption.

## 2. `sw-segmented` (owner N11)

`components/sw-segmented.ts` (+ `components/segmented-logic.ts`, the DOM-free keyboard rule). The look is the settings key the owner
chose (POLISH4-WP1 / Q3a, `styles/settings.ts` `settingsSegStyles`): a sunken track, the chosen key a lifted thumb, the dark-safe
light pill (`--sw-seg-key` / `--sw-seg-key-ink`). It reads the same `--sw-seg-*` knobs, so a glass host that sets them keeps its
track and thumb through the shadow root.

- **Controlled.** A press fires a composed `change` (`{ value }`); the thumb moves when the host renders the new `value` (the
  hand-built keys showed the model's value too). A press on the chosen key fires as well (a screen may reopen something from it).
- **Accessible.** A named `role="group"` of `<button aria-pressed>` keys - the screens' specs that read `button[aria-pressed]`
  keep working (Playwright CSS pierces the shadow root). Arrow keys follow the reading direction, Home / End jump.
- **Hooks.** Per-option `attrs` are copied onto the key, so every `data-*` hook of a replaced key stays (`data-look-option`,
  `data-view-follow`, ...).
- `size="sm"` (28 px), `block` (keys share the row), `count`, disabled keys / group; a 44 px tall touch target on a coarse pointer
  (absolute `::before`, no layout change); hover only under a hovering pointer; the press scale is `--sw-press-scale`; no motion
  when reduced. The thumb does not slide (emil-design-eng: a settings key is pressed tens of times a day).

Adopted (one commit each): `screens/system-look.ts` (2 rows + 13 dials), `screens/system-design.ts` (8 rows),
`screens/system-plan-view.ts` (target, choice / flag dials, map rows, wizard rows; its 44 px dial kept through `--sw-seg-h`),
`screens/system-brand-logos.ts` (5 rows; on a phone the control stretches and the keys share the line through the new
`--sw-seg-key-flex` knob, as before), `screens/system-automations.ts` (the precheck rows, the chip colour, the phone filter - they
already drew with the settings `.seg` rule, next to no pixel change). Each screen's own `.seg` CSS is gone, and so is
`styles/settings.ts` `settingsSegKeyStateStyles` (its only two users moved). Pixels: the keys take the shared key (34 px / 600
weight; look, design and brand had 36 px / 500).

Tests: `tests/unit-sw-segmented.spec.ts` (the focus rule, the source contract, an adoption guard for the three screens),
`tests/pixel-sw-segmented.spec.ts` (a specimen sheet light / dark + a behaviour check in the browser), the DARK-SEG-ALL inventory
(`unit-dark-polish-beds`) gains the component's chosen-key rule.

Left for the next rows (recommendation: per family, like the switches): 248 hand-built `class="seg"` groups in 140 files remain.
Two families need a decision first, recorded rather than guessed:

- **Glass hosts** (`styles/media-glass.ts` `.seg`: notifications, multimedia, schedules ...) draw a different track and the
  operator 44 px rule as a real box height; adopting means mapping their tokens onto the `--sw-seg-*` knobs per host and checking the
  layout guards.
- **Keys with rich content** (`system-nav-size` "current" badge inside a key, `sevseg` colour dots, icon-only view switches): need
  a content slot / icon option on the component first.

## 3. Selects and tables (owner N10)

The shared component for a FORM select is `sw-field` (189 selects already sit in one); a native select slotted into it keeps its
keyboard, its value and every `selectOption` in the specs, and takes the shared field look (border, radius, hover, focus ring, the
disabled look, 44 px / 16 px on a phone). Moving a filter select to the `sw-dropdown` chip changes the interaction and is left to
the screens' owners.

Counted on this base: 370 selects outside `sw-field` in 163 files. Screen by screen, in the order of the count (one commit each):

| Screen | Selects | Note |
|---|---|---|
| `screens/system-tabs-mode.ts` | 7 | the rows place the field (240 px, 60 %); the shared 30 px field on desktop, 44 px under a coarse pointer as before |
| `screens/system-announcements.ts` | 8 | the field keeps the row's 36 px (its inputs are 36 px) |
| `screens/system-cast.ts` | 6 | the same 36 px |

Skipped on purpose (recorded): `system-notices` (15), `maintenance/task-form` (9), `system-intercom-ops` (8),
`system-local-users` (7): their selects share ONE local skin with the text inputs of the same form (`.inp`, `label.f`, `form
input, select`); moving only the selects would split one form into two looks. Recommendation: move those forms' inputs and selects
into `sw-field` together, one row per form.

**Tables: none moved in this branch.** The 110 `<table>` elements render their cells with the screen's own classes (`.t1`, `.t2`,
`.mut`, `.num`, badges); a `sw-table` column's `render` draws inside the table's shadow root, where those classes do not exist, and
the specs key on `tr[data-board=...]`-style row hooks that `sw-table` does not carry. Recommendation (one small component row first):
`sw-table` gains `rowAttrs` (data hooks per row) and a small shared cell vocabulary (primary / secondary line, muted, number, LTR,
badge), then the screens move one by one.

## Baselines refreshed (runner, linux)

- NEW `frontend/tests/pixel-sw-segmented.spec.ts-snapshots/` (f4bcc072b): `sw-segmented-{light,dark}-{desktop,tablet,mobile}-linux.png`
  (6 images), written with `--update-snapshots` at 40485d34d, looked at, then verified without `-u`: 9 of 9 passed.
- No existing baseline changed in the runs that completed (see below). NOT refreshed / NOT checked: the visual-matrix
  `settings-diagnostics` case and `pixel-access-s12` / `pixel-settings-intercom-cards-2401` (the settings pages that hold the look /
  design / brand cards) - that step was stopped by the lead's hold (below). If they go red at the entry check, they are the
  expected key-size change of sw-segmented and are refreshed with `-u` on the runner.

## Tests actually run

Workstation (Windows):

- `npx tsc --noEmit -p tsconfig.json`: exit 0 (at 9e1f6f03b, the last code commit). `npx tsc --noEmit -p tsconfig.tests.json`:
  exit 0 at 282a053fb (the first run found 2 casts in the new pixel spec - fixed there).
- `node scripts/unused-exports.mjs --enforce`: OK (the first run found `settingsSegKeyStateStyles` and `StackedToast` - fixed in
  282a053fb).
- ESLint on every touched file: 0 errors, 0 warnings.
- Unit (`playwright.unit.config.ts`): 31 specs reading the touched files - 249 passed, 0 failed (at 282a053fb); at the head after
  brand-logos / automations: 8 specs (sw-segmented, dark-polish beds, token lint, diag tabs, settings rows, polish4-wp4 home, a11y
  polished lint, toast controller) - 67 passed, 0 failed. The toast controller spec alone: 14 passed.
- Browser specs against a Vite dev server on the PC (`--workers=1`, desktop), because they import `/src/...` and cannot run on a
  preview build: `evidence-tabs-dropdown-settings`, `dropdown-styles`, `dropdown-capsule`, `tabs-mode-apply` - 67 passed, 0
  failed. `evidence-brand-logos`, `evidence-automations-list`, `evidence-kavarnit-ext`, `pixel-sw-segmented` (behaviour test; its
  screenshots skip on Windows, no baseline) - 58 passed, 3 skipped, 0 failed.

Runner (`~/work/cmp2b`, nice -n 19, `--workers=2`), pass 1 at 40485d34d:

- build: OK. `pixel-sw-segmented` with `-u` then without: 9 passed / 9 passed.
- Evidence + layout of every touched screen, desktop + mobile (29 files: look, material dials, bubble foundation, palettes, CRY,
  design foundation, motion / skin smoke, ST7 x3, UI polish 2443, tabs dropdown settings, tabs-mode apply, dropdown styles /
  capsule, announce x3, cast, water, electricity meters x3, access polish / requests, calendars grid edit, NVR cameras write /
  batch / fixture): 496 passed, 124 skipped, 26 failed. All 26 failures are `Failed to fetch dynamically imported module
  .../src/shell/tabs-mode.ts` (or `.../src/components/dd-style.ts`): specs that need the Vite dev server, not runnable on a
  preview build - the same specs passed on the PC dev server (above).

## NOT_RUN

- Runner pass 2 (the head after brand-logos / automations / `--sw-seg-key-flex`: the specimen re-check and those screens on a
  preview build) and the screenshot step of pass 1 (visual-matrix `settings-diagnostics`, `pixel-access-s12`,
  `pixel-settings-intercom-cards-2401`): stopped on the lead's instruction (no new runner Playwright while the 2.43.9 release gate
  runs). Covered meanwhile on the PC dev server for behaviour, not pixels.
- Tablet project for the evidence specs (desktop + mobile per the brief).
- Full unit / evidence / pixel suites; the entry check (`branch_check.sh`) - not queued (task rule).
- No lab / device test (UI only).

## Open questions (recommendation taken, for the owner's page)

1. Tables (N10): move them only after `sw-table` gains row hooks and a shared cell vocabulary? Recommendation: yes, one small
   component row first, then screen by screen.
2. Forms whose selects share one skin with their text inputs: move inputs and selects into `sw-field` together, per form?
   Recommendation: yes (otherwise one form gets two looks).
3. Glass-host segmented controls (notifications, multimedia, schedules): map each host's track / thumb onto the `--sw-seg-*` knobs
   and keep the operator 44 px key height as a knob, or let them take the settings key? Recommendation: map the knobs (keeps the
   glass look, the owner approved it per screen).
4. Filter selects in toolbars: keep them native in `sw-field`, or move them to the `sw-dropdown` chip? Recommendation: keep native
   (keyboard and specs unchanged); the chip only where a screen's owner asks.
