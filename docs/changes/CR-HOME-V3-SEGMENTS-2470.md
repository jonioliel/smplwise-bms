# CR-HOME-V3-SEGMENTS-2470

2.47.0 row, the home part `CR-CMP2-SEGMENTED-C-2450` left ("What remains": home v3 `sw-home` / `home-p3` use a delegated `data-act`
click handler; `home-widgets` has a unit spec pinning its 44 px CSS). Base: `origin/release/2450-train` at 521165ad4. Owner answers of
19.11: N11 (`sw-segmented`), N12 (row switches and the home `.hsw` stay - not touched), control screens never scroll.

## What moved

Every real one-of-N group of the home interface is `sw-segmented` now. There were three hand-built sources, so three edits:

- `home/sw-home.ts` `seg()` - the home v3 operator screen and the v3 modules that call `h.seg()`: place (`scope`), the "all / on only"
  filters (`only`, `shadesOnly`, `doorsOnly`), lights tabs (`lightsTab`), floor (`floor`, rooms and settings), climate mode (`modeSeg`),
  energy period (`period`), alerts tab (`alertTab`), settings tab / theme / start screen / motion (`setTab`, `theme`, `start`,
  `motion`), alarm panel (`almPanel`), calendar tab / week strip / calendar (`p2CalTab`, `p2CalWeek`, `p2CalCal`), diary filter
  (`evTab`), intercom tab / guest day (`icTab`, `guestDay`), notices tab (`p2NtTab`), new scene scope (`p2CapScope`), tickets tab
  (`p2TkTab`).
- `home/home-p3.ts` `seg()` - phase 3: the announcement place, the bill account, the map floor.
- `screens/home-widgets.ts` - the edit bar's size choice (small / medium / large).

None of them was a named radio group (all were `role="group"` + `aria-pressed`), so none takes `radio`: the semantics stay as they were
(the home specs read `aria-pressed` and the group's name). The home `.hsw`, the row switches, the pager and every other home button
are untouched.

## The delegated `data-act` handler - unchanged

`sw-home`'s ONE click handler finds the acting element with `composedPath()`. The keys of `sw-segmented` live in an OPEN shadow root,
so the click's composed path runs through the key itself. Each key carries its `data-act` / `data-v` through the component's `attrs`
(the same hooks the hand-built buttons had), so the handler, the typed `acts` table, every `a_*` handler and the v3 modules' `acts`
work without a change. The component's own `change` event is not listened to in `sw-home` (the click already carries the choice);
no ancestor of `sw-home` listens to `change` (checked: `sw-app` passes no `@change` to `<sw-home>`). `home-p3`'s keys had their own
`@click` closures; they listen to the component's `change` now. `home-widgets` listens to `change` and stops it there (its host,
`devices-building`, listens to the `home-widget-*` events only; the composed `change` has no business leaving the card).

## The look - kept, through the knobs

Each former `.seg` / `.seg button` / chosen-key rule of `home-styles.ts`, `home-styles-extra.ts` and `home-p3-styles.ts` is a host
rule on `sw-segmented` in the same place and media context, setting the component's knobs (`--sw-seg-pad / -radius / -track / -gap /
-h / -key-pad / -btn-radius / -fg / -fs / -fw / -on-bg / -on-fg / -on-fw / -on-shadow / -key-flex / -key-min-w / -wrap`). Every
translated rule loses the same one class of weight, so the cascade between them is the one it was. What the knobs cannot say goes
through the parts: the track has no edge (`::part(track) { border: 0 }` - the component draws a 1 px transparent one), the key keeps
the home line height (`::part(key) { line-height: inherit }` - without it the label sat a sub-pixel lower in the 56 px sheet keys),
the 4 px taller hit area (`::part(key)::after`) and the home focus ring (`::part(key):focus-visible`). No hover wash (the home keys
never had one: `--sw-hover-wash: transparent`), the .97 press (`--sw-press-scale`), no wrapping (`--sw-seg-wrap: nowrap`), a key no
narrower than its words (`--sw-seg-key-min-w: auto`, the phone rule's 48 px where it was). Nothing new can scroll: the groups keep
their old sizes.

`home-widgets-css.ts`: the edit bar's small pill key the same way (`.wg-e sw-segmented` knobs + `::part(track)` / `::part(key)`); the
`segThumbPlainStyles` interpolation went with the last `.seg` rule (the component's chosen key is the same light pill / `--sw-seg-key`).
On a coarse pointer the keys are 44 x 44 px as before: `--sw-seg-h: 44px` and `--sw-seg-key-min-w: 44px` (the track drops its
padding there, as before).

## Specs changed (and why)

- `unit-polish4-wp4-home.spec.ts` D2: pinned `.seg button { min-block-size: 44px; min-inline-size: 44px; }`. It pins the component's
  equivalent now - `.wg-e sw-segmented { --sw-seg-pad: 0; --sw-seg-h: 44px; --sw-seg-key-min-w: 44px; }` inside the same coarse-pointer
  block: `--sw-seg-h` is the key's `min-block-size` and `--sw-seg-key-min-w` its `min-inline-size` in `sw-segmented.ts`, so the rule
  pins the same two sizes. The slice it reads ended at a marker that no longer exists (it already read to the end of the file); it ends
  at the next section (`QUICKHIDE-295`) now.
- `unit-sw-segmented.spec.ts`: `home/sw-home.ts`, `home/home-p3.ts`, `screens/home-widgets.ts` joined the adoption guard (no hand-built
  `class="seg"` group may come back).
- `unit-dark-polish-beds.spec.ts`: a comment line in the inventory (home-widgets no longer interpolates `segThumbPlainStyles`).
- The home audits of `home-simple-2420`, `home-v3-followup-a`, `home-v3-gaps-2436`, `home-v3-p1`, `home-v3-p3` walk `sw-home`'s
  shadow root for small targets and shown words; the keys now sit one shadow root deeper, so each audit also measures the keys and reads
  the words inside its `sw-segmented` elements (no coverage lost). Playwright locators (`[data-act=..][data-v=..]`, `.seg button`)
  pierce the shadow root and needed no change.

## Tests actually run (workstation, Windows)

- `npx tsc --noEmit -p tsconfig.json`: exit 0. `-p tsconfig.tests.json`: exit 0.
- ESLint on the 7 touched source files: 0 errors, 0 warnings (the touched specs are outside the lint config: "File ignored").
- Unit (`playwright.unit.config.ts`), 27 files that read a touched file + token / a11y / design-token lints (incl. `unit-sw-segmented`,
  `unit-polish4-wp4-home`, `unit-dark-polish-beds`, `unit-home-*`, `unit-i18n-home`): 334 passed, 0 failed.
- Pixel A/B on the PC (Vite dev server, `--workers=1`, desktop + mobile): the three home pixel files (`pixel-home-gaps-2436`,
  `pixel-home-fb-2431`, `pixel-home-auditfix-2437`) shot with the BASE code as temporary win32 baselines, then checked with this
  branch's code. First pass: 4 failed - the wall panel's new-event sheet, the calendar key's label a sub-pixel lower (the component's
  line height); fixed (`line-height: inherit`); then all 24 shots pixel-identical to the base (timeouts on a slow dev-server page load passed
  on re-run; 4 skipped by the specs' own project rules). The temporary win32 images were deleted.
- Edit bar A/B (`layout-home-edit-bar-wp4` with `WF_SHOTS`, base vs branch, 20 shots): the same geometry; the only visible differences
  are the live clock's digits (the first branch pass showed the size labels a sub-pixel lower - fixed the same way). The spec: 2 passed.
- Home browser specs on the Vite dev server (`--workers=1`, desktop project): see the results line below.

Home browser specs (18 files: home-leave, home-r32-answers, home-simple-2420 / -2421, home-v3-auditfix / -fb / -followup-a / -gaps /
-p1 / -p2 / -p2-shots / -p3, layout-home-widgets-wide-298, layout-widgets-break-297, evidence-home-polish / -295 / -edit-drawer-2351 /
-screen), one pass: **183 passed, 40 skipped, 9 failed**. Re-run of the 9 (`--timeout=600000`): 5 passed (the gaps audits x3, the
followup categories test, the admin page - all had timed out on slow dev-server page loads), 4 failed again. The 4 run on the BASE code
(source stashed, same server): `home-leave-2435` x2 and `home-v3-p3` "all seven themes" fail on the base too (the interval tracker /
the test's own 180 s budget on a dev server) - not this row. **`home-v3-followup-a` "show bill opens the latest issued bill file" PASSES
on the base and FAILS on this branch (3 of 3 runs, also alone)**: the bill request is made, but the opened tab never reaches the blob
URL / download within 15 s. NOT investigated (session stopped for usage); see "Remains".
`layout-home-edit-bar-wp4`: 2 passed (twice).

## NOT_RUN

- Runner: the 2.45.0 train's gate ran the whole session (a re-gate started 23:31 UTC), so no runner pixel run and no baseline refresh.
  Baselines refreshed: none. Expected: none needed - the Windows A/B above is pixel-identical for every home pixel shot; the runner
  check without `-u` (`pixel-home-gaps-2436`, `pixel-home-fb-2431`, `pixel-home-auditfix-2437`, desktop + mobile) is the next step when
  `gate_status.json` shows no gate.
- `evidence-home-screen` (the size keys' clicks) needs the devices fixture backend (`SW_LIVE=1 SW_DEVICES_FIXTURE=1`): skipped.
- Mobile / tablet projects of the home behaviour specs; the entry check (`branch_check.sh`) - not queued.
- No lab / device test (UI only).

## Remains (before this row boards a train)

1. The bill-file failure above: find why the popup does not get the blob URL on this branch (the bills screen draws no segmented group
   with one account; suspect an event / timing side effect of the new element in `sw-home` or `home-p3`), fix, re-run
   `home-v3-followup-a`.
2. Runner pixel check without `-u` of the three home pixel files (expected to pass, see the A/B), then the entry check.

## Open questions (recommendation taken, for the owner's page)

1. The home keys never had a hover wash (the home is a touch screen first); the shared component has one under a mouse. Kept the home
   without it. Give the home keys the hover under a mouse later? Recommendation: no, keep the touch look.
2. The home keys keep the home's own look (`--hs-*` tokens, 48 px / 56 px keys) through the knobs rather than the settings key. Keep?
   Recommendation: keep - the home has its own design language (round 25 mockup) and the owner approved it.
3. The lights / settings / calendar "tabs" drawn as segments (`lightsTab`, `setTab`, `p2CalTab`, `icTab`, `p2NtTab`, `p2TkTab`, `evTab`,
   `alertTab`) switch the view below them; they stay segmented choices (as drawn, as the specs read them), not `sw-tabs`. Move them to
   `sw-tabs` later? Recommendation: no - on the home they read as a choice of filter, and a tab strip would change the control.
