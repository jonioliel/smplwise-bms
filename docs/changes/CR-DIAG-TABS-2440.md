# CR-DIAG-TABS-2440 - the settings screen fetches a tab's cards when the tab is first opened (review 06:BUNDLE-2, 06:STRUCT-1 settings screen)

Branch `pilot/CR-DIAG-TABS-2440`, cut from `origin/release/2437-train` at 32c4a2275 (it contains `CR-DIAG-DEFECTS-2436`, the row's
dependency). Row: code-review master plan section 3.3 (wave 2, frontend), `pilot/CR-DIAG-TABS-2436`. No version bump, no migration,
no backend file. Final visuals unchanged; pixels: none. The only behaviour difference is timing: the first opening of a settings
tab that has cards of its own waits for one chunk fetch (a loading panel is shown meanwhile).

## What changed

- **06:BUNDLE-2 - `screens/system-diagnostics.ts`.** The 28 side-effect imports of cards that only one tab draws are gone from
  this module. A loader map `TAB_CHUNKS` (tab id -> `import()`) names the chunk of each tab; `willUpdate` starts the chunk of
  the open tab once (`ensureTabChunk`, after the tab settled - a deep link, or "הכרזות וקול" folded into its card), and the new
  `renderTab()` draws the tab only once the chunk landed, so no card is ever upgraded in place (the GATE2342 rule of
  `shell/lazy-screens.ts`). While it is in flight the tab's place shows the screen's usual loading panel
  (`[data-tab-chunk-loading]`); a failed fetch shows an error panel with "נסו שוב" (`[data-tab-chunk-failed]`), which fetches
  again. The tab's own data loaders (`openTab`: health report, backups, media, bridge) start as before, in parallel.
- **New `screens/system-diagnostics-<tab>.ts` (10 files, imports only).** `tabs`, `media`, `map`, `buildings`, `access`
  (both "מתגי מסכי כניסה" and layout b's "הכרזות וקול"), `devices`, `remote`, `mobile`, `health`, `backup`. Each import line moved
  verbatim with its comment.
- **Static, as before:** the first page ("מראה ותצוגה": `system-design`, `system-brand-logos`, `system-brand-installer`,
  `system-brand-colors`, `system-look`, `system-nav-size`, `system-mobile-options`, `system-xs-options`) and the shared
  components (`sw-page`, `sw-card`, `sw-tabs`, ...). "גשר Arx" and "תמיכה" draw no card of their own and need no chunk.

## What is NOT in this branch (06:STRUCT-1 step 3)

The row's finding list also names STRUCT-1 for this screen ("one component per settings tab"). This branch delivers the chunk
seam only: the tabs' rows, state and save logic are still drawn by the one `SystemDiagnostics` class (2,200 lines, shared
`settings` / `draft` / error state across tabs). Splitting the class into one component per tab moves that shared state and
cannot be verified without the settings evidence and pixel suites, which do not run on this workstation; it is left as a
follow-up for the closing chain. The new per-tab files are the place such components would live.

## Size

Measured on the sources (no build was possible on the workstation, see NOT_RUN): the static closure of the settings screen less
what the entry chunk carries anyway.

| | modules | source bytes |
|---|---|---|
| before (every tab's cards with the screen) | 108 | 1,381,989 |
| after (the screen's own chunk) | 28 | 461,443 |

`tests/unit-diag-tabs-2440.spec.ts` holds the own chunk to 510,000 source bytes (measured + about 10 %): a card imported
statically by the screen again goes over it. This is the row's "chunk budget for this chunk", on sources so that it needs no build.

## Resolved file list

- `frontend/src/screens/system-diagnostics.ts`
- new `frontend/src/screens/system-diagnostics-{access,backup,buildings,devices,health,map,media,mobile,remote,tabs}.ts`
- new `frontend/tests/unit-diag-tabs-2440.spec.ts`

### Outside my rows

- `frontend/tests/unit-wiskey-live-validation-2390.spec.ts` - one assertion pinned `import './system-wiskey-validation-card';`
  in `system-diagnostics.ts`; it now reads the line from `system-diagnostics-access.ts` and checks the screen's `import()` of
  that module. Nothing else in the spec changed.

## Tests actually run (workstation, 2026-11-16)

- `npx tsc --noEmit` on a focused project (`system-diagnostics.ts`, the new spec and everything they import - the screen's whole
  closure including the ten tab modules): no errors. The full-project `tsc` was NOT run for this branch (see NOT_RUN).
- `node scripts/lazy-tags-check.mjs`: OK.
- `npx playwright test -c playwright.unit.config.ts --workers=1` on `unit-diag-tabs-2440`, `unit-backup-password`,
  `unit-nvr-verify-report`, `unit-settings-cards-accordion-2402`, `unit-settings-intercom-cards-2401`, `unit-settings-rows-2380`,
  `unit-uxfix-nav-295`, `unit-wall-phone-bar-2401`, `unit-wiskey-live-validation-2390`, `unit-perf-home-devices`,
  `unit-shell-lazy-2436` (every unit spec that reads this screen's source, plus the lazy guards): first run 95 passed, 1 failed
  (the pinned import above); after the fix `unit-diag-tabs-2440` + `unit-wiskey-live-validation-2390` 11 passed. The budget
  constant (510,000) was written into the spec after that run from the size it printed (461,443); the spec was not run again.

## NOT_RUN

- Full-project `npx tsc --noEmit` (the workstation had 0.1-0.4 GB free RAM during the batch; a focused project was checked).
- `npm run build` and the built size of the `system-diagnostics-*` chunks.
- Every browser spec: the settings evidence and pixel specs. A spec that opens a settings tab and reads a card at once, without
  Playwright's auto-waiting (`page.evaluate` on the card's shadow root right after the click), must wait for the card's element;
  the combined entry check will show whether any does.
- No entry check (per the batch brief: the lead combines).

## For the closing chain / the lead

- STRUCT-1 step 3 for this screen (one component per tab) - see above.
- `CR-HOME-LAZY-2440` changes `screens/mapping-all.ts` (the assistant leaves it); this branch imports `mapping-all` from
  `system-diagnostics-buildings.ts`. The two merge without conflict (different files).
