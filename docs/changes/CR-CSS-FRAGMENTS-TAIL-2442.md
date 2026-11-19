# CR-CSS-FRAGMENTS-TAIL-2442

Code-review batch 16.11, wave 3B, frontend chain step FE-1. Contract: the `FE-1` row of
`private/code-review-2026-11-13/MASTER_PLAN.md` section 3.5 (named there `pilot/CR-CSS-FRAGMENTS-TAIL-2436`): the rest of 06:CSS-1,
06:DUP-11 (the copies), 06:TOKEN-1 (equal-value swaps only), 06:CSSLAYER-1. Base: `origin/pilot/CR-W3-FE-COMBINED-2441`
(`68db28df0` = frontend wave 2 + wave 3 + main 2.43.7). First part: `docs/changes/CR-CSS-FRAGMENTS-2440.md`.

Rule of the row: **zero pixel change** - every edit must leave the same computed CSS, under every skin.

## What was done

Four commits, one per finding, each checked on the whole tree before the next.

### 1. 06:DUP-11 - `isoZ` replaces the typed-out copies (`fdca68cf7`)

`X.toISOString().replace(/\.\d{3}Z$/, 'Z')` (and the equal `/\.\d+Z$/` form: `toISOString` always prints three digits) became
`isoZ(X)` from `api/day-format.ts`: **51 sites in 38 files**. `new Date(x).toISOString()...` became `isoZ(x)` (the helper copies its
argument through `new Date` itself), so the value is the same at every site. One site passes a string and keeps its own
`new Date(...)` (`system-tickets.ts`, the type of `isoZ` is `Date | number`).

| Family | Files | Sites |
|---|---|---|
| `api/` | 22 | 24 |
| `screens/` (investigate-history-map 5, investigate-playback 4, investigate-event-detail 3, investigate-events 2, system-tickets 1) | 5 | 15 |
| `home/` | 4 | 5 |
| `access-external/` | 3 | 3 |
| `tickets/` | 3 | 3 |
| `door-windows/` | 1 | 1 |

Left, on purpose: `public-ticket/` (3 sites - the public page is a bundle of its own and imports nothing from `api/`),
`access-control/status-logic.ts` (`.replace('.000Z', 'Z')`, a different expression).

### 2. 06:CSS-1 - the other families adopt `styles/fragments.ts` (`d4ab8fa5f`)

A rule that equals a fragment - same selector, same declarations, same order - is replaced by `${fragment}` in the place where it
stood (the method of CR-CSS-FRAGMENTS-2440). **121 copies in 101 files**:

| Fragment | Copies removed |
|---|---|
| `ltrStyles` | 33 |
| `hostBlockStyles` | 33 |
| `errLineStyles` | 27 |
| `mutedStyles` | 9 |
| `okLineStyles` | 7 |
| `srOnlyStyles` | 5 |
| `segThumbPlainStyles` | 4 |
| `dialogRowStyles` | 3 |

Files per family: settings screens (`screens/system-*`) 18, `components/` 15, `tickets/` 13, `calendars/` 8, `temperature/` 7,
`screens/investigate-*` 6, `screens/wiskey-*` 6, `screens/explore-*` 4, `maintenance/` 3, `shell/` 2, `electricity/` 2,
`screens/devices-*` 2, `screens/messaging-*` 2, and one file each in `elevators/`, `access-control/`, `door-windows/`, `notices/`,
`pwa/` and nine more screen groups.

`segTrackStyles` and `segThumbStyles` found no further copy (their adopters were the settings cards of the first part).

### 3. 06:TOKEN-1 - numeric font weights read the weight tokens (`377de54b6`)

In the `css` templates of `src/screens`: `font-weight: 400 / 500 / 600 / 700` -> `var(--sw-fw-regular / medium / semibold / bold)`.
**204 declarations in 42 files** (600: 113, 700: 63, 500: 18, 400: 10). Biggest: `tickets-overview` 28, `system-notifications` 25,
`automation-editor-base` 17, `devices-schedules` 13, `access-external` 10.

Why this swap is equal under every skin: the four tokens are defined once, in the base table (`design/tokens.ts:242-245`, the
same value in light and dark); no skin table, dark-rail table, look bundle or component sheet defines them again (searched in the
source and in the dumped CSS of every component); see the probe under "Tests actually run".

### 4. 06:CSSLAYER-1 - dead declarations of the stacked layers are gone (`6fbcb69c0`)

`live-camera.ts`, `live-wall.ts` and `investigate-history-map.ts` define the same selector two or three times (the original rule,
then a "round 5" layer, then a "Fable pass" layer). A declaration of an earlier layer is deleted when a LATER top-level rule of the
same sheet with the **identical selector** declares the same property: that later declaration matches exactly the same elements with
the same specificity and comes later, so it wins every comparison the earlier one could have won. **101 declarations deleted, 124
lines** (live-camera 49, live-wall 28, history map 24); a rule left empty is removed (11 rules). Nothing was moved or merged, so the
order of everything that stays is unchanged - the layers were not folded into one rule, because moving a declaration across the rules
that stand between two layers is where a pixel could move.

`investigate-playback.ts` (named in the finding): its two `.grid` / `.grid.one` pairs set different properties - nothing is dead, no
change.

## Swaps skipped, with reasons

- **`border-radius: 999px` -> `var(--sw-r-pill)`: none of the 50 (in 31 screen files).** The token is not 999px everywhere: the
  tesla skin sets it to `6px` (`design/skins/tesla.ts:104`), the look dial "radius: square" to `8px` (`design/look.ts:498`), the
  devices theme scope to `var(--dv-radius-control)` and the media glass scope to `inherit`. Swapping would square those pills in
  tesla and in the square look. That may well be what the design wants - it is a visible change, so an owner decision, not this row.
- **`font-weight: 800` (66) and `300` (6): no token** with that value. Not invented here.
- **`plan-studio-panel.ts` (3 numeric weights) and `plan-package-dialog.ts`:** `tests/harness/plan-package-harness.ts` mounts their
  styles on a page that never loads the token sheet; a `var(--sw-fw-*)` there would compute to the inherited weight.
- **Inline `style="font-weight:..."` attributes in templates (7 in 5 screens):** not part of a sheet; left.
- **Raw colours (95 literals, 44 distinct, in `src/screens`): none.** Only a token with ONE value in all seven skins and both
  schemes can replace a literal without moving a pixel. 26 colour tokens are constant; 13 literal occurrences equal one of them
  by value (`#f59e0b`, `#ffffff`, `#ef4444`, `#22c55e`) but not by meaning - they match the timeline event colours, which an
  installation can re-colour at run time (`api/timeline-colors.ts` sets `--sw-tl-*` on the root), and the "ring on hue" white. The phone / lock-screen
  mock-ups (`system-notifications.ts`) are literal on purpose: a phone looks the same in every skin. Naming those palettes as local
  custom properties (the review's second suggestion) is not a token swap and was not done: it removes no copy and rewrites four
  large sheets that FE-3 (`CR-STRUCT-CSS-SPLIT`) moves next.
- **CSSLAYER-1, three declarations kept as possible fallbacks:** where the later layer's value uses a newer function
  (`color-mix()`), an engine that drops it at parse time falls back to the earlier declaration: `.video.off` background,
  `.controls` background (`live-camera.ts`), `.hist` background (history map).
- **06:CSS-1, no new fragments.** After this branch 284 rule sets still stand identically in three files or more (1350 copies), but
  they are one- and two-declaration rules (`:host { display: block }` 107 files, `:host { display: contents }` 39, `.grow { flex: 1 }`,
  keyframe steps ...) where `${fragment}` plus an import is longer than the rule, or sets in fewer than ten files. 89 of the sets have
  three declarations or more (317 copies; the largest is in 9 files). The three selector-less sets the first part left to this branch
  (ellipsis line, native input skin, skeleton column) are **not** created: they stand under a different selector in almost every
  file, so a fragment would have to be a bare declaration list inside each screen's own rule - three declarations hidden behind an
  import. Left as they are.

## Resolved file list

- `frontend/src/**` - 38 files (commit 1), 101 files (commit 2), 42 files (commit 3), 3 files (commit 4); `git show --stat` of each
  commit is the list.
- `frontend/tests/unit-dark-polish-beds.spec.ts` (`SEG_INVENTORY`): four entries (`elevators/elevator-settings`,
  `screens/explore-presence`, `screens/home-widgets`, `shell/sw-home-personal`) are covered by the existing `styles/fragments.ts`
  entry - the chosen-key rule stands there now. The rule's tokens are still checked, once.
- `docs/changes/CR-CSS-FRAGMENTS-TAIL-2442.md`

## Pixels

No (plan row); any diff is a bug in this branch. No baseline was regenerated, no PNG committed.

## Tests actually run

All on the workstation (no runner, by the batch rule). The comparison scripts live in the agent's scratchpad and are not committed:
they need two builds side by side and take about half an hour, so they are neither cheap nor a fit for the gate.

1. **`npx tsc --noEmit`** (frontend) after step 1, after step 2 and on the final tree (steps 3 and 4 change CSS text only): exit 0
   each time.
2. **CSS text of every component, base against branch.** A Vite dev server per tree; a page imports all 1517 modules of
   `frontend/src` and dumps the `static styles` of every registered element (552) and every exported sheet (141); comments stripped,
   whitespace collapsed.
   - after step 2 (fragments): **693 same, 0 different**;
   - after step 3 (weights), with a numeric weight counted as its token on both sides: **693 same, 0 different** (90 sheets carry
     a swap - shared sheets such as `devices-layout-css` reach many components);
   - after step 4 (layers): 690 same, 3 different - exactly `live-camera`, `live-wall`, `investigate-history-map`.
3. **Layer check on those three sheets** (declaration by declaration, base against branch): the branch's declarations are a
   subsequence of the base's (nothing added, edited or moved), and each of the 101 removed ones stood in a top-level rule with a
   later top-level rule of the identical selector declaring the same property: live-camera 497 -> 448, live-wall 325 -> 297,
   history map 660 -> 636; **not dead: 0**.
4. **Weight tokens under every skin.** On the preview build: 7 skins x light / dark x 3 looks (default, radius square, radius soft +
   compact) x desktop / mobile; each token read at `:root`, inside the app shell's shadow root, and as the computed `font-weight`
   of a probe in a shadow root: **420 checks, 0 mismatches**; no sheet of the dump redefines a `--sw-fw-*` token. (`bubble` is a
   frozen skin and resolves to `domus` at run time; its table has no weight override either.)
5. **Computed style of rendered screens, base build against branch build** (`vite build` of each tree, `vite preview`, demo mode,
   fixed clock, reduced motion, animations paused). Every element of the page, shadow roots pierced, every computed property plus
   `::before` / `::after`:
   - 64 routes in classic, light desktop (1440x900) and dark mobile (390x844);
   - the six most-touched routes (`/live/wall`, `/live/cameras/cam-1`, `/investigate/floors/f0/history`, `/system/notifications`,
     `/tickets/overview`, `/devices/automations`) also under domus, tesla, crystal, infra and soft in light and dark on the
     desktop, classic dark desktop, classic light mobile, tesla light and dark mobile;
   - **212 states, 159,168 elements: 212 identical, 0 different.**
   Two things had to be handled before that number: the crystal background is an absolute URL, so the two preview ports differed
   (the origin is normalised); and on `/devices/building` (dark mobile) a lazily loaded sheet component is sometimes not mounted yet
   when the page is read (881 or 857 elements instead of 908, on the branch build in 3 of 5 reads and never in 5 reads of the base) -
   whenever the 908 elements are there they are identical. Timing of the read, not style; said here because it was seen.
   What this cannot show: states the demo routes do not draw (a camera that is off, the wall-settings dialog, open accordions).
   Those rest on checks 2 and 3.
6. **Unit specs** (`npx playwright test -c playwright.unit.config.ts tests/unit- --workers=2`, node-only): **4640 passed, 6 failed,
   10 skipped.**
   - 5 failures are `unit-session-me-failure-2435.spec.ts` ("Cannot navigate to invalid URL"): a page spec the node-only config
     starts without a server. The same 5 fail on the base tree.
   - 1 failure, `unit-presence-compact-2310.spec.ts:36` (`Cannot read properties of undefined (reading 'lang')`), fails in the
     full run and **passes when the spec runs alone, on the branch (16 of 16) and on the base**. Cause as far as traced: some
     unit specs replace `globalThis.document` with a stub and the i18n helpers read `document.documentElement.lang`; a worker that
     runs such a spec first leaves the stub behind. Not fixed here (outside the row).
   - The same full run on the untouched base tree (`68db28df0`): **4640 passed, the same 6 failed, 10 skipped** - the branch
     changes no unit result.

## NOT_RUN

- The pixel gate (the row's test) and the entry check - runner only, and this batch pushes without queueing. No baseline was
  regenerated. Pixels to refresh: none expected.
- Evidence / layout / page specs in a browser (`playwright.config.ts`), `npm run build:addon`, the backend suite (no backend file
  is touched).
- ESLint, the bundle budget and the unused-exports report.
- Tablet viewport (1024) and the frozen `bubble` skin in the rendered comparison.

## For the next steps of the chain

- FE-3 (`CR-STRUCT-CSS-SPLIT`) moves the `static styles` of `live-camera` and others: the sheets it moves are the ones of this
  branch (after the layer clean-up and the weight tokens).
- Open for a decision, not done here: `border-radius: 999px` -> `--sw-r-pill` (changes tesla and the square look); folding the
  three layers of `live-camera` / `live-wall` / the history map into single rules; a `--sw-fw-*` token for 800.
- The worktree `C:\cloude\smplwise-fe1` uses a junction to `C:\cloude\smplwise-w3-fe\frontend\node_modules` (same lock file).
