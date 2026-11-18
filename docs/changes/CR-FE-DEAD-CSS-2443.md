# CR-FE-DEAD-CSS-2443 - the dead CSS of 06:DEAD-1 (review wave 3B, step FE-8)

Branch: `pilot/CR-FE-DEAD-CSS-2443`. Base: `origin/pilot/CR-FE-PROMISES-2442` (`b3cc33d21`, step FE-7, the end of the frontend
chain; it contains `origin/main` 2.43.7 `cc69447f1`).
Finding: 06:DEAD-1, the part `docs/changes/CR-FE-DEAD-CODE-2442.md` left on purpose ("Left as it is, on purpose": the dead CSS, as a
step of its own with a rendered comparison). Owner decision O14 (round 32, Q-DES-19 **a**): the plan-editor contrast rules that
never take effect are deleted, not re-ordered - no visual change.

No rendered change is intended and none was measured (0 differences, see "Proof"). No template, no text, no behaviour. No PNG.
No backend file. Six files, 2 lines added, 134 removed.

## The rule applied

A rule is dead only when no element it can match is ever rendered into the shadow root its sheet belongs to. Checked per rule:
the screen's own templates, the classes it sets from code (`classMap`, bound `class=`), the template helpers of other modules
that render into the same shadow root, the other sheets composed into the same `static styles`, and the skins' sheets. A
declaration is dead when a later rule with the same selector, in the same sheet or a later sheet of the same array and under no
condition, sets the same property. Everything else stays. Then the rendered comparison decides: a deletion that changes one
computed value anywhere is not dead.

## Rule by rule

### `screens/devices-building-css.ts` (commit `4b656d8b5`)

| Rule | Result | Why |
|---|---|---|
| `.seg`, `.seg .opts`, `.seg button`, `.seg button + button`, `.seg button:hover`, `.seg button:focus-visible`, `.seg button[aria-pressed='true']` (main sheet) | deleted | No element with class `seg` is rendered into the home screen's shadow root: not by `devices-building.ts` (its classes of that family are `lay-seg` and `segs`, other names a `.seg` selector does not match), not by `tree-unassigned.ts` or `home-edit-drawer.ts` (the two template helpers that render there). |
| `:host([data-skin='bubble']) .seg .opts`, `... .seg button`, `... .seg button[aria-pressed='true']` (`BUILDING_BUBBLE`) | deleted | the same element |
| `:host([data-devices-style='glass']) .seg .opts`, `... .seg button`, `... .seg button + button`, `... .seg button[aria-pressed='true']` and their comment (`BUILDING_GLASS`) | deleted | the same element |
| `.note` | deleted | No element with class `note` in those templates (`role="note"` in `tree-unassigned.ts` is an attribute, not a class). |
| `.ha-refresh { ... }` followed by `.ha-refresh { position: relative; }` | merged into one rule | "`.ha-refresh` twice": the same selector twice in a row. |
| `.ha-refresh { flex-wrap: wrap; gap: 8px; }` (two declarations of that rule) | deleted | `HOME_LAYOUT` comes later in the same `static styles` array and has `.ha-refresh { gap: 6px; flex-wrap: nowrap; }` at its top level (no media query): both always lose. |
| `.ha-refresh { display; align-items; position }`, `.ha-refresh .stale-dot`, `.ha-refresh .refreshed` | kept | live: `renderRefresh` draws `<span class="ha-refresh">` with both children. |
| `.floor-filter .opts`, `.lay-seg`, `.segs` rules | kept | not in the finding; other classes. |

### `screens/wiskey-people.ts` (commit `bcd4820e4`)

| Rule | Result | Why |
|---|---|---|
| selector `td.name b` of `td .who b, td.name b { ... }` | deleted | The table's cells are `<td class="chk">`, `<td data-col=...>` and `<td class="act">`; no cell has class `name`. |
| `td .who b { ... }` | kept | live: the name cell draws `<span class="who">...<b>`. |

### `screens/system-notifications.ts` (commit `6d1aad0a2`)

| Rule | Result | Why |
|---|---|---|
| `.tagrow` | deleted | The class `tagrow` is in no template of `frontend/src` (the screen uses `.tag` alone). |

### `screens/explore-plan-editor-css.ts` (commit `d179199db`) - owner decision O14 a

The finding names two blocks as "overridden by later rules". Read declaration by declaration, three declarations are overridden
and the rest of those rules is live. Only the three go.

| Rule | Result | Why |
|---|---|---|
| `.list button { font-size: var(--sw-fs-sm); }` | deleted | the later `.list button { font: inherit; font-size: var(--sw-fs-xs); ... }` of the same sheet always wins |
| `.kv .k { color: var(--sw-text-2); }` | deleted | the later `.kv .k { color: var(--sw-text-3); }` always wins (the "contrast" the owner was asked about) |
| `.row .muted { color: var(--sw-text-2); }` | deleted | the later `.row .muted { font-size: ...; color: var(--sw-text-3); }` always wins (the same) |
| `.list button { transition: ... }` | kept | no later rule sets `transition`: live |
| `.list button.on { font-weight: semibold; color: var(--sw-accent-text); }` | kept | live: the later `.list button { font: inherit }` is less specific, the later `.list button.on` sets background and border only |
| `.kv { font-weight: medium }`, `.kv .k { font-weight: regular }` | kept | live: the later `.kv` / `.kv .k` rules do not set the weight |
| `.row .lbl { font-weight: semibold; color: var(--sw-heading); }` | kept | live: the later `.row .lbl` sets `display` and `flex-direction` only |
| `.row .muted { font-weight: regular }` | kept | live: without it a `.muted` inside `.lbl` inherits semibold |

### `screens/explore-floor-map.ts` (commit `4d0702a03`) - not CSS, the last item of the finding

| Item | Result | Why |
|---|---|---|
| `private bakeCancel = false`, `this.bakeCancel = false` in `runBake`, and its read in `cancelled: () => this.bakeCancel \|\| ...` | deleted | The field is only ever `false` (nothing sets it to `true`, in `src`, `tests` or `scripts`). `cancelled()` keeps its two real conditions: the element left the page, or another floor was opened. |

### `screens/investigate-events.ts` (commit `4deca826a`) - also 06:EVT-3

| Rule | Result | Why |
|---|---|---|
| `sw-scene.thumb, .thumb.none { ... }`, `.thumb.none { ... }`, `.thumb img { ... }`, `.thumb.pending { ... }`, `@media (prefers-reduced-motion: reduce) { .thumb.pending { animation: none } }` | deleted | Every element with class `thumb` is made by a column renderer (`renderThumb`, `renderWindowThumb`, the demo `columns`) and `sw-table` draws the renderer's output inside its own shadow root, where this screen's sheet does not apply. The boxes are styled inline for that reason (the file's own comments say so). The drawer's picture is `.big img`, not `.thumb`. |
| `@keyframes shimmer` | deleted | named only by the deleted `.thumb.pending` rule: no other rule of this sheet, no inline style of the screen's templates and no sheet of a child element of this screen names `shimmer` without defining its own. Said apart because a computed style cannot show a missing `@keyframes`; this one rests on the search. |
| `.preview sw-scene`, `.big ...` | kept | live (the demo drawer, the event drawer). |

What this means on screen, unchanged by this step: a pending thumbnail has never shimmered and the demo thumbnail's shadow has never
been drawn (the rules never reached them). Whether they should is a design question, not part of this step (see "For the lead").

## Proof

Two builds (`npx vite build` of `b3cc33d21` and of this branch), each served by `vite preview` on a private port, demo mode
(every `/api` call aborted), fixed clock, reduced motion, animations paused. The scripts are the FE-1 ones (`fe1/render.mjs`,
`rcmp.mjs`) extended in the scratchpad (`fe8/render8.mjs`, `render8b.mjs`, `cmp8.mjs`, `probe.mjs`; not committed).

**1. Rendered comparison - every element of the page, shadow roots pierced, every computed property plus `::before` / `::after`.**

- Base states: every address of the six screens the demo draws - `/devices/building`, `/devices`, `?edit=1`, eight tile-panel
  addresses (`?domain=lights`, `switches&floor=ground`, `covers&floor=first&filter=active`, `sensors`, `locks`, `alarm`, `climate`,
  `media`); `/wiskey/people`; `/system/notifications` and its nine `?section=` addresses; `/explore/floors/f0/edit`, `f1/edit`;
  `/explore/floors/f0`, `f1`; `/investigate/events`, `?camera=cam-1` - under classic, domus, tesla and crystal, light and dark,
  desktop 1440x900 and phone 390x844.
- One-click states (drawers, dialogs, panels, views, tools): from a fresh load, every distinct control inside the screen (buttons,
  tabs, table rows, focusable rows, map markers; up to 4 of a kind, 30 per screen; 12 of a kind and 45 for the plan editor and the
  map in a second pass) is clicked once and the page is read again - under classic light desktop, domus dark desktop, tesla light
  phone and crystal dark phone (every skin, both schemes, both viewports once). The list of controls found is itself compared.

| Pass | States read | Identical | Different | Not read (the same on both builds) | Elements compared |
|---|---|---|---|---|---|
| Desktop | 444 (232 base, 212 one-click) | 418 | 0 | 26 | 390,526 |
| Phone | 392 (232 base, 158 one-click, 2 control lists that could not be taken) | 345 | 1 -> 0 after re-reading (below) | 46 | 331,024 |
| Plan editor + map, wider click pass, desktop | 72 | 62 | 0 | 10 | 39,621 |
| Map, wider click pass, phone | 28 | 28 | 0 | 0 | 18,408 |
| **Total** | **936** | **853** | **1 -> 0** | **82** | **779,579** |

(The wider pass repeats the plan-editor and map clicks of the first pass and adds to them; the totals count both.)

- **The one difference**: `/devices/building`, the phone's tree button, tesla light phone - 1009 elements on the base build against
  1036 on the branch: the 27 elements of the closed area quick sheet, which the home screen mounts when its lazy chunk lands (the
  timing FE-1's note already describes). Read three more times on each build: 1036 elements and identical all three times.
  Timing of the read, not style.
- **Not read (82), each the same on both builds**: 16 = `/investigate/events/ev42` (that address draws another screen,
  `investigate-event-detail`; listed by mistake); 18 = the plan editor on the phone (the editor is not offered there, the element
  never appears); 38 = clicks on SVG map markers the first script could not press (the second pass presses them: the plan editor's
  six markers and the phone map's are among its identical states); 10 = desktop map markers whose class changes between two
  loads, so the second load does not find the same control. None of them is a state where a sheet touched here applies and was not
  read elsewhere.
- **What the harness changes on both builds alike** (said because it is not the plain page): `requestIdleCallback` runs at
  once, and the home screen is asked for one more render before the read - both so that the lazily loaded parts are mounted in
  every read; the read waits until no custom element is undefined and the element count is unchanged over three reads.

**2. What the demo does not draw - probe on the real sheets.** In the rendered states the demo drew `.who b` (people),
`.row .lbl` / `.row .muted` (plan editor), `.tag` (notifications) and the `.thumb` boxes inside `sw-table` (events). It did not
draw the home screen's `.ha-refresh` (no element of that class was in any read), the plan editor's `.list button` and `.kv .k`, or edit
mode (`?edit=1` opened nothing more in the demo reads). For those the element class's own composed sheets (`elementStyles`, as built) were
adopted by a probe shadow root holding the elements the touched rules match, and every computed property was read on both builds:
4 skins x 2 schemes x 2 viewports (the plan editor on the desktop only), the home probe also under `data-skin="bubble"`,
`data-devices-style="glass"` and both.

- **Live elements** (`.hdr > .ha-refresh` with its children, `.toolbar .bulk-buttons`, `.floor-filter .opts`, `.pills`;
  `.list button`, `.list button.on`, a circuit row, `.kv > .k`, `.row > .lbl > .muted`, `.row > .muted`, `.autosave.dirty`;
  the people table with `td .who b`; `.sp > .tag`; `.big`, `.preview`): **72 states, 1,456 elements, 2,083,536 property values,
  0 different.**
- **Control** (elements with the deleted classes, which no template draws: `.seg` with its options, `.note`, `td.name b`,
  `.tagrow`, `.thumb.*`): 592 elements, 31,484 values differ - the probe does see a removed rule, and these are exactly the rules
  that match nothing real.
- Rule counts of the composed sheets, base -> branch: home 626 -> 610 (15 deleted, 2 merged into 1), notifications 571 -> 570,
  events 160 -> 154, plan editor 244 -> 244 and people 89 -> 89 (declarations / one selector only).

**3. `@keyframes shimmer`** cannot be seen by a computed style: it rests on the search (rule table above).

## Tests actually run

1. **`npx tsc --noEmit`**: exit 0.
2. **Node-only unit run**, whole suite (`npx playwright test -c playwright.unit.config.ts tests/unit- --workers=1`, `dist` of this
   branch in place): **4691 passed, 6 failed, 8 skipped** (4705; 27.2 min). The 6 are the known base failures the chain's notes
   record (5 x `unit-session-me-failure-2435`, a page spec the node-only config starts without a server; and
   `unit-presence-compact-2310:36`, which fails only inside the full run) - the same numbers as FE-7. The 18 PNGs the run rewrites
   under `docs/` were restored. Before it, the 45 unit specs that name one of the six screens: 302 passed.
3. **Design ratchet** (`scripts/design_ratchet.py`): the script is not on this chain (it lives on `CR-BUILD-GUARDS-2438`,
   `595ff0f2c`, with its baseline). Its counting functions were run from that commit over the base tree and over this tree:
   `px-literal` 25628 -> 25612 (-16); `color-literal` 2504, `undefined-token` 13, `native-dialog` 20, `native-select` 547,
   `native-table` 109, `hand-switch` 377, `scroll-container` 236 unchanged. No count goes up.
4. **`npx vite build`** of the base and of the branch: exit 0 both. **`node scripts/bundle-budget.mjs --dir dist --enforce`**: OK.
5. **`node scripts/unused-exports.mjs --enforce`**: OK (unreferenced 59, file-local 55 - the baseline).
   **`node scripts/lazy-tags-check.mjs`**: OK (550 tags, 102 route screens).
6. **ESLint** on the two files whose TypeScript changed (`explore-floor-map.ts`, `investigate-events.ts`), through the FE-7
   worktree's install (`--stdin`): exit 0, no report.
7. The rendered comparison and the probe (above).

## NOT_RUN

- The entry check, the pixel gate, anything on the runner (by instruction: push and report).
- Evidence / layout / page / pixel specs in a browser: not run; the rendered comparison stands in for them.
- `npm run lint` over the whole `src/` (`typescript-eslint` is not in the shared `node_modules`; two files were linted, above).
- Backend tests.
- States only an API session draws (the home edit mode and its drawer, the home refresh key in its live states, a real pending
  thumbnail): not rendered; covered by the probe for the rules touched and by the template search.
- The tablet viewport and the other skins (bubble as a route skin, infra, soft) in the rendered comparison; the probe covers the
  home sheet's `bubble` and `glass` host states.

## Pixels to refresh

None.

## For the lead / the owner

1. The finding's wording for the plan editor ("697-703, 721-732, overridden by later rules") was wider than the cascade: of
   those rules only three declarations never applied. They are deleted (O14 a). The rest is live and stays; deleting it would
   have changed the chosen row's weight and colour and the settings rows' label weight.
2. For the owner, only if wanted - not a defect of this step: the events table's pending thumbnail was written to shimmer and
   the demo thumbnail to carry a shadow, and neither ever did (the rules could not reach inside the table). The dead rules are
   gone; if the shimmer is wanted it has to be styled where the thumbnail is drawn. a) leave as it is (recommended: nobody has
   seen it otherwise); b) add the shimmer in a later step (a pixel change in the events table).
3. `scripts/design_ratchet.py` and its baseline are not on the frontend chain; when the chain meets `CR-BUILD-GUARDS-2438` the
   baseline may be lowered by 16 `px-literal` (never required).
