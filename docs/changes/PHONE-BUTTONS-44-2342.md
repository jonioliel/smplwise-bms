# PHONE-BUTTONS-44-2342 - the shared button is drawn 44 px high on a phone

Branch `fix/PHONE-BUTTONS-44-2342`, cut from `origin/release/2340-train`. Owner-approved 02.11 (round 13, answer 2A). No version bump,
no backend change, not merged. Follows "Not fixed - for the owner" item 1 of `docs/changes/A11Y-POLISHED-2342.md` (on
`fix/A11Y-POLISHED-2342`): an invisible 44 px hit layer was tried there and reverted (an absolutely positioned layer paints above
non-positioned neighbours and steals their edges - the 44 px cross probe of `layout-a11y-295` counts that as a miss). This branch does it
visibly.

## What changed

Phone = `(max-width: 767px) and (pointer: coarse)` (the same gate the button already used). Desktop and tablet are unchanged.

| Size | Before (phone) | After (phone) | Desktop / tablet |
|---|---|---|---|
| `size="sm"` | 36 px drawn (+4 px invisible slop above / below), padding 9 px | **44 px drawn**, padding-inline 11 px (9 x 44/36) | unchanged (`--sw-ctl-h-sm`, 9 px) |
| default (`md`) | 40 px drawn (+3 px slop), padding 12 px | **44 px drawn**, padding-inline 13 px (12 x 44/40) | unchanged (`--sw-ctl-h-md`, 12 px) |
| `size="lg"` | 44 px | 44 px | unchanged |
| icon-only sm / md | 36 x 36 / 40 x 40 | **44 x 44** | unchanged |

Still `max(44px, var(--sw-ctl-h-*))`: a screen that asks for larger controls keeps them.

- `frontend/src/components/sw-button.ts`: the phone block above.
- `frontend/src/design/mobile-polish-css.ts` (the phone layer, adopted into every shadow root AFTER the skin sheet): the invisible
  `::after` hit slop is removed, and the same heights / icon-only widths are repeated there at the skins' specificity. Reason: the skins'
  own resting rules (`crystal`: `:host(sw-button) button { min-block-size: 34px }`, sm 30 px; `bubble`: the touch dial) sit in a later
  sheet with a higher specificity than the component's own phone rule, so on a phone crystal drew 34 / 30 px buttons before this change;
  now every skin draws 44 px.

## No-scroll / toolbars on a phone

- The no-scroll guard of the control screens (`layout-noscroll-297`) is desktop-only (1440x900, 1920x1080); the fit-to-height list
  guards (`evidence-noscroll-295`, `layout-timescrub-noscroll`) measure their 390 / 375 px cases with a fine pointer, so the 44 px
  rule does not apply there; the paged lists measure their own row heights at run time either way.
- The phone checks were run on the runner (mobile project, Pixel 7 = coarse pointer) - results below. No toolbar wrapped or overflowed,
  so no spacing was changed.

## Tests

- `frontend/tests/unit-phone-buttons-44.spec.ts` (new, node): the phone block draws sm / md at 44 px with the new padding, icon-only
  44 px, no 36 / 40 px floor left; the desktop / tablet resting rules unchanged; the phone layer repeats the heights and has no slop.
- `frontend/tests/evidence-mobile-touch.spec.ts`: the shared button check is 44 px (was 40); new test - sm, default, icon-only and
  icon-only sm drawn >= 44 px in every skin under test, no `::after` slop.

## Results (2026-11-02)

- `tsc --noEmit`: clean.
- Unit (node, `--workers=1`): the new spec 3/3 plus every gating lint (`unit-*lint*`) and the design-token / phone-layer / skin specs
  (`unit-polish-phone-297`, `unit-design-tokens`, `unit-designtokens-297`, `unit-skinfound-297`, `unit-uxfix-nav-295`): **65 passed, 0 failed**.
- Runner, mobile project (Pixel 7, coarse pointer), workers 1, batch 1: `layout-a11y-295` (the 44 px cross probe - every probe now lands
  on the drawn button), `evidence-mobile-touch` (incl. the new every-skin test), `layout-uxfix-nav-295`, `evidence-sharedui-295`,
  `layout-devices-break-297`, `evidence-playback-controls-below`, `layout-bubble-screens`, `evidence-home-phonefloors-295`,
  `evidence-wall-phone`, `layout-tickets`: **52 passed, 0 failed, 25 skipped** (project-scoped / frozen-skin skips). The tickets
  calendar phone header ("the controls above the first event are shorter than the audit measured") and the notification-rules chip rows
  still fit.
- Runner, mobile project, batch 2 (the phone pixel suites + phone fit guards): 98 passed, 44 skipped, **51 failed - all 51 are
  `toHaveScreenshot` diffs** (expected: the buttons grew); no layout / overflow / no-scroll guard failed (`evidence-noscroll-295`,
  `layout-timescrub-noscroll`, `layout-tickets-calendar`, `dropdown-phone-choice`, `layout-access-status`, `evidence-replay-3d`
  passed or are project-skipped). These diffs were NOT compared against a run of the base train, so a few may be pre-existing.

## Phone pixel baselines that change (`*-mobile-linux.png`, refresh on the runner before a train)

| Spec | Failing cases (mobile) |
|---|---|
| `pixel-access-events` | classic: empty / error / forbidden states |
| `pixel-access-schedules` | classic + domus: door view with library and proposals; classic: table / door sheet; paused program, draft, offline error; empty / error / forbidden |
| `pixel-nvr-encoding-batch` | classic + domus: settings and preview |
| `pixel-wiskey-messaging` | person's messages tab (light, dark; opted out / empty / failing); message dialog (form, sent, uncertain; opted-out person, code-like text, hourly limit); bulk dialog; Settings "הודעות" |
| `pixel-wiskey-people-writes` | actions menu + cards (light, dark); question + answer; not sent / unknown / delete pending; removal question + photo; contractor editor |
| `pixel-wiskey-people` | list + person page (light, dark); access per station; names-level operator; cards view; selection bar; empty / error / forbidden; stale strip; message dialog |
| `pixel-wiskey-station-media` | classic + domus: drawer with live video + push-to-talk (light, dark); talking / busy / no talk; talking dark |
| `pixel-wiskey-stations` | classic + domus: station cards + drawer; list / table / door settings; release confirmation; announcement composer; last-known copy / empty / refused; places sheet |
| `visual-matrix` | devices-home dialog, map-floor ready, security-alarm ready, settings-diagnostics ready (light and dark each) |

`pixel-access-s12`, `pixel-access-status`, `pixel-walk-touch` mobile baselines did not change. Desktop and tablet baselines are not
affected (the rules are phone + coarse-pointer gated); not re-run here.

## NOT_RUN

- Desktop / tablet projects of the specs above (no rule applies there).
- Baseline refresh itself (`-u`): left to the train owner per the baseline rule.
