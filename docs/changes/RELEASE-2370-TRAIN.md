# RELEASE-2370-TRAIN: assembly of the 2.37.0 polish train (round 4)

Branch `release/2370-train`, cut from `origin/release/2360-train` (eb9525d9b, 2.36.0 with v2.34.2). No version bump, no changelog entry,
no runner, no UI build, no tag: this document is the input for the version commit and the runner gate. All eight packages are on
the train. `pilot/POLISH4-WP5-EVID-BEFORE` / `-AFTER` and `probe/POLISH4-WP8-before` are throwaway capture branches and were not merged.

## Merged (one `--no-ff` merge commit each, in this order)

| # | Branch | Tip | Conflicts |
|---|---|---|---|
| 1 | `pilot/POLISH4-WP1-SHARED-2370` (shell pill, `sw-state-panel bare`, one settings key, drawer `footer-end`, sheet `solid`, `--sw-well`) | 4f88c1304 | none |
| 2 | `pilot/POLISH4-WP7-SETSYS-2370` (settings: system tabs, readiness, storage, backup, alarm, diagnostics) | c88aa3ff7 | none |
| 3 | `pilot/POLISH4-WP6-MAPS-2370` (plan editor / studio, floor map, sites, import) | 8ab68f6ce | `frontend/tests/unit-token-lint.spec.ts` |
| 4 | `pilot/POLISH4-WP2-LIVEINV-2370` (live, investigate, video-domain tokens) | 872a89c2a | `frontend/tests/unit-token-lint.spec.ts` |
| 5 | `pilot/POLISH4-WP5-MEDIA-2370` (multimedia groups / screens, cast, generator, electricity) | 8f2d6339c | none |
| 6 | `pilot/POLISH4-WP3-SERVICE-2370` (tickets, handlers, vendor accounts, maintenance pages) | d09708d21 | none |
| 7 | `pilot/POLISH4-WP8-SETMOD-2370` (settings modules: access / external access, announcements, notices, notifications, presence, transit incl. the new "check now" route, elevators, generator) | a30c0810a | none |
| 8 | `pilot/POLISH4-WP4-HOME-2370` (home edit bar, widgets, automations, announce, layout editor) | d82199646 | none |

Order note: WP4 is merged after WP1 (it removed a local notices hover cancel that relies on WP1's shared hover gate).

After the merges, `contracts/API_INVENTORY.md` was regenerated with `scripts/api_inventory.py` (1711 routes, adding
`POST /api/v1/transit/check` from WP8; the Version line still says 2.36.0 - no bump yet).

## Conflicts

Only the shared lint allow-list `ALLOW_HEX` in `tests/unit-token-lint.spec.ts` (neighbouring line removals). Rule applied: the union of
the removals. After the two merges the list no longer has `screens/system-update.ts` (WP7), `screens/explore-sites.ts`,
`screens/explore-plan-editor.ts`, `screens/explore-plan-import.ts` (WP6), `screens/investigate-history-map.ts`, `screens/live-camera.ts`,
`screens/investigate-playback.ts` (WP2) and `screens/system-diagnostics.ts` (WP7); the lint passes on the merged tree.

## Checks on the workstation (02.11, one worker / one process, no local vite or browser)

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors (merged tree without WP3; and the final tree, see the last line of this table) |
| Node unit specs, `playwright.unit.config.ts --workers=1 tests/unit-`, tree with WP1 / WP7 / WP6 / WP2 / WP5 | 3686 tests: **3684 passed, 1 failed, 1 skipped** (12.8 min). The one failure: `unit-empty-state-icons` "every empty sw-state-panel names a topical icon" - the empty panels of WP3's screens (tickets full screen, overview) were not yet on the tree; WP3's own commit `aa365b8f1` fixes exactly that guard |
| Final tree (WP3 merged, hover gates, aria fixes below) | see "Final run" at the end of this document |
| `scripts/release_check.py` | "ready for the owner's approval" - every check ok; the only FAIL is the expected "git tag for this version" (v2.36.0 is untagged on this branch; no bump yet) |
| Backend suite, browser / evidence / pixel / visual-matrix specs | NOT_RUN (workstation memory; runner, see below) |

## Accessibility + dark-mode pass over round 4 (code reading, the method of A11Y-POLISHED-2342 / DARK-REVIEW-2342)

Scope: the 58 files of `frontend/src` that the six packages changed (about 1250 added lines), read for: contrast tokens in light and
dark, focus rings, names of new buttons, reduced-motion, 44 px phone targets, hover gating, token use.

### Fixed in place (small, files of finished packages)

| File | Finding | Fix |
|---|---|---|
| `shell/sw-app.ts` (WP1) | The status key (viewer without the health right) always pointed `aria-controls` at `#sys-pop`, which exists only while the note is open (dangling reference) | `aria-controls` only while open (`nothing` otherwise) |
| `maintenance/styles.ts` (WP3 note) | `.btn.pri:hover` and `table.t tr.go:hover td` ungated: a sticky wash after a tap on touch | wrapped in `@media (hover: hover) and (pointer: fine)` |
| `tickets/handlers-glass.ts` (WP3 note) | `.hcard:hover` ungated; the same file's `.crow:hover` too (not on the lead's list, same rule) | both wrapped in the same media query |
| `screens/tickets-detail.ts`, `tickets/vendor-accounts.ts` (WP3) | The loading skeleton wrapper was a `div` with `aria-busy` + `aria-label` and no role: a name on a generic element is ignored by screen readers, so the wait was silent | `role="status"` (the skeleton cells stay `aria-hidden`) |

### Checked, no change needed

- **Shell pill note (WP1 D1):** a real `button` (`aria-label` "מצב המערכת: ...", `aria-haspopup="dialog"`, `aria-expanded`), the note is a labelled `role="dialog"`, closes on Escape (focus returns to the key), a press outside, a second press and a route change; the search panel takes precedence. Hit area 28 + 2 x 8 = 44 px through an invisible `::after`. Colours: `--sw-menu-surface` / `--sw-text` / `--sw-text-2` / `--sw-heading` (the menu ladder, measured in both schemes by the existing menu / dark beds specs). Hover only under a fine hovering pointer, press wash on `:active`, focus ring on `:focus-visible`.
- **`sw-state-panel bare` (WP1):** the status role stays on the text column, the icon is `aria-hidden`, the retry is an `sw-button size=sm` (which is 44 px on a phone since 2.34.2: `max(44px, var(--sw-ctl-h-sm))`). Tokens only. No screen uses `bare` yet (opt-in).
- **Settings key (WP1 Q3a):** selected label `--sw-accent-text` on the thumb (`--sw-surface` light, `--sw-seg-thumb` dark), unselected `--sw-text-2` on `--sw-surface-3`. Light: >= 4.5:1 in every live skin (new `unit-polish4-shared`). Dark: thumb vs track and the three selected inks >= 4.5:1 (`unit-dark-polish-beds`, every live skin). Focus ring, hover gate and the 34 px key height (44 px on phones through the settings coarse rules) kept.
- **Reduced motion:** every new transition either uses the motion tokens (`--sw-t-fast`, `--sw-t-press`, `--sw-t-hover`, zeroed globally by `design/css.ts` under `prefers-reduced-motion` and `data-motion=reduced`) or has its own local block (electricity, incidents settings, investigate search / sync / r5, live-views, multimedia groups / screens, system-diagnostics swatches, security public toggle). No unguarded `@keyframes` or `animation` was added.
- **Hex / rgba literals:** none added; the only `rgb(...)` is the artwork colour channel of the multimedia groups (a runtime value, `rgb(var(--art))`), as before.
- **Bare state colours on text:** none added (`-text` inks and `-soft` washes; the settings saved / error line is the shared pill).
- **44 px phone targets:** `sw-button` 44 on phones (verified); the incidents settings switch has a 44 px `::before` hit layer and `.seg button` / number inputs 44 on a coarse phone; handlers toast close 32 -> 44 on a phone; vendor-accounts rows 44; multimedia screens rows 44; offbox backup controls 44.
- **Video domain (WP2):** overlays and HUD read `--sw-video-bg` / `--sw-video-scrim` / `--sw-on-video` / `--sw-video-hover` (fixed in both schemes, as the picture is). The record-mode legend is no longer green for "motion" (green is status only); it uses `--sw-recorded` / `--sw-purple` / `--sw-warning` / `--sw-danger`, always with its text label.
- **Tokens:** all 102 distinct `var(--sw-*)` names used in the added lines resolve to a declared token.

### Not fixed - bigger or a product decision (for the owner / the lead)

1. **Plan editor icon bar on a coarse pointer (WP6, `screens/explore-plan-editor.ts`):** `.bar button.icon` grows from 26 px to `--sw-ctl-h-lg` (36 / 40 px), not 44 px. 44 would widen the toolbar on tablets (it would wrap or scroll); needs a look at the real bar at 768-1199. The editor is a tablet / desktop tool.
2. **Switch off-track contrast (several settings: incidents, security public):** the off state is `--sw-border-strong` on the card, below 3:1 for a UI boundary in light. It is the product-wide toggle recipe (not new in this round); changing it is a design decision for every toggle.
3. **Pill note focus (WP1):** the note is not modal and does not take focus (like the search popover); a keyboard user reads it through `aria-expanded` + Escape. If a screen-reader pass shows it is missed, move focus to the note and trap it.
4. **Sticky save row (WP7, `.foot.sticky` on phones):** reused from the insights settings; its distance to the phone's bottom bar was not seen on a device in system-diagnostics (code reading only). Check at 390 px on the runner.
5. **`sw-tabs` is still `aria-pressed` buttons, not a tablist** (carried over from A11Y-POLISHED-2342).

## Baselines expected per package (for the lead's central refresh on the runner; nothing was refreshed here)

| Package | Expected movement |
|---|---|
| WP1 shared | `visual-matrix`: none moved by the branch (the 14 differing shots differ on the base too: settings-diagnostics, devices-schedules dark, devices-home dialog mobile, map-floor mobile, security-alarm mobile - stale on 2.36.0, they clear with the 2.34.2 baselines). Screens using the shared `.seg` move (the one deliberate look change, Q3a): system-automations, system-schedules, system-multimedia, system-plan-view, system-brand-logos, the tickets settings cards (glass host unchanged), the home edit panel, `sw-list-display-settings`. Shell pill: no resting-pixel change. No pixel spec covers the `.seg` screens today |
| WP2 live / investigate | `live-wall` expected unchanged (hover gate only). No pixel spec covers a WP2 screen. Look changes (no baseline): rules icon tiles (dark), camera schedules legend (motion colour), saved views (phone layout, badge), search (loading / error panels), camera health (phone row card), playback phone bar (`--sw-video-bg`) |
| WP3 service / tickets | No `pixel-*` or matrix baseline is documented for the tickets full screen, handlers or vendor accounts; evidence specs `evidence-polish4-wp3-service`, `evidence-tickets-handlers`, `evidence-tickets-s4`, `evidence-tickets-vendor-accounts` updated on the branch. The hover gates added here change no resting pixel |
| WP5 media | `visual-matrix` `multimedia-screens-ready-{light,dark}-{desktop,tablet,mobile}`: expected unchanged (0 changed pixels at 1440 / 1024 / 390 light in the capture). Not run on the runner (lock held). Capture-only: groups at 1024 (+0.5-0.8 %, the new tablet grid step), generator alerts / history at 390 (4.6-14.7 %, intended), electricity unchanged |
| WP6 maps | `map-floor` dark desktop / tablet when camera dots show (`--sw-success` / `--sw-danger` dark values) and the device legend swatch in dark (`--sw-menu-surface`): small, dark only; map-floor mobile differences are the stale 2.36.0 baselines. `pixel-walk-touch`, `pixel-wall-plan` 14 passed on the branch. Editor / studio phone / touch captures will show the 70dvh canvas |
| WP7 settings system | None expected: the six `settings-diagnostics` matrix shots pass against the 2.34.2 baselines (the matrix signs in without the edit right, so the previews and the save row are not in them). Pre-existing readiness mobile failure noted in the branch doc |

| WP8 settings modules | `pixel-access-status` (desktop 1440 + mobile 390, classic / bubble / domus): every picture with a card subtitle (the text changed; on 390 the card heads stack). `pixel-access-s12`: `s12-classic-audit-person-*` (action-log subtitle) only. `visual-matrix` `settings-notifications`: expected unchanged in classic (a skin with other `--sw-r-pill` / `--sw-r-sm` values would move). No pixel spec covers transit, announcements, presence, retention, elevator / generator settings or external access |
| WP4 home | `visual-matrix` `devices-home` (ready / dialog), `devices-building`, `devices-schedules`: no change expected (if `devices-home` differs it would be the media-chip hover gate under a hovering pointer only - review before accepting). Evidence shots only (not baselines): home edit mode (the bar's height is kept free, 44 px controls on touch), automations at 820 / 1024 / 1180 (two-row header, three-column cards), announcements (focus ring, shadow) |

## Runner work still needed (NOT_RUN here)

`visual-matrix --all`; `evidence-shell` (status dot note, desktop / tablet / mobile); `layout-a11y-295`; the unit page specs that need the
built app; `evidence-polish4-wp3-service`; `evidence-media-players` / `layout-bubble-screens` (WP5 edit chips); the WP2 specs that need
`SW_LIVE=1`. WP4: `layout-home-edit-bar-wp4.spec.ts` (dev-server `spec` job), `evidence-automations-list`, `layout-home-widgets-wide-298`, `visual-matrix`
devices-home / devices-building / devices-schedules. WP8: `pixel-access-status`, `pixel-access-s12`, `visual-matrix` settings-notifications,
`evidence-polish4-wp8`. Hover gates, aria and role changes of this pass need no baseline.

Note (WP8, not changed): `system-access-polish-css.ts` cancels the hover of `button.row` / `.sw` under `@media not ((hover: hover) and
(pointer: fine))` (an undo pair instead of a gate at the source); it works, and the rows are WP8's only such pair.
