# DARK-SEG-ALL-2380 - every segmented control: the chosen key 3:1 from its track in dark

Owner-approved 03.11 (morning) for release 2.38.0. Branch `fix/DARK-SEG-ALL-2380` from `release/2380-train` @ 0c2189c62.

## What and why

WCAG 1.4.11 asks a chosen segment to stand 3:1 from its track; its label needs 4.5:1 (1.4.3). In 2.37.0 (GATE2370-B) the
shared settings key (`styles/settings.ts` `settingsSegStyles`) got two dark tokens, `--sw-seg-key` (the fill: `--sw-text`)
and `--sw-seg-key-ink` (the label: the opaque `--sw-surface-solid`). In dark the chosen key became a light pill with a dark
label, like the glass screens. Light stayed as it was.

About 60 other segmented controls kept their own copy of the old dark key. Some used the `--sw-seg-thumb` lift, which reads
1.1-1.3:1 from its track. Others used a plain `--sw-surface` key, which is darker than its surface-3 track (about 1.25:1, a
hole). This change moves all of them onto the same two tokens.

**How (one token pair, not 60 copies).** Each control keeps its own geometry and its own light fill, ink and shadow; only the
fallback chain changes:

```css
background: var(--sw-seg-key, <its light fill>);
color: var(--sw-seg-key-ink, <its light ink>);
box-shadow: var(--sw-seg-thumb-shadow, <its light shadow>);
```

All three tokens are `initial` (guaranteed-invalid) in the light column of every skin, so light falls back to exactly the
values it had. A shared stylesheet such as `settingsSegStyles` could not be adopted as is: the controls differ in radius, height,
font size and padding, so the light pixels would have moved. The dark values live in one place, `design/tokens.ts`. Glass hosts
keep their own knobs: `styles/devices-themes.ts` resets the key tokens (devices glass screens), and the `--sw-seg-on-*` knobs
(service-management glass, home options) still come first in the chain.

`--sw-seg-thumb` is retired (`design/tokens.ts`, the soft skin's override, the glass reset). The lint fails on any new read of it.

Extra fixes found on the way:
- `screens/home-screen-css.ts` `.pfl .segs` (the building floor filter): the dark ACCENT key read 2.78-2.89:1 from its surface-3
  track in classic, infra and soft. In dark it now draws the light pill too; light keeps the accent key.
- Inks inside a chosen key now follow the key: sw-tabs pill `.count`, calendars `.tab .n`, and a chosen shared building
  (`.bswitch button.shared`).
- `screens/live-camera.ts`: a hovered chosen transport key keeps the pill, because the shared round-button hover would have
  turned its fill to surface-2 under the dark label. The light hover is unchanged (surface-2, as before).
- `tests/unit-token-lint.spec.ts`: the service-module rule (no fallback for a declared token) now exempts tokens whose light
  value is `initial`. For those tokens the fallback is the light value.

## The controls (66 chosen-key rules; the lint inventory in tests/unit-dark-polish-beds.spec.ts)

| Family | Files |
|---|---|
| `.seg` (was the `--sw-seg-thumb` lift) | access-external/request-dialog, calendars/styles, components/frigate-admin-shared, components/sw-cast-picker, electricity/styles, elevators/elevator-settings, incidents/settings-form, insights/styles, maintenance/styles, notices/styles, screens/devices-layout-css (`.lay-seg`), explore-presence, home-screen-options, home-widgets, investigate-history-map, investigate-reviews, schedule-conditions, schedule-editor, schedule-entity-picker, system-brand-logos, system-building-presence, system-design, system-home-screen, system-look, system-mapping, system-nav-size, system-palette-editor, system-presence, system-timeline-colors, system-update, wiskey-events, shell/sw-home-personal, shell/sw-user-menu, temperature/detail, temperature/report, temperature/wizard |
| sw-tabs' pill | components/sw-tabs (`.on .lbl` + `.on .count`), design/skins/crystal, design/skins/domus (classic dresses only the shadow; tesla keeps its inverted pill, measured) |
| plain surface key (never had the thumb) | arx/arx-login (`button.mode`), calendars/cal-page (`.tab`), calendars/resident (`.tabs`), calendars/view-manage (`.rolepick`), components/device-activity (`.segt`, `.vw`), components/sw-timeline (`.windows`), components/sw-view-switch, maintenance/round-run (`.vw`), screens/area-quick-sheet (`.seg .on`), devices-building (`.bswitch`), investigate-events + investigate-ha-events (`.rangepick`), investigate-incidents (`.ptabs`), investigate-reviews (`.layers`), live-camera (`.transport`), plan-studio6-panel (`.seg.sm`), schedule-create-dialog (`.tabs`), security-alarm (`.vt`), system-brand-installer + system-brand-logos (`.tabs`), system-readiness (`.panes`), wiskey-person-drawer (`.tabs`), shell/sw-app (`nav.sections a.on`, the phone row's `.pill`) |
| accent key on a surface-3 track | screens/home-screen-css (`.pfl .segs`) |
| the shared settings key (2.37.0) | styles/settings.ts (unchanged) |

Checked and left as they are:
- Accent keys on the card surface pass in dark: live-wall `.layouts` (the raised tray), system-plan-view `.range`,
  plan-studio-panel `.modes`, system-audit `.pages`.
- Glass hosts keep their own knobs: media-glass `--mm-seg-thumb`, tickets `--sw-seg-on-*`, the devices glass reset,
  system-notifications `.sevseg`.
- The frozen bubble skin is not drawn.
- Not segmented controls: security-alarm `.switcher` and system-look `.range` are separate chips (accent border / soft
  fill); explore-floor-map `.layers` is multi-select layer toggles (accent-soft in its final rule).
- Under a pointer press, investigate-reviews' `.seg button:active` paints the pressed wash on the chosen key too. This is
  momentary and was left alone.

## Receipts

Dark values (unit model, every live skin): a chosen key reads **10.8-12.6:1** from a surface-3 track in a card (classic
10.82, domus 11.11, tesla 12.55, crystal 11.60, infra 11.51, soft 11.21). It is at least 3:1 on all five tracks a segmented
control draws (surface-3 / surface-2 in a card, surface-3 in the user menu, surface-2 on the page, the card surface). Its label
is **14.2-15.5:1**. An unchosen `--sw-text-2` label reads 6.0-7.1:1 on the surface-3 track. Before: the lift was 1.1-1.3:1
and the plain surface key about 1.25:1, darker than the track.

In the browser (runner, preview, `tests/evidence-dark-seg-all-2380.spec.ts`, classic dark): 10 screens x desktop / tablet /
mobile, 30 runs, 81 chosen keys. The lowest label is 14.27:1 and the lowest key-to-track ratio is 10.82:1; a key whose track is a
`::before` (sw-tabs' pill, the phone security row) is measured against the card and reads 16.17. The screenshots are written
under `docs/design/evidence/DARK-SEG-ALL-2380/` on the runner. They are not copied back and not committed.

The first browser run caught a real gap. On the phone, the security row's chosen link is transparent: the key is drawn on
its `.pill`. The receipt measured the link and read 1.13:1. It now measures the pill. The pixel review confirmed that the
pill draws the light key with the dark label.

### Tests

- Unit (local, node, workers=1). The full `tests/unit-*` run: 3752 passed, 1 failed, 1 skipped. The failure was the token-lint
  service rule, now fixed; its file plus unit-dark-polish-beds plus unit-polish4-shared then gave 24/24 passed. The extended
  `tests/unit-dark-polish-beds.spec.ts` has 7 tests: 67 chosen-key rules collected from the source, 4078 measurements, the
  66-entry inventory lint, a pattern lint for new controls and for `--sw-seg-thumb`, and the light `initial` check.
- `tsc --noEmit` (local): pass.
- Runner, preview, workers=1, three jobs:
  1. The pixel suites, no update: visual-matrix, every pixel-wiskey-*, wall-plan, notice-tv-portrait-chips, access-*,
     bustimes, nvr-encoding-batch, walk-touch, evidence-replay-3d, plus evidence-polish2-295. Result: 316 passed, 30 failed,
     194 skipped. Of the 30, 29 failures were dark baselines and 1 was light (security-alarm-ready-light, tablet; see below).
  2. With `-u` on the failing specs plus the new receipt: 34 baselines came back. 32 dark ones were reviewed image by image and
     committed. The 2 light ones were **reverted, not committed** (see below).
  3. Confirmation without `-u`: the same pixel specs plus evidence-dark-seg-all-2380, evidence-polish2-295,
     evidence-menu-opaque, evidence-tabs-dropdown and evidence-infra-tabs. Result: 383 passed, 16 failed, 117 skipped.
     15 of the failures are evidence-tabs-dropdown. That spec imports `/src/...` modules, so it only runs on a dev server.
     The 16th is the light security-alarm tablet baseline (train drift, below).
  4. evidence-tabs-dropdown on the dev server (`run_smart.py spec`): 48 passed, 6 skipped.

### Light baselines

**No light baseline is changed by this branch.** Two light baselines differ on the runner, and both differences come from
the train, not from this change:
- `visual-matrix` `security-alarm-ready-light-tablet`: the OFF switches are drawn with the train's new darker OFF track.
  `release/2380-train` e2391a9a7 refreshed the other OFF-switch baselines but not this one.
  The desktop light and dark copies were refreshed in e2391a9a7. This tablet copy fails the same way before and after this
  change.
- `pixel-wiskey-messaging` `settings-classic-errors-390-mobile`: during the `-u` run it came back about 1 px lower, with
  identical segments. In job 3 it passed against the committed baseline, so that difference was a one-off.

The tablet security-alarm light baseline is left for the train owner to refresh.

## NOT_RUN

- Local vite build or preview and local Playwright evidence runs: the workstation is low on memory. All browser checks ran
  on the runner.
- Skins other than classic in the browser receipt. The unit model covers every live skin.
- Device or HA checks: not needed, UI only.
