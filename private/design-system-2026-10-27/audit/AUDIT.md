# Whole-UI design audit and redesign rollout plan (2026-10-27)

Branch `pilot/DESIGNAUDIT-297` at the `release/2240` head (b6996284f, v2.24.0). Read-only on product code; this folder is the
only output. Owner rule of 27.10: every page and screen is redesigned with the installed design skills, and **no screen is
released from now on unless it passed design with those skills**. This document is the inventory (§2), the skill-based
critique of a 19-screen sample (§3-§4) and the wave plan with per-wave acceptance checklists (§5-§6).

It builds on, and does not repeat, three documents written today:

- `docs/design/system/AUDIT_2026-10-27.md` (this branch's earlier design-system audit, now on `release/2240`): the token /
  skin / knob-layer inventory, 404 rendered captures of 25 screens on v2.23.2, severity-ranked system findings `P0-1 ... P3-3`.
  Referenced below as **[DS-audit]**.
- `private/design-system-2026-10-27/docs/{DESIGN,TOKENS,COMPONENT_RULES}.md`: the foundations, directions A "Arx Infra"
  (recommended) / B "Arx Ops" / C "Arx Soft". Referenced as **[DESIGN.md]** / **[COMPONENT_RULES]**.
- `private/design-system-2026-10-27/round2/NOTES.md`: round 2 of the six reference mockups, with a per-skill table of what each
  skill changed. Referenced as **[R2]**. The skins `arx-infra` (`design/skins/infra.ts`) and `arx-soft` (`skins/soft.ts`) exist
  in code as token foundations only; their component rules come with the build waves below.

## 0. Summary

**Inventory.** `frontend/src/screens` + `frontend/src/components` = 403 TypeScript files, 303 of them define a custom element
(Appendix A). Grouped by what a user opens, the product has **~120 screen-level pages** in 13 areas (§2), plus 9 standalone
surfaces (sign-in, TV board, kiosk wall, public ticket portal, PWA pages, native app views, print). 54 of the 403 files are on
the glass `--dv-*` family (the skin cannot fully reach them); 22 are targeted by skin component rules.

**Verdict from the sample.** The product is functionally rich and RTL-correct, never overflows horizontally (0 of 97 captures),
and the infra screens (elevators, temperature, schedules) are already the right look. What keeps it from "beautiful and
advanced" is not decoration but **composition and discipline**: too many control rows before content, desktop pages that use
a third of the canvas, status colour used as decoration, empty / loading / forbidden states pinned small at the top of a
large empty page, phone tab rows clipped mid-word, and 50-70 sub-44 px targets per desktop screen. The impeccable detector
finds almost no "AI slop" tells in the sampled code (1 warning: a 4 px side stripe in `infra-elevators.ts:88`); the problems
are structural, which is good news: they are fixed once in shared components and inherited.

**Top 10 findings** (detail and evidence in §4; the skill that surfaced each in brackets):

1. **Control rows before content.** Tickets: up to 5 rows (area pill, view tabs, department chips, mine/department segmented,
   status chip grid, search / filter / new, view switch, KPI tiles) before the first ticket; WisKey people: 8 filter dropdowns
   in one row; events on phone: 3 full-width dropdowns + date + chips, first event at ~360 / 844 px. [impeccable critique:
   cognitive load, >4 options per decision point; taste-skill app-screens]
2. **Phone tab rows clip mid-word at both ends with no affordance** (WisKey "מרכז הכניסה ... עמ", settings sub-tabs, live
   chips, WisKey station filter chips). [mobile-native; break-ui; ui-ux-pro-max navigation rules]
3. **Status colour used as decoration.** KPI tiles carry a tinted icon box; when everything is fine the loudest element on the
   page is a green camera / door box (live overview, WisKey overview and station cards). Green is "status", but here it is the
   page's accent. [taste-skill (KPI = dot, number, word); impeccable colorize / quieter; owner rule "no greens as accents"]
4. **Desktop composition uses a fraction of 1440 x 900.** WisKey overview: KPIs in a third of the width and content ending
   at ~45 % of the height; settings: a ~440 px content column beside half a screen of nothing; home: floor cards in 2/3 of the
   width with a 9-tile KPI strip of ~110 px tiles above. [taste-skill grid arithmetic; impeccable layout]
5. **Control screens still scroll** (owner rule): media screens 405 px of inner scroll at 1440 x 900, live overview 34-58 px;
   on phone the home floor tree starts ~620 px down (every widget is a full-width card first). [impeccable layout; owner rule]
6. **Contrast misses** on state: temperature status pills white-on-colour 1.8-3.8:1 [DS-audit P1-2], notifications dark
   selected segment 1.0:1 [DS-audit P1-3], domus / crystal dark sign-in primary = light blue with a white label. [ui-ux-pro-max
   accessibility; impeccable audit]
7. **Small targets everywhere on desktop**: 50 (home), 61 (schedules), 71 (settings), 34 (events, security) interactive
   elements under 44 x 44 inside the first viewport; wall tablets use the same screens. [ui-ux-pro-max touch-target rule;
   apple-design HIG]
8. **Type without a scale**: 7-14 distinct sizes per screen, smallest 10 px (10.5 in domus), half-pixel tiers in three skins,
   and glass screens declare `-apple-system` first so the same Hebrew renders in two families. [taste-skill §9.1; impeccable
   typeset; DS-audit P1-1 / P1-7]
9. **Worst-case data breaks meaning, not layout**: user-entered Latin strings in RTL truncate from the wrong end (only 29
   `dir="auto"` in the code base), a long name widens the WisKey people name column at the expense of the others, station
   cards spend ~60 % of their height on a "no image" placeholder. [break-ui]
10. **States are an afterthought**: loading = icon + "טוען...", the forbidden / module-off panels sit 120 px from the top of an
    empty 1440 canvas (elevators without permission, notice board off), no skeletons. [impeccable harden; emil-design-eng;
    DS-audit P2-9]

Further: hover effects fire on touch (358 of 367 `:hover` rules ungated) and only 5 of 56 `:active` rules give press
feedback [emil-design-eng; mobile-native]; motion opportunities are listed per screen in §4.

**Plan.** A foundations wave (W0: shell, the twelve shared components, guards, domus in the pixel matrix) and then **12
screen waves of at most 8 screens** in priority order: daily operator core first, settings and power tools last (§5).
Rough estimate: **W0 4-5 working days, each screen wave 2-4 days, ~35-40 agent-days in total; 4-5 calendar weeks with two
waves in flight after W0.** Each wave ends with the checklist of §6, which names the skill that must have been applied for
each item; a screen that has not passed it does not ship.

**Recorded contradiction (needs an owner answer, not resolved here).** The owner's rule of today says both logos appear "on
every screen"; the approved logo change (CR-LOGOS295 §3 P2, owner 24.10) says that on the **phone** the inner screens have no
logo row (company logo only at the head of the home screen, the SmplWise mark in the bottom bar). Desktop is consistent with
both. The plan keeps the 24.10 phone behaviour until the owner decides (question 1 in the Hebrew summary).

## 1. Method and evidence

| What | How | Result |
|---|---|---|
| Inventory | regex scan of every `.ts` in `frontend/src/screens` and `frontend/src/components` (custom element, size, glass family, skin-rule targets, literal hex, first doc comment); routes from `shell/nav.ts` and the `*_HREF` constants | Appendix A (403 rows); §2 |
| Rendered capture | the **built** v2.24.0 UI (`smplwise_vms/www`, `?design=a` demo mode, `look=performance:full`) served locally, Playwright Chromium, desktop 1440 x 900 and phone 390 x 844 (Pixel 7 UA); classic light, domus dark, **arx-infra light** (desktop); 19 routes + TV board 1920 x 1080 / 390 | 97 captures, 0 page errors, a DOM probe per capture (document / inner overflow, sub-44 px targets in the first viewport, rendered families and sizes). Scratch only, not committed |
| break-ui (approximate) | in the rendered demo screens, the visible names were replaced by a 62-character Hebrew name and an unbroken 76-character Latin e-mail-like string, then overflow / clipping / escape were measured, desktop and phone | 0 boxes escaped, 0 horizontal overflow; the meaning problems in finding 9 seen on the screenshots |
| impeccable detector | `impeccable detect --json` on the 19 source files of the sampled screens (shell, KPI, WisKey, home, tickets, elevators, settings, sign-in, events) | 1 warning (side-tab, `infra-elevators.ts:88`); [DS-audit §2.6] has the whole-tree run (20) |
| Earlier evidence reused | [DS-audit] 404 captures (v2.23.2, 4 skins x 2 schemes x 2 sizes, 25 screens) in `private/review/design-audit-2026-10-27/` | sign-in, settings, tickets on phone, temperature, notifications contrast |

**Honest limits.** This is a single-context run: the impeccable `critique` command asks for two isolated assessments (design
review + detector / browser overlay) run as sub-agents; here both were done in one context, so the critique is
`DEGRADED: single-context`, and the live-server overlay was not injected. Demo mode has no data for elevators (renders "no
permission"), the notice board (module off) and the area page (renders the building page); those are critiqued from
[DS-audit]'s fixture captures. No real phone, no wall tablet, no keyboard / screen-reader pass, no `review-animations` (the
skill is owner-invocation only, as [R2] also found). Contrast was not re-measured in this run (taken from [DS-audit]).
Nothing here was tested on English (`lang=en`) text beyond reading the `i18n/en.ts` coverage.

## 2. Screen inventory

Skin sensitivity: **H** = on the glass `--dv-*` family or targeted by skin component rules or heavy literal colour (a skin
change can break it or leave it half-styled); **M** = reads `--sw-*` tokens only, same layout in every skin; **L** = fixed
surface (video, map, TV, print) where skins change only the chrome. "Pixel" = in the visual matrix today
(`frontend/tests/visual/matrix.json`, **classic only**). Phone = the page is reachable from the phone bottom bar.

### 2.1 Operator areas

| Area | Page | Route | Main file(s) | Purpose | Skin | Pixel |
|---|---|---|---|---|---|---|
| Home | Home / building | `#/devices/building` (`/devices`) | `devices-building.ts`, `home-widgets*.ts`, `home-ambient-bar.ts` | widgets (clock, weather, Shabbat, alarm, screens, bus) + floors / areas tree + floor cards | H (glass + 4 skin rule sets) | yes (2) |
| Home | Area | `#/devices/building?area=` | `devices-area*.ts` (4 files), `devices-tiles-panel.ts`, `devices-controls.ts` | one area's devices as tiles / list, control drawer | H | via home |
| Home | Home edit | `#/devices/building?edit=1` | `home-edit-panel.ts`, `home-edit-bv1.ts`, `home-screen-options.ts` | arrange widgets and tiles | H | no |
| Home | Personal home | (user menu) | `shell/sw-home-personal.ts` | per-user start page | M | no |
| Security | Live overview | `#/live` | `live-overview.ts` | KPIs, site health, storage, attention list, recent events | M | no |
| Security | Wall | `#/live/wall` | `live-wall.ts`, `wall-*.ts` (4) | camera grid sized to the viewport | L | yes |
| Security | Saved views | `#/live/views` | `live-views.ts` | named camera layouts | M | no |
| Security | Single camera | (from wall / map) | `live-camera.ts`, `components/sw-live-player.ts` | one stream, PTZ, snapshot | L | no |
| Security | Alarm | `#/security/alarm` | `security-alarm.ts` | arm / disarm, zones | M | yes |
| Security | Events | `#/investigate/events` | `investigate-events.ts`, `investigate-event-detail.ts` | event centre, filters, detail | M | no |
| Security | Playback | `#/investigate/playback`, `/sync` | `investigate-playback.ts`, `investigate-sync.ts`, `components/sw-timeline.ts` | recordings, timeline, synced playback | L | no |
| Security | Search / reviews / cases / exports / rules / history / incidents / health | `#/investigate/{search,reviews,cases,exports,rules,floors/f0/history,incidents,health}` | `investigate-*.ts` (8), `components/frigate-*.ts` (14) | analytics review, cases, exports, rules, history on the map, incidents | M (frigate cards hex-heavy) | no |
| Map | Floors map | `#/explore/floors/f0` | `explore-floor-map.ts`, `explore-floors.ts`, `map/*` | the plan with live objects | L | yes |
| Map | Sites / presence / entities | `#/explore/{sites,presence}`, `#/system/entities` | `explore-sites.ts`, `explore-presence*.ts`, `explore-entities.ts` | multi-site, who is where, entity explorer | M | yes (sites) |
| Map | Plan editor / studio | (plan tools) | `explore-plan-editor.ts`, `explore-plan-import.ts`, `plan-studio*-panel.ts`, `plan-*` | draw floors, walls, place devices | M (12 hex) | no |
| Devices | Schedules | `#/devices/schedules` | `schedule-*.ts` (13), `schedules-*.ts`, `components/sw-schedule-*.ts` | weekly schedules, editor, templates | H (glass) | yes |
| Devices | Automations | `#/devices/automations` | `automation-*.ts` (13), `devices-automations.ts` | builder (when / if / then), code view | H (glass) | no |
| Devices | Scenes / scenarios / scripts | (devices tabs) | `scenes-panel.ts`, `scene-editor.ts`, `scenarios-panel.ts`, `scripts-panel.ts`, `components/sw-scene.ts` | scenes, emergency scenarios, scripts | H (glass; `sw-scene` 176 hex) | no |
| Devices | Notices | `#/devices/notices` | `devices-notices.ts`, `notices/*` | notice board admin (compose, reads, display design) | M | no |
| Devices | Announce | `#/devices/announce` | `devices-announce.ts`, `announce/*` | voice / screen announcements | M | no |
| Devices | Bulk edit / types | (devices tools) | `devices-bulk.ts`, `devices-type-admin.ts`, `devices-climate-kind-admin.ts`, `devices-protected-switches-admin.ts` | bulk device admin | M (bubble rules) | no |
| Multimedia | Screens / players / groups | `#/multimedia/{screens,players,groups}` | `multimedia-*.ts` (7), `components/media-*` (25) | TVs, players, remote, now playing, groups | H (glass + `--mm-*` / `--mr-*`, 69 hex in remote) | yes (screens) |
| WisKey | Entry centre | `#/wiskey/overview` | `wiskey-overview.ts` | KPIs, intercom cards, attention list | M | no |
| WisKey | Activity | `#/wiskey/events` | `wiskey-events.ts`, `wiskey-event-drawer.ts`, `wiskey-events-export.ts` | door events, filters, export | M | no |
| WisKey | People | `#/wiskey/people` | `wiskey-people.ts`, `wiskey-person-*.ts` (4), `wiskey-bulk-people.ts`, `wiskey-card-capture.ts` | people, credentials, messages, bulk | M | no |
| WisKey | Stations and doors | `#/wiskey/devices` | `wiskey-stations*.ts` (6), `wiskey-station-permissions.ts`, `components/wk-*.ts` (5) | stations, live view, talk / listen / open | M | no |
| WisKey | Schedules / door windows | `#/wiskey/schedules`, `#/wiskey/door-windows` | `wiskey-schedules*.ts`, `door-windows.ts`, `door-automation-*`, `door-path-logic.ts` | access schedules, door open windows | M (glass in door blocks) | no |
| WisKey | Sync / health / audit / tools / external | `#/wiskey/{sync,health,audit,tools,external}` | `wiskey-embed*.ts`, `access-external.ts` | sync state, health, audit log, classic panel, external requests | M | no |
| Infra | Elevators | `#/infra/elevators` | `infra-elevators.ts`, `elevators/*` | KPI row, elevator cards, 24 h bar (reference look) | M | no |
| Infra | Temperature | `#/infra/temperature` | `infra-temperature.ts`, `temperature/*` | gauges, sparkline, report, wizard (reference look) | M | no |
| Infra | Generator | `#/infra/generator/live` (+ charts, log, alerts) | `infra-generator.ts`, `generator/*` | live flow, charts, log, escalation | M (gen styles side stripe) | no |
| Infra | Electricity | `#/infra/electricity/{meters,accounts,bills,customers}` | `infra-electricity.ts`, `electricity/*` (31) | meters, accounts, bills, formulas, TOU | M (print paper L) | no |
| Infra | Water | `#/infra/water/{meters,accounts,bills,customers,usage,alerts,settings}` | `infra-water.ts`, `water/*` | water meters and billing | M | no |
| Infra | Insights / report | (infra tabs) | `insights-*.ts`, `infra-report.ts` | doors / waste insights, infra report | M | no |
| Service | My / department / all requests | `#/tickets/{mine,department,all}` | `tickets-list.ts`, `tickets-table.ts`, `tickets/*` (162) | request list / table / calendar | H (glass) | no |
| Service | Board | `#/tickets/board` | `tickets-board.ts`, `tickets/board-*` | manager board with tree | H | no |
| Service | Overview / handlers / RFQs / maintenance / reports / accounts / external | `#/tickets/{overview,handlers,rfqs,maintenance(/ledger),reports/building,accounts,external}` | `tickets-overview.ts`, `tickets-handlers.ts`, `tickets-rfqs.ts`, `tickets-maintenance.ts`, `maintenance/*` | manager dashboard, vendors, quotes, maintenance rounds, reports | H (glass) | no |
| Shell | Rail, header brand cluster, phone dock, user menu, area picker, tab pair, notification centre | all | `shell/sw-app.ts`, `shell/phone.ts`, `shell/tab-pair.ts`, `shell/sw-user-menu.ts`, `components/notify-*` (11), `components/sw-brand.ts` | the frame of every screen | H | all |

### 2.2 Settings (`#/system/...`)

| Group | Pages (route suffix -> main file) | Skin | Pixel |
|---|---|---|---|
| Settings home and navigation | `system` -> `system-index.ts`, `settings-nav-strings.ts`, `system-tabs*.ts`, `system-nav*.ts`, `system-nav-size.ts`, `tabs-place-strings.ts` | H (skin rules on nav) | no |
| Look and brand | `look` -> `system-look.ts`; `system-design.ts`; `system-brand-{logos,colors,installer}.ts`; `system-palette-editor.ts`; `system-home-screen.ts`; `system-timeline-colors.ts`; `devices-theme-picker.ts`, `devices-style.ts` | H | no |
| Users and access | `local-users`, `ha-users`, `access`, `access-control` -> `system-local-users.ts`, `system-ha-users.ts`, `system-access*.ts` (11), `system-lookup-scope.ts`, `system-service-identity.ts`, `user-identity.ts`, `components/sw-passkeys.ts`, `sw-second-factor.ts` | M | no |
| Security | `security`, `security/{cameras,nvr,privacy-masks,public,wiskey,alarm,incidents,manage}` -> `system-security*.ts` (5), `nvr-*.ts` (10), `privacy-mask-logic.ts`, `system-alarm.ts`, `system-wiskey-diagnostics.ts`, `system-video-conn-test.ts` | M | no |
| Notifications and messaging | `notifications`, `messaging-accounts`, `notices`, announcements -> `system-notifications.ts`, `system-messaging-accounts.ts`, `messaging-*-card.ts`, `system-notices.ts`, `system-announcements.ts`, `system-announce-templates.ts` | H (notifications on glass) | yes (notifications) |
| Modules | `multimedia`, `cast`, `wall`, `schedules`, `automations`, `devices`, `tickets`, `transit`, `infra(/elevators ...)`, doors -> `system-multimedia*.ts`, `system-cast.ts`, `system-wall.ts`, `system-schedules.ts`, `system-automations.ts`, `system-devices.ts`, `system-tickets.ts`, `system-transit.ts`, `system-infra.ts`, `system-doors*.ts`, `system-door-blocks.ts`, `system-emergency-open.ts` | M (tickets glass) | no |
| Presence and mobile | `diagnostics?tab=mobile(&page=places)` -> `system-presence*.ts` (3), `system-mobile-options.ts`, `presence-opt-out.ts` | M | no |
| System administration | `update`, `storage`, `diagnostics`, `readiness`, `fleet-report`, `audit`, `setup`, `wizard` -> `system-update.ts`, `system-storage.ts`, `system-diagnostics.ts`, `system-readiness.ts`, `system-fleet-report.ts`, `system-audit.ts`, `system-setup.ts`, `system-wizard.ts`, `components/sw-offbox-backup.ts`, `sw-secrets-card.ts`, `recorder-health-panel.ts` | M | yes (diagnostics) |
| Internal | `styleguide-screen.ts`, `placeholder-screen.ts`, `bubble-demo.ts`, `home-demo.ts` | M | no |

### 2.3 Standalone surfaces (outside the shell)

| Surface | Entry | Main file(s) | Skin |
|---|---|---|---|
| Sign-in / welcome / pre-gate | before the session | `arx/arx-login.ts`, `arx/arx-welcome.ts`, `arx/pre-gate.ts` | M (every skin, both schemes) |
| TV notice board | `notice-tv.html` | `notice-tv/main.ts`, `tv.css`, `tv-v2.css`, `v2-transit.ts` | L (own type ramp, 253 literal colour points) |
| Kiosk wall tablet | wall mode | `screens/kiosk-wall.ts`, `wall/sw-wall*.ts` | L/H (108 token fallbacks in `sw-wall.ts`) |
| Public ticket portal (vendors, residents) | `/t/...` | `public-ticket/**` (own CSS) | own product styles |
| PWA pages | offline, install prompt, push settings | `pwa/offline-page.ts`, `pwa/arx-pwa-prompts.ts`, `pwa/notifications-settings.ts` | M |
| Native app views | Android / iOS shell | `arx/native-app.ts`, `arx/native-device-view.ts`, `arx/android-download.ts`, `mobile/*-shell` | M |
| Print / PDF | bill, reports | `electricity/elec-bill-paper.ts`, `temperature/report.ts`, `insights/report-preview.ts` | L |

### 2.4 Shared components (what every wave inherits)

The 133 files of `frontend/src/components`: 52 `sw-*` primitives (button, card, chip, pill, badge, kpi, tabs, dropdown,
field, toggle, dialog, drawer, sheet, popover, table, pager, state-panel, place-tree, steps, timeline, schedule grid / bar,
week grid, view-switch, vslider, camera-tile, live-player, brand, icon, avatar, page ...), 25 media components, 14 frigate
(analytics) panels, 11 notification-centre files, 5 WisKey station controls (`wk-*`), NVR / recorder cards, device-activity.
Adoption gaps [DS-audit §2.4]: 1,981 raw `<button>` vs 1,635 `sw-button`, 499 native `<select>` vs 39 `sw-dropdown`, 87
private segmented controls, 96 raw tables vs 29 `sw-table`. **This is why W0 exists**: a screen wave that restyles a page
whose controls are hand-rolled redoes the same work eight times.

## 3. The sample (19 screens) and how each skill was applied

| # | Screen | Captured (this run) | Extra evidence |
|---|---|---|---|
| 1 | Home / building | classic L, domus D, infra L; desktop + phone; break-ui | [DS-audit] 4 skins |
| 2 | Area | (demo renders home) | [DS-audit] "no demo data" |
| 3 | Cameras: live overview | 3 combos x 2 sizes; break-ui | |
| 4 | Cameras: wall | 3 combos x 2 sizes | [DS-audit] |
| 5 | Events | 3 combos x 2 sizes; break-ui | |
| 6 | Map (floors) | 3 combos x 2 sizes | |
| 7 | Devices: schedules | 3 combos x 2 sizes | [DS-audit] |
| 8 | Devices: media screens | 3 combos x 2 sizes | [DS-audit] |
| 9 | Notices | module-off state | [DS-audit] fixture capture |
| 10 | Tickets (mine) | 3 combos x 2 sizes (empty in demo) | [DS-audit] tickets / board / all with mocks, phone sheet |
| 11 | Elevators | "no permission" in demo | [DS-audit] fixture capture (reference look) |
| 12 | Temperature | 3 combos x 2 sizes | [DS-audit] contrast probe |
| 13 | Settings (index, look) | 3 combos x 2 sizes | [DS-audit] 4 skins, notifications contrast |
| 14-17 | WisKey: entry centre, people, stations, activity | 3 combos x 2 sizes; break-ui on three | new in this audit |
| 18 | TV notice board | 1920 x 1080 + 390 (inactive state) | [DS-audit] active board |
| 19 | Sign-in | | [DS-audit] 4 skins x 2 schemes |
| (+) | Phone views of all of the above | Pixel 7 profile | |

Skills applied, and the guidance used from each (all files under `.claude/skills/`):

| Skill | Guidance used for this audit | Applied to |
|---|---|---|
| **impeccable** | `reference/critique.md` (design-specificity verdict, Nielsen heuristics, cognitive load: >4 visible options per decision point is a failure), `reference/mode-operate.md` (a working screen reads as its category first; the world lends type, palette, density and one signature move only), `audit.md` five-dimension health score, `detect` CLI | all 19 |
| **taste-skill** | app-screens run: KPI = dot + number + word (no icon box), grid arithmetic (no orphan card, no empty band), type floor 11 px for labels, tabular numbers end-aligned, loading = skeleton of the real layout | all 19 |
| **ui-ux-pro-max** | UX guideline search: touch targets >= 44, contrast 4.5 / 3:1, focus 2 px, `aria-busy` skeletons, navigation patterns (tab overflow), forms (label above, error inline) | all 19 |
| **break-ui** | worst-case catalogue (long name, unbroken Latin, 0 / 1 / many, missing image, mixed scripts), "change the data, not the component" | home, live overview, events, WisKey x3 (rendered); tickets, elevators (from [DS-audit]) |
| **emil-design-eng** | press feedback (scale .97), no `scale(0)`, transitions over keyframes for repeated interactions, enter / exit asymmetry, origin-aware popovers, number change with tabular figures | shell, KPI, toggles, tabs, dialogs, all lists |
| **mobile-native** | sticky hover, tap highlight, `100dvh`, 16 px inputs, safe-area, `touch-action`, overscroll, horizontal-scroll affordance | all phone captures |
| **apple-design** | materials and depth (never glass on glass), sheets / drawers as physical objects, springs without bounce for panels, reduced-motion / reduced-transparency | domus / crystal / Soft screens, drawers, sheets, phone dock |
| **find-animation-opportunities** / **animate** / **animation-performance** | "should it animate at all" filter; composite-only properties; blur budget | per-screen motion row in §4 |
| **motion** | not used here (no implementation); it is the tool for the CSS `linear()` springs in W0 | - |

## 4. Findings per screen

Format per screen: what works (keep) · findings with the skill that found it · motion opportunity (only where it passes the
animate filter). "Owner rule" marks a breach of a standing owner rule.

### 4.1 Shell (rail, brand cluster, tab pair, phone dock) - every screen

- Keep: rail on the inline-start edge with icon + label; SmplWise wordmark + search / status pill at the top corner; the
  floors / areas tree survives on home, building, electricity, board; RTL correct everywhere.
- [impeccable heuristics 4, consistency] The page header is assembled per screen: home has a tab pill top-left, live overview
  an area pill + underline tabs, tickets a pill + underline + a page segmented, settings a top bar of ~18 sections + a second
  row + a side tree repeating both. One page-header + tab-pair component is the single biggest consistency win.
- [mobile-native; break-ui] Phone: horizontal tab rows clip mid-word at both ends without a fade or a "more" control (WisKey,
  settings, live sub-tabs, WisKey station filters).
- [ui-ux-pro-max] Phone dock: 7 destinations + avatar with 10-10.5 px labels; recommended maximum 5 + "more". Changing the dock
  touches owner-protected positions only if the order changes; the plan keeps the order and moves overflow into "more".
- [owner rule, recorded] Brand cluster on desktop matches CR-LOGOS295 P1 in all captures; phone inner screens have no logo row
  (P2) - see the contradiction in §0.
- Motion: the active-tab indicator should move (one indicator, transform), not re-render per tab [emil-design-eng; R2 spec].

### 4.2 Home / building

- Keep: widgets that read at a glance (clock, weather, Shabbat, alarm, screens); floor cards with live counts; tree.
- [taste-skill grid arithmetic] At 1440 the floor cards fill ~2/3 of the width beside the tree, under a 9-tile KPI strip of
  ~110 px tiles with coloured icons; [R2] already computed the fix (240 px floor cards, 4 per row, no orphan).
- [impeccable quieter] The "on" row wash (amber gradient across the row, e.g. "לובי") is the loudest thing on the page and
  competes with the alarm widget; the weather / Shabbat cards add two more gradients. One warm accent, not three.
- [taste-skill; owner "no greens as accents"] Green dots and green icons in the KPI strip for "on" categories (locks,
  shutters) - [R2] removed these as category colours; the product still has them.
- [impeccable layout; owner rule "no scroll"] Phone: every widget is a full-width card, the tree starts ~620 px down.
  Widgets should be a 2-column compact strip on phone (clock + weather, Shabbat + alarm) so the tree is in the first screen.
- [ui-ux-pro-max] 50 sub-44 px targets in the first desktop viewport (floor-row chips, "..." menus, tree twisties).
- [break-ui] 62-char area name: ellipsis works, but the Latin string keeps its tail ("...dentifier-2026-Building-North@...")
  and the full name is only in `title` on some rows (22 `title=` in `devices-building.ts`, none on the floor chips).
- Motion: tile state change (on / off) as a 160 ms colour + icon cross-fade, no lift on touch [emil; mobile-native].

### 4.3 Area

- Demo shows the building page; critique from code and [DS-audit]: the area page has its own empty state "works against the
  server" that reads as an error to an operator [impeccable clarify]; tiles vs list views exist (good, owner wants list views).
- [taste-skill] 4 glass layers (`devices-area-bubble/design/nav`) mean the area page looks different from home in every skin
  except bubble; [DS-audit P0-1].

### 4.4 Cameras - live overview and wall

- Keep: KPI row + site health + storage ring + attention list + recent events is the right information set; the wall uses
  the viewport and the video HUD tokens hold in every skin.
- [taste-skill; owner rule] Camera KPI shows a green-tinted icon box when all cameras are up - green becomes the page accent in
  the healthy state. KPI = dot + number + word.
- [impeccable layout; owner rule] Live overview scrolls 34-58 px at 1440 x 900 (the recent-events card is cut); the wall
  23-50 px in [DS-audit] (a demo footnote under the grid).
- [impeccable hierarchy] "בוקר טוב, יוני" greeting is the H1 of a security screen; the status line under it carries the real
  headline ("bridge not fresh"). Swap: status first, greeting as the subtitle or gone.
- [break-ui] Health rows wrap long names to two lines cleanly; good.
- Phone: two KPI rows + two camera stills + storage before health; [taste-skill] a single horizontal KPI strip (2.5 tiles
  visible) saves ~180 px.
- Motion: storage ring and KPI numbers change only on refresh (no count-up on load) [animate filter, R2 decision].

### 4.5 Events (security)

- Keep: date-grouped list, severity chips, thumbnails.
- [impeccable cognitive load] Phone: export + 3 full-width dropdowns + date + 2 chips before the first event (~360 px); each
  event is a vertical label / value stack (event, camera, floor, time, NVR, severity) of ~200 px. A two-line row (thumb,
  title, camera · time, severity pill) shows 4-5 events per screen instead of 2.
- [ui-ux-pro-max] 34 sub-44 targets on desktop.
- Motion: new event arrives as a 200 ms insert (height + opacity) at the top, never a jump [find-animation-opportunities].

### 4.6 Map (floors)

- Keep: the map is never mirrored; compact tool rail; the 3D / plan objects carry their own palette (allowed).
- [ui-ux-pro-max] 30 sub-44 targets (tool icons, floor chips); 16 unlabeled tool icons in the plan editor [DS-audit].
- [apple-design] Pinch / pan / floor switch are gesture surfaces: momentum and an interruptible floor transition belong here,
  nowhere else in the product.

### 4.7 Devices - schedules (reference look)

- Keep: dense scannable list, 24 h bar per row, pager instead of page scroll.
- [taste-skill §9.1] Glass family declares `-apple-system` first - the same Hebrew in a second family [DS-audit P1-1].
- [ui-ux-pro-max] 61 sub-44 targets: 7 day circles per row at ~16 px.
- [impeccable cognitive load] Filter row = two segmented groups + search + filter + view switch on one line.

### 4.8 Devices - media screens / players

- Keep: recognisable cards, now-playing art.
- [owner rule "no scroll"] 405 px inner scroll at 1440 x 900 (players ~1,000 px in [DS-audit]).
- [taste-skill] The `--mm-*` / `--mr-*` knob set and 69 literal colours in the remote make it a different product per skin.
- [ui-ux-pro-max] per-card control rows (input / volume / +/-) at 34 px.
- Motion: volume as a spring-less slider with immediate feedback; remote key press = scale .97 [emil].

### 4.9 Notices (board admin)

- Keep: clean table, severity chips [DS-audit].
- [impeccable harden] Module-off state: a 60 px icon + two lines + a small button, 120 px from the top of a 1440 x 900 empty
  page. State panels should be vertically centred in the content area with one clear action.
- [taste-skill §7.4] numbers (reads, validity) not end-aligned [R2 fixed it in the mockup].

### 4.10 Tickets (service management)

- Keep: the board's tree, cards with state + SLA + owner, the empty state with one primary action.
- [impeccable cognitive load] The five control rows (finding 1). Fix with the filter-bar rule: search, one scope segmented
  (max 4), "filter" opens a sheet with the status chip grid and department chips, view switch at the end.
- [ui-ux-pro-max] "Urgent" chip 3.3:1 (danger on danger-soft instead of the `-text` token) [DS-audit].
- Phone: KPI tiles 2 x 2 under the controls push the first ticket to ~520 px [DS-audit sheet].
- Motion: card moves between board columns with a FLIP transform; status change = pill colour cross-fade [emil; animate].

### 4.11 Elevators (reference look)

- Keep: KPI row with state dots, card with badge + door picture + 24 h bar, ellipsis on long names. This is the target look.
- [impeccable quieter] State expressed four ways per card (tinted border, badge, picture tint, bar colour) + a full gradient
  wash on the fire card + a 4 px side stripe (`infra-elevators.ts:88`, detector) - one state shape per card.
- [impeccable harden] In demo the page is a small "no permission" panel at the top of an empty page (state-panel finding).
- Phone: 6 KPI tiles take 3 rows - horizontal strip.
- Motion: door picture open / close is the one signature move worth keeping animated (already in [R2] motion spec).

### 4.12 Temperature (reference look)

- [ui-ux-pro-max; impeccable audit] White label on bare state colour in the status pill, 1.8-3.8:1 in every skin
  (`temperature/styles.ts:30`) - finding 6.
- [taste-skill] chart axis labels under 11 px.

### 4.13 Settings

- Keep: search, grouped side tree, segmented controls with clear labels, the skin chooser with previews.
- [impeccable heuristics 6 recognition / 8 minimalism] Three navigation layers for one page (top section bar ~18 items, sub-tab
  row, side tree). The side tree alone is enough on desktop; on phone a sectioned list.
- [taste-skill grid] the content column is ~440 px wide at 1440 with half the screen empty; cards should fill a 2-column
  settings grid (or a centred 720 px column with the tree) instead.
- [ui-ux-pro-max] 61-71 sub-44 targets; disabled "save" is a pale accent block that reads as enabled-but-faded.
- Settings may scroll (owner rule exempts them); inner scroll 3,500 px desktop / 5,800 px phone for "look" says the page is
  several pages - split by the tree.

### 4.14 WisKey - entry centre (new in this audit)

- Keep: the right content (online stations, ringing now, attention list, intercom cards with sync / talk state); the ringing
  station gets an amber ring - a real, deserved emphasis.
- [taste-skill grid arithmetic] Desktop: 2 KPI tiles in a third of the width, 4 intercom cards in a 3 + 1 ragged layout, the
  attention list in a narrow column; content ends at ~45 % of the height. A 4-column card grid with the attention list as a
  right-hand rail (inline-end) fills the page without scrolling.
- [taste-skill; owner "no greens"] KPI tiles with red / amber icon boxes; station cards with green-tinted door icons in the
  healthy state.
- [mobile-native; break-ui] Phone: the 10-tab WisKey bar clips at both ends ("מרכז הכניסה" cut on one side, "עמ" on the other).
- Motion: ringing station - one gentle 1.6 s opacity pulse on the ring only, with a reduced-motion static alternative
  [animation-performance; animate].

### 4.15 WisKey - people

- Keep: table with avatar initials, number, group, schedule, credentials, status pill; list / grid switch.
- [impeccable cognitive load] 8 filter dropdowns + a "columns" control above the table: >4 options at one decision point.
  Search + 2 most-used filters + "more filters" sheet.
- [break-ui] A 62-char Hebrew name widens the name column and squeezes the rest (no max width / clamp on the column); a Latin
  e-mail truncates from the start in RTL (`...ding-North@example.com`) - the distinguishing part is lost. Needs `dir="auto"`
  on user strings and a two-line clamp in tables.
- [ui-ux-pro-max] row actions are a lone envelope icon at the far end, 20 px.

### 4.16 WisKey - stations and doors

- [break-ui] Station cards spend ~60 % of their height on a "no image" placeholder when there is no snapshot (3 of 4 in
  demo): the empty case should collapse to a compact card with the state and actions, the image block only when there is an
  image.
- [mobile-native] filter chips scroll horizontally with the last chip cut, no edge fade.
- [apple-design] talk / listen / open are press-and-hold style actions on a phone: they need haptic-like feedback (scale + colour
  in 100 ms) and a clear "in call" state.

### 4.17 WisKey - activity

- Keep: date groups, direction / result pills, time column.
- [taste-skill §7.4] time is at the inline start as a tabular number - correct; the 5 filter dropdowns above should be one row
  of 2 + "more".

### 4.18 TV notice board

- Keep: calm inactive state, big clock, Hebrew + Gregorian date, SmplWise wordmark in the corner; burn-in shift exists.
- [taste-skill; DS-audit] own 64-size type ramp in `tv.css`; secondary text 3.8-4.4:1 at TV distance should be >= 4.5.
- [owner rule] The company logo slot (P7) is empty in the inactive state even though the rule says both logos on display
  surfaces; check with the owner whether the inactive board shows the company logo.
- Motion: slide change as a 600 ms cross-fade, no slide-in (TV distance, burn-in) [animate filter].

### 4.19 Sign-in

- Keep: centred card, one primary action, auth mode as a segmented control, both logos stacked per CR-LOGOS295 P3.
- [ui-ux-pro-max] domus / crystal dark primary = light blue with a white label (lower contrast); the security note under the
  form is a two-line paragraph at ~11 px.
- [apple-design] the card is the one place where the Soft skin's material is safe to show off (single surface, no data).
- Motion: error = 200 ms shake-free border + message reveal, never a shake on a password field [emil].

### 4.20 Phone views (cross-cutting)

- [mobile-native] 358 of 367 `:hover` rules are not gated by `(hover: hover)` - washes and lifts fire on tap [DS-audit §2.5]. `dvh` units
  appear in 29 files and `pointer: coarse` queries in 40: the phone baseline exists but per file, not as one shared layer
  (16 px inputs on coarse pointers were not verified screen by screen).
- [emil-design-eng] 51 of 56 `:active` rules give no press feedback; the shared button should own scale .97.
- [ui-ux-pro-max] the phone dock labels 10-10.5 px (finding 2 / 7).

## 5. Rollout plan

Principles: (1) **W0 first**: shared shell and components, so every later wave restyles by composition, not by hand; (2) order
by daily use and owner visibility; (3) **max 8 screens per wave**, one branch per wave (`pilot/DESIGN-W<n>-...`), one
release per wave; (4) the owner sees a before / after sheet (6 skins x light / dark x desktop / phone) per wave before merge;
(5) no screen ships with the old look after its wave starts (the release gate of §6.3).

Default skin stays **classic** until the owner chooses [DESIGN.md §9]; every wave renders in classic, domus, tesla, crystal,
**arx-infra**, **arx-soft** (bubble frozen, not touched). Pixel baselines: **classic + domus only** (owner rule), so W0 adds
`domus` to `tests/visual/matrix.json` and each wave adds its screens to the matrix.

| Wave | Screens (<= 8) | Scope | Main risks | Estimate |
|---|---|---|---|---|
| **W0 Foundations** | (shell + components) rail, brand cluster, phone dock, page header + tab pair, KPI tile, status pill pairs, segmented control, filter bar + filter sheet, card, list row / table, state panel (centred, skeleton), tree panel, dialog / sheet / drawer motion, interaction layer (hover gate, press, focus) | the [COMPONENT_RULES] kit built as real components with tokens of [TOKENS.md]; the motion layer of [R2] (`arx-motion.ts` exists); guards: unit token lint extensions, a no-scroll probe at 1440 x 900 / 1920 x 1080, logo / title / DD position specs kept green, domus added to the pixel matrix | every pixel baseline changes once (11 classic screens x 2 schemes, + domus); the logo and DD position specs (`layout-header-logo-295`, `layout-logo-side-295`, `layout-dd-*`) must stay green unchanged; shell is touched by every open branch (merge order) | 4-5 days |
| **W1 Daily core** | home / building, area, live overview, wall, map floors, alarm, events, notification centre | apply W0; home phone 2-column widget strip; live overview status-first header; events two-line rows | home has 4 skin rule sets and glass; 4 of 8 are pixel screens; tree must stay; no-scroll at 1440 | 4 days |
| **W2 Devices and control** | device tiles / controls drawer, schedules, automations (builder + code), scenes, scenarios + scripts, notices admin, announce, presence | fold the glass `--dv-*` family into component tokens for these screens; one segmented control | glass family removal changes every skin's look of these screens; schedules is a pixel screen | 3-4 days |
| **W3 Media and cameras** | media screens, players, groups, remote, single camera, saved views, playback, kiosk wall | no-scroll grids + pager for media; remote knob set folded; video / timeline never mirrored | media scroll fix is structural; kiosk wall on a weak tablet (blur budget); playback timeline LTR | 3-4 days |
| **W4 Infrastructure** | elevators, temperature, generator, electricity (meters, accounts, bills), water, door windows, insights, infra report | they are the reference look: polish, state pairs (temperature contrast), one state shape, KPI strip on phone | low; print bill stays as is (W8); electricity table no-scroll | 2-3 days |
| **W5 WisKey** | entry centre, activity, people, person drawer / editor, stations and doors, schedules, sync / health / audit, tools / embed / external | grid fill on desktop, filter bar + sheet, `dir="auto"` on user strings, compact no-image station card, talk / listen / open feedback | WisKey integration is live with door actions: **design only, no behaviour change**, fakes for tests; tab overflow menu | 3-4 days |
| **W6 Service management** | my / department / all requests (list, table, calendar), board, manager overview, handlers, RFQs, maintenance, reports, accounts / external | the five control rows into one filter bar + sheet; KPI strip; urgent chip contrast; FLIP card moves | 162 files in `tickets/`; glass family; the module-off rule (no ticket action when the module is off) must survive | 4 days |
| **W7 Investigate** | cases, exports, reviews, rules, search, history on map, incidents, health | frigate panels' literal colours to tokens; tables to `sw-table` | analytics cards are hex-heavy; history map not mirrored | 3 days |
| **W8 Entry and standalone** | sign-in, welcome / pre-gate, TV notice board, public ticket portal, offline + install prompt, native device view + Android download, bill / PDF print, kiosk header | login contrast; TV type ramp to the display tier; logos per CR-LOGOS295 P3-P10 | public portal has its own CSS and language packs; TV burn-in; print engines | 3-4 days |
| **W9 Settings A (most used)** | settings home + navigation, look and brand (logos), users (local / infrastructure), access control, security cameras / NVR, notifications policy, notices settings, tickets settings | one navigation layer (side tree) + 2-column card grid; disabled-state fix; notifications dark contrast | settings navigation is muscle memory: the tree order and labels stay; brand settings drive the logos of every screen | 3 days |
| **W10 Settings B (modules)** | multimedia + cast, wall, schedules + automations settings, devices / types / protected switches, doors / door blocks / emergency open, infra settings, transit, presence + places + mobile | apply the settings kit | many small pages; low visual risk | 2-3 days |
| **W11 Settings C (administration)** | update, storage + backup, diagnostics, readiness, fleet report, audit, setup + wizard, service identity + messaging accounts | apply the settings kit; diagnostics is a pixel screen | update / backup are high-stakes flows: confirmations and progress states | 2-3 days |
| **W12 Editors and power tools** | plan editor + studio, plan import, sites / entities explorer, automation code view, schedule editor, scene editor, palette editor, styleguide | tool rails with labels / tooltips, 44 px hit areas on tool icons, gesture polish on the canvas | 6,600 lines in the plan editor; canvas performance | 3-4 days |

Total: **W0 4-5 days + 12 waves of 2-4 days = ~37-45 agent-days**; with two waves in flight after W0 (disjoint areas:
e.g. W4 + W5, W9 + W12) **~4-5 calendar weeks**, plus one runner gate per release. These are rough lead estimates, not
measured; W1 and W6 carry the most uncertainty.

Mobile is not a separate wave: every wave owns its phone views and passes the mobile-native items of §6.1. The phone dock and
the phone home header are in W0 / W1.

## 6. Acceptance checklist

### 6.1 Every wave (each item names the skill that must have been applied, with its output kept in the wave's evidence folder)

| # | Check | Skill (must be run) | Pass condition |
|---|---|---|---|
| 1 | Design critique of every screen in the wave | **impeccable** `critique` (dual sub-agent, not degraded) + `audit` | no P0 / P1 left open; audit health >= 16 / 20; `impeccable detect` 0 warnings on the wave's files |
| 2 | Look-and-fix loop on screenshots | **taste-skill** (app-screens run) | grid arithmetic written down per screen (no orphan card, no empty band); KPI = dot + number + word; labels >= 11 px; numbers tabular and end-aligned |
| 3 | Accessibility and UX rules | **ui-ux-pro-max** (UX guidelines + a11y checklist) | text contrast >= 4.5:1 (>= 3:1 large / icons) on opaque surfaces in all 6 skins x 2 schemes; hit area >= 44 x 44; focus ring 2 px visible on every surface; `aria-busy` on skeletons |
| 4 | Worst-case data | **break-ui** (Demo data / Worst case toggle on each screen) | long Hebrew, unbroken Latin, emoji, 0 / 1 / 500 items, missing image / field, huge numbers: nothing escapes, nothing clips without `title`, user strings `dir="auto"` |
| 5 | Polish pass | **emil-design-eng** | press feedback on every control, enter / exit asymmetry, origin-aware popovers, no `scale(0)`, no `transition: all` |
| 6 | Phone | **mobile-native** | hover gated, no tap flash, `100dvh`, inputs 16 px on coarse pointers, safe-area on dock / sheets / toasts, tab rows with overflow affordance; checked on a real phone once per wave |
| 7 | Motion | **find-animation-opportunities** + **animate** (+ **motion** for `linear()` springs) + **animation-performance** | only transform / opacity (+ blur <= 2 px on numbers); durations from tokens; `prefers-reduced-motion` and the in-app reduced setting give a static alternative |
| 8 | Materials, sheets, gestures (where the wave has them) | **apple-design** | never glass on glass; panels spring without bounce; opaque fallback for reduced transparency; the Soft skin checked on a wall tablet |
| 9 | Owner rules | lead review | brand cluster (SmplWise + company + installer) and titles and DD in the same positions (the logo / DD position specs pass unchanged); floors / areas tree present; **no page scroll on control screens at 1440 x 900 and 1920 x 1080**; no green except real status; no infrastructure-platform name outside settings; no hints / paragraphs on operator screens |
| 10 | Skins and pixels | lead review + runner | rendered in classic, domus, tesla, crystal, arx-infra, arx-soft, light + dark, desktop + phone (the owner's before / after sheet); pixel baselines re-taken **for classic + domus only**, on the runner, in the wave's own commit |
| 11 | RTL and language | lead review | RTL first; video, map, 3D, timeline and number runs never mirrored; Hebrew and English strings (where `i18n/en.ts` covers the module) both fit |

### 6.2 Wave-specific additions

- **W0**: the component kit has a styleguide page (`styleguide-screen.ts`) showing every component in all 6 skins x 2 schemes
  and every state; the token lint fails on new literals, `var()` fallbacks and unknown `--sw-*` names.
- **W1**: home phone shows the tree in the first screen; live overview, wall and map pass the no-scroll probe.
- **W2 / W6**: the glass `--dv-*` family is gone from the wave's files (the skin reaches every pixel).
- **W3**: media screens and players fit 1440 x 900 with a pager; timeline and video not mirrored.
- **W5**: zero behaviour change in WisKey actions (talk / listen / open), proven by the existing WisKey specs on fakes.
- **W6**: one filter bar row on desktop and phone; the module-off rule still hides every service-request action.
- **W8**: TV contrast >= 4.5:1 at the display tier; sign-in both logos per CR-LOGOS295 P3; print unchanged unless the owner asks.
- **W9-W11**: one settings navigation layer; settings may scroll (owner exemption) but only inside the content region.

### 6.3 Release gate (the owner's "no screen without design" rule, made checkable)

A screen-level file listed in Appendix A that changes in a release must belong to a wave whose evidence folder holds items 1-11
of §6.1 for it. Proposed mechanism (for the lead to decide): a `design_pass` list in `management/` (screen id, wave, date,
evidence path) and a small check in the gate that fails when a changed screen file is not on the list. Bug fixes on a screen
before its wave are allowed only if they do not change its look (the pixel baselines of classic + domus stay unchanged).

## 7. Open questions for the owner (also in AUDIT_HE.md, in plain language)

1. Logos on phone inner screens: keep the 24.10 decision (no logo row on inner phone screens) or add a logo row everywhere?
2. Which skin is the default after W0: classic stays (today), or arx-infra?
3. Phone bottom bar: 5 destinations + "more" (recommended), or all 7 as today with larger labels?
4. TV board inactive state: show the company logo too?
5. Settings: drop the top section bar and keep only the side tree (recommended)?

## Appendix A - inventory of `frontend/src/screens` and `frontend/src/components` (generated)

Generated by a scratch scan of the files at b6996284f (not committed). "Purpose" is the file's first doc comment, shortened;
for helper files it may describe a detail rather than the page. "Glass" = the file reads the `--dv-*` family. "Skin rules" =
a skin file in `design/skins/` names one of the file's custom elements. "Literal hex" = `#rgb` / `#rrggbb` occurrences.

| File | Custom element(s) | Lines | Glass `--dv-*` | Skin rules target it | Literal hex | Purpose (from the file header) |
|---|---|---|---|---|---|---|
| `screens/access-external.ts` | `access-external-screen` | 1147 |  |  |  | The drift view's tone and icon per kind of difference (the server sends them most urgent first) |
| `screens/area-row-editor.ts` | `area-row-editor` | 244 |  |  |  | "מה מוצג ליד שם האזור" the editor of the two lists of the home screen - what sits after an area's name (each i... |
| `screens/automation-block-forms.ts` | (view helper) | 590 | yes |  |  | One form per typed block, in a registry keyed by `section:type` (`trigger:state`, `condition:time`, `action:se... |
| `screens/automation-builder-icons.ts` | (view helper) | 50 |  |  |  | The icon set of the editors (the approved mockup's, docs/design/mockups/automations/index.html): stroke icons ... |
| `screens/automation-builder.ts` | `automation-builder` | 53 |  |  |  | The automation builder (CR §4.2.1; mockups 14-33): the three stacked sections כאשר · אם · אז with a block card... |
| `screens/automation-code.ts` | `automation-code` | 194 | yes |  |  | The code view - the second side of the editor's "בונה · קוד" toggle (CR §4.5). In v1 the text is the item's JS... |
| `screens/automation-drawer.ts` | `automation-drawer` | 787 | yes |  |  | `<automation-drawer .kind .itemId .view .runId .trash .status .now>`: the detail of one automation or script (... |
| `screens/automation-editor-base.ts` | (view helper) | 1649 | yes |  | 7 | The editors' extension (wall buttons, pre-save checks, the on-device test, the manual merge) |
| `screens/automation-editor-css.ts` | (logic / data) | 334 | yes |  | 13 | The look shared by the editors and their parts (blocks, picker, gallery, code view): the approved mockup's gla... |
| `screens/automation-editor-logic.ts` | (logic / data) | 679 |  |  |  | The pure logic of the editors (`<automation-builder>`, `<script-editor>`, `<scene-editor>`): no DOM, no Lit, s... |
| `screens/automation-editors.ts` | (logic / data) | 7 |  |  |  | Registers the three editors S3's lists mount by tag - `<automation-builder>`, `<script-editor>`, `<scene-edito... |
| `screens/automation-entity-picker.ts` | `automation-entity-picker` | 228 | yes |  |  | "בחירת מכשירים" - the picker of the builder (floor -> area -> device, search), scoped to what the caller may u... |
| `screens/automation-ext-dialogs.ts` | `kav-device-test`, `kav-merge` | 237 | yes |  |  | (mockup r079 states 3 and 5): the two dialog bodies the automation builder opens inside its existing `<sw-dial... |
| `screens/automation-ext-forms.ts` | `kav-button-form` | 228 | yes |  |  | (mockup r079 states 2 and 6): the new forms of the automation builder, registered the way automation-block-for... |
| `screens/automation-templates.ts` | `automation-templates` | 149 | yes |  |  | The templates gallery of a new automation (CR §4.2.4; mockup 30-31): "מאפס" first, then the server's templates... |
| `screens/automations-logic.ts` | (logic / data) | 429 |  |  |  | The pure logic of the automations screens (no DOM, no network): the route of `#/devices/automations/...`, the ... |
| `screens/bubble-demo.ts` | `bubble-demo` | 453 |  |  | 1 | Fixture only: invented names, no lab data. |
| `screens/bubble-sliders.ts` | `bubble-sliders` | 136 |  |  |  | One slider of a device sheet (brightness, fan speed, a cover's position or tilt). |
| `screens/cast-logic.ts` | (logic / data) | 216 |  |  |  | (UI): the pure part of the cast screens - words, grouping, countdown and the rules of which buttons exist. No ... |
| `screens/device-types-logic.ts` | (logic / data) | 110 |  |  |  | DEVTYPE the pure logic of הגדרות › חשמל והתקנים › סוגי התקנים - the Hebrew names of the types, the filters, wh... |
| `screens/devices-announce.ts` | `devices-announce` | 193 |  |  |  | (stage A, speakers only): ראשי › הכרזות (#/devices/announce) for people holding `media.announce` (the built-in... |
| `screens/devices-area-bubble.ts` | (view helper) | 747 |  |  |  | The area screen in the Bubble skin (phase C, owner 2026-10-02; the approved board docs/design/mockups/bubble-t... |
| `screens/devices-area-design.ts` | (logic / data) | 129 |  |  |  | The area screen's redesign the two directions of the same screen, the per-section "כבה הכל" regi |
| `screens/devices-area-nav.ts` | `devices-area-nav` | 472 |  | bubble |  | One switcher entry: a floor or an area of the current floor, with its device count. |
| `screens/devices-area.ts` | `devices-area` | 1770 | yes | bubble |  | Slice 4: a cover of these device classes is a passage, not a shutter - read-only wherever the covers card rend... |
| `screens/devices-automations.ts` | `devices-automations` | 879 | yes |  | 2 | 0.1.154: the schedules screen, the first segment of "קברניט" (its address is unchanged). |
| `screens/devices-building.ts` | `devices-building` | 3553 | yes | bubble, crystal, domus, tesla |  | Owner notes 2026-09-30: the home route's edit mode is entered by the address (`#/devices/building?edit=1`, fro... |
| `screens/devices-bulk.ts` | `devices-bulk-menu`, `devices-bulk-dialog` | 779 |  | bubble |  | What a screen asks the dialog to do: the scope, its id and display name, and the kind. `position` (slice 4): c... |
| `screens/devices-camera-card.ts` | `devices-camera-card` | 682 |  |  | 3 | A standalone camera shown live whose stream failed shows its picture for this long, then tries the stream agai... |
| `screens/devices-camera-picker.ts` | `devices-camera-picker` | 269 |  |  |  | `camera-picked`: the user chose a camera. `detail.name` is the camera's own name (a title for the card, if it ... |
| `screens/devices-climate-kind-admin.ts` | `devices-climate-kind-admin` | 132 |  |  |  | הגדרות › חשמל והתקנים › מיזוג וחימום every climate entity with the group it is in - "מיזוג" or "חימום". Automa... |
| `screens/devices-controls.ts` | (view helper) | 736 |  |  |  | Single-entity controls, shared by the area screen (devices-area.ts) and the overview tiles' panel (devices-til... |
| `screens/devices-layout-cards.ts` | (logic / data) | 161 |  |  |  | The area screen's card library what the layout editor offers when a card is added, how a custom card picks its... |
| `screens/devices-layout-css.ts` | (logic / data) | 790 | yes |  | 2 | Slice 6b: how an edited layout is applied on the device screens, and the edit mode's own chrome (docs/design/D... |
| `screens/devices-layout.ts` | (view helper) | 1935 |  |  |  | Slice 6b: the layout editor of the device screens . One layout per installation and screen, stored on the se |
| `screens/devices-media-card.ts` | `media-area-card` | 330 | yes |  |  | The area screen's media card ONE compact `<media-screen-card>` per PHYSICAL screen of the area (the S2 card: t... |
| `screens/devices-notices.ts` | `devices-notices` | 287 |  |  |  | Section 9: ראשי › לוח הודעות (#/devices/notices). Readers see the active notices of their audience (a read she... |
| `screens/devices-protected-switches-admin.ts` | `devices-protected-switches` | 343 |  |  |  | הגדרות › חשמל והתקנים › מתגים מוגנים (; replaces "פעולה קבוצתית"): the ONE place where switch protection is re... |
| `screens/devices-schedules.ts` | `devices-schedules` | 1948 | yes |  | 2 | The minutes since local midnight of an instant, as a share of the day (the "today" timeline). |
| `screens/devices-style.ts` | (logic / data) | 174 | yes |  |  | Slice 6a: the presentation settings of the device-control screens (הגדרות › חשמל והתקנים, `devices.*`, per ins... |
| `screens/devices-theme-picker.ts` | `devices-theme-picker` | 171 |  |  |  | Slice 6b: הגדרות › חשמל והתקנים - the colour theme (palette) swatches and the colour scheme of the device area... |
| `screens/devices-tiles-panel.ts` | `devices-tiles-panel` | 864 | yes |  |  | Which rows a segment shows: `active` = the tile's counted state (lit, on, open, running, playing, locked, arme... |
| `screens/devices-type-admin.ts` | `devices-type-admin` | 329 |  |  |  | הגדרות › חשמל והתקנים › סוגי התקנים (DEVTYPE, owner 2026-10-09): the type of every switch-wired device - a boi... |
| `screens/door-automation-block.ts` | `door-automation-block` | 534 | yes |  | 2 | The "open a door" block of the automation editor, under the "Then" section. Shown only to a holder of `access.... |
| `screens/door-automation-logic.ts` | (logic / data) | 86 |  |  |  | The pure part of the "open a door" block in the automation editor (no DOM): the state chip, the form checks, t... |
| `screens/door-path-logic.ts` | (logic / data) | 58 |  |  |  | Pure helpers of D6 / D8 (no DOM, unit-tested in Node: tests/unit-door-path.spec.ts). Hebrew copy lives here so... |
| `screens/door-windows.ts` | `door-windows-screen` | 581 |  |  |  | The settings of the emergency-open role (who may give it, the expiry, whether holders may retry). |
| `screens/explore-entities.ts` | `explore-entities` | 328 |  |  |  | — HA entity catalogue and drawer. Against the backend it is the synced catalogue (read-only mirror of Home Ass... |
| `screens/explore-floor-map.ts` | `explore-floor-map` | 3100 |  |  | 9 | Slice 3: the device card's "{tickets}" entry and the open-count chip (section 12.1; nothing while the module i... |
| `screens/explore-floors.ts` | `explore-floors` | 420 |  |  |  | — floor browser (board 1 screen 3) on real catalogue data: add / rename / delete floors, add buildings. |
| `screens/explore-plan-editor.ts` | `explore-plan-editor` | 5722 |  |  | 10 | A zone save or delete that has not answered by then counts as failed (review of T085, R4): the bulk actions it... |
| `screens/explore-plan-import.ts` | `explore-plan-import` | 903 |  |  | 2 | T086: a refused DXF mapping call, in the screen's words (code from ApiError; the server's own Hebrew otherwise... |
| `screens/explore-presence-logic.ts` | (logic / data) | 29 |  |  |  | The pure parts of "מי במבנה" (screens/explore-presence.ts), kept free of Lit so the unit specs import them in ... |
| `screens/explore-presence.ts` | `explore-presence` | 328 |  |  |  | The KPI filters of the list: everyone, the people placed on a floor, the people placed on a site only. |
| `screens/explore-sites.ts` | `explore-sites` | 401 |  |  | 1 | — sites & buildings (board 1 screen 2) on real catalogue data; create sites and buildings. |
| `screens/floor-stills.ts` | (view helper) | 132 |  |  |  | The floor map's side of Plan Studio 6 stills (; docs/changes/.md): which level / style / band a still view sho... |
| `screens/ha-events-logic.ts` | (logic / data) | 64 |  |  |  | The pure half of the sensor events list (investigate-ha-events.ts) - wording of a transition, the area options... |
| `screens/ha-users-logic.ts` | (logic / data) | 92 |  |  |  | The pure rules of Settings › משתמשי מערכת הבית (src/screens/system-ha-users.ts) - form checks, row actions, wo... |
| `screens/home-ambient-bar.ts` | `home-ambient-bar` | 189 |  |  |  | The widgets the thin bar carries in place of their large cards (). |
| `screens/home-demo.ts` | (logic / data) | 46 |  |  |  | The static demo's home block (no backend): the control-centre default with a weather entity, the Jewish calend... |
| `screens/home-edit-bv1.ts` | (view helper) | 94 |  |  |  | (2026-10-05): the edit-panel bodies of the new widgets - the tile style of the clock / weather, the agenda's c... |
| `screens/home-edit-panel.ts` | `home-edit-panel` | 650 |  |  |  | One place of the panel to open: a widget's row (from a card's "הגדרות" button). |
| `screens/home-screen-css.ts` | (logic / data) | 615 |  |  |  | (the approved home mockup round 2, private/review/HOME_MOCKUP_R2_2026-10-25.html): the new pieces of the home ... |
| `screens/home-screen-options.ts` | `home-screen-options` | 272 |  |  |  | One area for the quick-actions editor: its id, name, floor and counts (what kinds it has). |
| `screens/home-widgets-bv1.ts` | (view helper) | 563 |  |  |  | (2026-10-05): the new Bubble variants of the home widgets, kept apart from home-widgets.ts (which wires them i... |
| `screens/home-widgets.ts` | `home-widgets` | 1801 |  | bubble, crystal, domus, tesla |  | The Bubble skin (phase C, 2026-10-02; the approved board docs/design/mockups/bubble-taste/home.html): the stat... |
| `screens/infra-electricity.ts` | `infra-electricity` | 152 |  |  |  | Every screen file of the module registers itself: `screens/electricity/page-*.ts` (pages) and `settings-*.ts` ... |
| `screens/infra-elevators.ts` | `infra-elevators` | 240 |  |  |  | תשתיות › מעליות (designed in 2.8.0 from the owner-approved mockup): the KPI row (all / waiting or in operation... |
| `screens/infra-generator.ts` | `infra-generator` | 199 |  |  |  | 'log' (the run log) is offered only while its switch is on (log_enabled of the devices list; default off) |
| `screens/infra-report.ts` | `infra-report` | 220 |  |  |  | תשתיות › דוח מבנה (): the monthly building report - the month, the language, the sections, the in-page preview... |
| `screens/infra-temperature.ts` | `infra-temperature` | 446 |  |  |  | Phase 3 (idea 7): the collapsed area groups, per browser (a convenience only - never shared, never required) |
| `screens/infra-water.ts` | `infra-water` | 153 |  |  |  | Every page file of the module registers itself (`screens/water/page-*.ts`), as the electricity shell does. |
| `screens/insights-doors.ts` | `insights-doors` | 112 |  |  |  | סקירה ודוחות › דלתות (): door openings without a matching entry event, per door, with the verdict (explained, ... |
| `screens/insights-settings.ts` | `insights-settings` | 307 |  |  |  | הגדרות › תשתיות › תובנות ודוחות (): the three switches (each off until the owner turns it on), the door pairs ... |
| `screens/insights-waste.ts` | `insights-waste` | 84 |  |  |  | סקירה ודוחות › צריכת אנרגיה (; the key and route stay `waste`): lights and air conditioning left on in an empt... |
| `screens/investigate-cases.ts` | `investigate-cases`, `investigate-case-detail` | 931 |  |  | 3 | One line on a manifest signature: integrity since export, and whose key it is. |
| `screens/investigate-event-detail.ts` | `investigate-event-detail` | 874 |  |  |  | M27 — one event with its video and its place: the recording plays from just before the event, the context pane... |
| `screens/investigate-events.ts` | `investigate-events` | 1088 |  |  |  | — event centre (board 1 screen 8): filters, thumbnail / event / camera / time / severity, drawer with source, ... |
| `screens/investigate-exports.ts` | `investigate-exports` | 205 |  |  |  | — exports and downloads: durable jobs, progress/cancel/partial/fail, scoped download (chapter 27). |
| `screens/investigate-ha-events.ts` | `investigate-ha-events` | 265 |  |  |  | — the sensor events list: the investigate area of an installation with no recorder events (no NVR). The same s... |
| `screens/investigate-history-map.ts` | `investigate-history-map` | 2065 |  |  | 2 | The window choices of the time scrub's bar (minutes); the track below zooms through the same values. |
| `screens/investigate-incidents.ts` | `investigate-incidents` | 837 |  |  | 1 | אבטחה › חקירה › "אירוע חי". `#/investigate/incidents` - the list (the open incidents first |
| `screens/investigate-playback.ts` | `investigate-playback` | 1524 |  |  | 5 | 2.0.0: player close codes / relay errors that are NOT a lost connection - a denial, a superseded generation (a... |
| `screens/investigate-reviews.ts` | `investigate-reviews` | 991 |  |  |  | The motion layer reads at most the last 24 h whatever the period says: the screen says so. |
| `screens/investigate-rules.ts` | `investigate-rules`, `investigate-rule-editor` | 517 |  |  | 14 | — alerts & automation rules (board 3 screen 19): tabs, rule cards with icon square, toggle, Edit, ⋯. |
| `screens/investigate-search.ts` | `investigate-search` | 289 |  |  |  | — AI search (board 2 screen 9, Beta): search-by pills, "search by person" card, similar matches grid. Metadata... |
| `screens/investigate-sync.ts` | `investigate-sync` | 443 |  |  |  | — command center / synchronized playback (board 2 screen 14, Beta): 2×2 pictures, one transport row, one timel... |
| `screens/kiosk-wall.ts` | `kiosk-wall` | 612 |  |  |  | Saved view = the URL: #/kiosk/all?cameras=a,b,c&cols=3&rows=2&rotate=30 (seconds per page; 0 = no rotation). D... |
| `screens/live-camera.ts` | `live-camera` | 1258 |  |  | 13 | "open a service request" for this camera (the camera's place on the map is attached to the new request) |
| `screens/live-overview.ts` | `live-overview` | 604 |  |  |  | GET /api/v1/health — connection facts used for the attention list. |
| `screens/live-views.ts` | `live-views` | 331 |  |  |  | — saved views manager (legacy layout manager; templates 1/2/4/6/9/12/16/custom). |
| `screens/live-wall.ts` | `live-wall` | 886 |  |  |  | The wall's quality choice of THIS device (`sub` = רגילה, `main` = גבוהה); unset = follow the installation sett... |
| `screens/media-admin-list-logic.ts` | (logic / data) | 307 |  |  |  | The PURE part of the settings lists of screens and of speakers / players (הגדרות › מולטימדיה; no DOM, no netwo... |
| `screens/media-admin-list.ts` | `media-admin-toolbar` | 770 |  |  |  | The working surface of the settings lists of screens and of speakers / players (הגדרות › מולטימדיה; 0.1.162): ... |
| `screens/media-cast-label.ts` | (logic / data) | 57 |  |  |  | (prep): the words of the "שידור" marking in הגדרות › מולטימדיה - what a device's `cast` capability (api/media-... |
| `screens/media-integration-names.ts` | (logic / data) | 76 |  |  |  | Friendly names of the integrations a media device comes from (0.1.164, board ). The settings lists of the mult... |
| `screens/messaging-pacing-card.ts` | `messaging-pacing-card` | 193 |  |  |  | The shared send budget (Settings > messaging channel). One card: the mode (conservative by default), whether W... |
| `screens/messaging-policy-card.ts` | `messaging-policy-card` | 193 |  |  |  | The WhatsApp send policy (Settings > messaging channel). Two blocks in one card: the allow-list of handlers an... |
| `screens/multimedia-edit-panel.ts` | `multimedia-edit-panel` | 330 | yes |  |  | Addition A: the edit panel of the screens page, the counterpart of the home screen's `home-edit-panel` . It ed... |
| `screens/multimedia-groups.ts` | `multimedia-groups` | 1021 | yes |  | 2 | What a saved group's card shows while and after "הפעל": a spinner, then the outcome by room. |
| `screens/multimedia-layout.ts` | (logic / data) | 241 |  |  |  | Addition A, the PURE part of the screens page (no DOM, no network; unit-tested by tests/unit-media-layout.spec... |
| `screens/multimedia-players-layout.ts` | (logic / data) | 341 |  |  |  | (S2): the PURE part of the players and groups pages (no DOM, no network; unit-tested by tests/unit-media-playe... |
| `screens/multimedia-players.ts` | `multimedia-players` | 628 | yes |  |  | "מולטימדיה › נגנים ורמקולים" (mockup `players-index.html`, always the glass style): one card per physical spea... |
| `screens/multimedia-remote-editor.ts` | `media-remote-editor` | 507 |  |  |  | "עריכת השלט" (): the remote's editor, drawn inside the open remote (media-remote.ts) instead of the pad. Reach... |
| `screens/multimedia-screens.ts` | `multimedia-screens` | 1033 | yes |  | 4 | "מולטימדיה › מסכים" (mockup v2, always the glass style): one card per physical screen grouped by floor (or roo... |
| `screens/nvr-batch-logic.ts` | (logic / data) | 363 |  |  |  | Phase C: the pure logic of the multi-camera SVC change on הגדרות › אבטחה › מצלמות - which cameras can be chose... |
| `screens/nvr-camera-batch.ts` | `nvr-camera-batch` | 765 |  |  | 1 | What the screen needs to know about each camera to name a row (the batch's items carry only the camera id). |
| `screens/nvr-camera-editor.ts` | `nvr-camera-editor` | 478 |  |  |  | The editor's line when "שמור" cannot open the confirmation: the press always answers . |
| `screens/nvr-cameras-actions.ts` | (logic / data) | 48 |  |  |  | Phase B: the two device-touching actions of the screen - a guarded stream write and its undo - with the error ... |
| `screens/nvr-cameras-edit.ts` | (logic / data) | 374 |  |  |  | Phase B: the pure logic of the stream editing on הגדרות › אבטחה › מצלמות - which controls a stream gets (and w... |
| `screens/nvr-cameras-logic.ts` | (logic / data) | 226 |  |  |  | The logic of the cameras' video-settings table (הגדרות › אבטחה › מצלמות) - flattening the server's cameras int... |
| `screens/nvr-confirm.ts` | `nvr-confirm` | 117 |  |  |  | The ONE confirmation of every stream change the heading, one line naming the camera and the stream, the number... |
| `screens/nvr-encoding-batch.ts` | `nvr-encoding-batch` | 544 |  |  |  | Phase D: "שינוי קידוד לכמה מצלמות" - one encoding change on many (or all) streams of the NVR, e.g. every camer... |
| `screens/nvr-encoding-logic.ts` | (logic / data) | 335 |  |  |  | Phase D: the pure logic of the bulk encoding change on מערכת › אבטחה › מצלמות ("שינוי קידוד לכמה מצלמות") - wh... |
| `screens/nvr-undo-toast.ts` | `nvr-undo-toast` | 107 |  |  |  | The short toast after a stream change. "נשמר" with "בטל" for 10 seconds (the press on "בטל" IS the confirmatio... |
| `screens/placeholder-screen.ts` | `placeholder-screen` | 42 |  |  |  | Honest placeholder for modes whose screens are built in later tasks. Never fakes data. |
| `screens/plan-area-links-admin.ts` | `plan-area-links-admin` | 228 |  |  |  | K88 הגדרות › מפה › "קישור חדרים לאזורים" - one row per plan room with its linked area, or the best name match ... |
| `screens/plan-package-dialog.ts` | (view helper) | 157 |  |  |  | Plan Studio 5 (T088, ): the import dialog of a signed plan package. The editor uploads the file for a dry run ... |
| `screens/plan-studio-panel.ts` | (view helper) | 2096 |  |  |  | Plan Studio side panel of the plan editor (T084): the structure tool - draw mode, wall defaults, the selected ... |
| `screens/plan-studio6-panel.ts` | (view helper) | 598 |  |  |  | Plan Studio 6 editor UI (UI, design ADR docs/design/_UI.md): the pure render functions the plan editor mounts ... |
| `screens/plan-view-dials.ts` | (logic / data) | 35 |  |  |  | UI: the dial lists and the Hebrew hints of the realistic-3D settings card (system-plan-view.ts), kept apart fr... |
| `screens/presence-opt-out.ts` | `presence-opt-out` | 88 |  |  |  | The person's own choice not to appear on "מי במבנה" (PUT presence/people/me). Shown on the personal settings p... |
| `screens/privacy-mask-logic.ts` | (logic / data) | 171 |  |  |  | The pure logic of the privacy-mask editor (no DOM): rectangles <-> the device's four-point regions, the clampi... |
| `screens/protected-switches-logic.ts` | (logic / data) | 163 |  |  |  | The pure logic of הגדרות › חשמל והתקנים › "מתגים מוגנים" - row status, filters, sorting, the Shift range, the ... |
| `screens/reviews-logic.ts` | (logic / data) | 115 |  |  |  | F1B: the pure logic of the review screen (selection, keys, optimistic reviewed state, grouping of the list sta... |
| `screens/scenario-recipients.ts` | `scenario-recipients` | 65 | yes |  |  | `<scenario-recipients .choices .value>`: who a scenario notification goes to - roles and named users picked by... |
| `screens/scenario-settings.ts` | `scenario-settings` | 135 |  |  |  | `<scenario-settings>`: Settings › Automations › "תרחישים חוצי מודולים" (scenario.admin). Every threshold, wind... |
| `screens/scenarios-panel.ts` | `scenarios-panel` | 538 | yes |  |  | `<scenarios-panel .status .scenarioId>`: the "תרחישים" block family inside the automations area . The list is ... |
| `screens/scene-editor.ts` | `scene-editor` | 182 | yes |  |  | The scene editor (CR §4.3): the members of a scene and the values of each, as a table; "צלם מצב נוכחי" reads t... |
| `screens/scenes-panel.ts` | `scenes-panel` | 430 | yes |  | 2 | `<scenes-panel .items .status .now .sceneId>`: the scenes of the installation (CR §4.3, owner decision 7א). Th... |
| `screens/schedule-conditions.ts` | `schedule-conditions` | 370 |  |  |  | The condition builder (SCHEDULER_API §2.4, §12.5) - one block for the whole schedule (the component keeps the ... |
| `screens/schedule-create-dialog.ts` | `schedule-create-dialog` | 449 |  |  |  | "תזמון חדש" (mockup 09 / 26). Two ways in: a template (then the editor opens with a draft; the devices are cho... |
| `screens/schedule-drawer.ts` | `schedule-actions`, `schedule-drawer` | 615 | yes |  |  | How an action ended, for the screen's note or the drawer's status line. |
| `screens/schedule-edit-logic.ts` | (logic / data) | 834 |  |  |  | The pure rules of the schedule editor (no DOM, no Lit): what a slot's actions look like as groups, how a devic... |
| `screens/schedule-editor.ts` | `schedule-editor` | 2042 | yes |  |  | The schedule editor (mockup 05-09, 17-19 editor level, 21, 24-25). Route (S3 mounts it): `#/devices/schedules/... |
| `screens/schedule-entity-picker.ts` | `schedule-entity-picker` | 278 |  |  |  | "בחירת התקנים" (mockup 08): the devices a schedule may act on, by room or by type, with multi-select. The list... |
| `screens/schedule-grid-logic.ts` | (logic / data) | 586 |  |  |  | The pure geometry and slot operations of the schedule editor's 24-hour scheme (no DOM, no Lit, so the unit spe... |
| `screens/schedule-lowering-dialog.ts` | `schedule-lowering-dialog` | 168 |  |  |  | The explicit confirmation of a sensitive schedule (SCHEDULER_API §5.3, decision 3/4): a schedule that opens a ... |
| `screens/schedule-slot-panel.ts` | `schedule-slot-panel` | 607 |  |  |  | The editor of one slot (mockup 05 / 06, the card under the board): when it runs, when its window ends, what it... |
| `screens/schedule-table-view.ts` | `schedule-table-view` | 365 |  |  |  | The table view of the same scheme (mockup 07 / 23): one row per slot, "from" and "to" typed inline (07:30, 18,... |
| `screens/schedule-templates.ts` | (logic / data) | 267 |  |  |  | The create flow's data (no DOM, no Lit): the templates, the condition presets that can be laid over any of the... |
| `screens/schedules-logic.ts` | (logic / data) | 576 |  |  |  | Schedules: the pure logic of the list screen, its drawer and the settings page (no DOM, no components, so the ... |
| `screens/schedules-week-view.ts` | `schedules-week-view` | 279 |  |  | 8 | The list's week view (mockup 03): every enabled schedule of the shown set composed on one 7 x 24 h board - rea... |
| `screens/screens-index.ts` | `screens-index` | 149 |  |  |  | Design-review index of every skeleton screen (/mobile variants are the same routes at phone width). |
| `screens/script-editor.ts` | `script-editor` | 192 | yes |  |  | The script editor (CR §4.4; mockup 44): the name, the fields form definition (the five selector kinds: number,... |
| `screens/scripts-panel.ts` | `scripts-panel` | 259 | yes |  |  | `<scripts-panel .items .status .now>`: the script runner (CR §4.4). A big "הפעל" button per script; a script t... |
| `screens/security-alarm.ts` | `security-alarm` | 1310 |  |  |  | SEC polish: the zones as cards (the default) or as one dense list per area; kept per browser. |
| `screens/settings-nav-strings.ts` | (logic / data) | 30 |  |  |  | The strings of the personal "Settings navigation on phones" card (Settings > General > Tabs). Screen-local on ... |
| `screens/styleguide-screen.ts` | `styleguide-screen` | 267 |  |  | 4 | Living style guide — the "Storybook equivalent" required by DESIGN_CONTRACT (tokens v3, boards language). |
| `screens/system-access-audit.ts` | `system-access-audit` | 239 |  |  |  | A person's name on a record is a button that narrows the log to them (inline: the table's cells live in its sh... |
| `screens/system-access-control.ts` | `system-access-control` | 153 |  |  |  | The Settings page "בקרת כניסה" (#/system/access-control[/audit//groups]) - the technical truth of the access-c... |
| `screens/system-access-display.ts` | `system-access-display` | 226 |  |  |  | "תצוגת מסך התחנות" - the stations screen's four display settings as real controls, in Settings › כללי › מתגי מ... |
| `screens/system-access-groups.ts` | `system-access-groups` | 259 |  |  |  | "קבוצות ושדות" - the third segment of the Settings page "בקרת כניסה": the person groups (and the stations each... |
| `screens/system-access-health.ts` | `system-access-health` | 334 |  |  |  | The body of the station-health drawer of the Settings status page - one station's health card (`GET stations/{... |
| `screens/system-access-logic.ts` | (logic / data) | 23 |  |  |  | Pure helpers of the roles screen (system-access.ts) - no DOM, unit-tested in Node (tests/unit-role-editor-lega... |
| `screens/system-access-messaging.ts` | `system-access-messaging` | 682 |  |  |  | WA-CONSENT-LINK: the consent request's languages (the server's CONSENT_LANGS) and the words of "the page canno... |
| `screens/system-access-parity.ts` | `system-access-parity` | 299 |  |  |  | A link inside a table cell (the table's own shadow root: inline, tokens only), a 44 px target. |
| `screens/system-access-policy.ts` | `system-access-policy` | 206 |  |  |  | "מדיניות" - the fourth segment of the Settings page "בקרת כניסה": the four administrator settings the owner's ... |
| `screens/system-access-status.ts` | `system-access-status` | 361 |  |  |  | "מצב מערכת" - the status segment of the Settings page "בקרת כניסה" (#/system/access-control). Four tiles (stat... |
| `screens/system-access.ts` | `system-access` | 1285 |  |  |  | T055 (§15): the permissions a camera-scoped binding actually carries - everything served per camera. The rest ... |
| `screens/system-alarm.ts` | `system-alarm-settings`, `system-alarm-user` | 371 |  |  |  | הגדרות › אבטחה › ניהול אזעקה (): the discovered panels and their integration, the write-only panel code, the z... |
| `screens/system-announce-templates.ts` | `system-announce-templates` | 100 |  |  |  | הגדרות › מולטימדיה › הכרזות קוליות › "תבניות הודעה". The ready-made announcements (routine and emergency; Hebr... |
| `screens/system-announcements.ts` | `system-announcements` | 317 |  |  |  | הגדרות › מולטימדיה › "הכרזות קוליות" (administrator, `system.configure`; local network only): the switch, the ... |
| `screens/system-audit.ts` | `system-audit` | 245 |  |  |  | P2: where the actor came from. Local = inside the system's own UI (through תשתית המערכת). |
| `screens/system-automations.ts` | `system-automations` | 588 |  |  |  | The templates seen are remembered in this browser (the server's gallery answer leaves out the hidden ones): `t... |
| `screens/system-brand-colors.ts` | `system-brand-colors` | 189 |  |  |  | הגדרות › כללי › צבעי המותג the installation's accent colour and switch-on colour (`ui.accent`, `ui.toggle_on`;... |
| `screens/system-brand-installer.ts` | `system-brand-installer` | 327 |  |  | 6 | The values an administrator edits before saving (the logo FILES and the pack are applied the moment they are s... |
| `screens/system-brand-logos.ts` | `system-brand-logos` | 737 |  |  | 13 | The values an administrator edits before saving (the logo FILES are saved the moment they are uploaded). |
| `screens/system-cast.ts` | `system-cast`, `cast-my-screens` | 521 |  |  |  | הגדרות › מולטימדיה › "שידור למסכים" (administrator, `system.configure`, LOCAL network only - the routes answer... |
| `screens/system-design.ts` | `system-design` | 536 |  |  |  | הגדרות › כללי › מראה המערכת (design foundation, 2026-10-01): the skin of the whole product (one structure, sev... |
| `screens/system-devices.ts` | `system-devices` | 423 |  |  |  | — camera health (board 2 screen 12): registry from the backend (read-only NVR sync) or demo rows. |
| `screens/system-diagnostics.ts` | `system-diagnostics` | 1634 |  |  | 6 | הגדרות › מתגי מסכי כניסה: the SMPLWISE WisKey screens that can show either WisKey's own panel or the screen bu... |
| `screens/system-door-blocks.ts` | `sw-door-blocks` | 335 |  |  |  | True = release (a note is required), false = block again (a note is optional). |
| `screens/system-doors-logic.ts` | (logic / data) | 154 |  |  |  | Pure helpers of the WisKey door Settings cards (wave 1, system-doors.ts) - no DOM, unit-tested in Node (tests/... |
| `screens/system-doors.ts` | `sw-door-grants`, `sw-door-setup`, `sw-door-inventory` | 394 |  |  |  | Settings › הרשאות › "פתיחת דלתות" (D3, owner decision 13: "anyone I choose, not too complicated"). One switch ... |
| `screens/system-emergency-open.ts` | `sw-emergency-open-settings` | 105 |  |  |  | The emergency-open role's settings in the general system settings, next to the door cards - the default expiry... |
| `screens/system-fleet-report.ts` | `system-fleet-report` | 674 |  |  |  | Settings › דיווח בריאות (`#/system/fleet-report`) - the installation side of the daily health report to SmplWi... |
| `screens/system-ha-users.ts` | `sw-ha-users` | 330 |  |  |  | (docs/design/_HA_USERS_FROM_ARX.md): Settings › משתמשים והרשאות › משתמשי מערכת הבית (tab `ha-users` of system-... |
| `screens/system-home-screen.ts` | `system-home-screen` | 267 |  |  |  | A schematic of each direction (the mockup's three layouts): the widgets in the accent colour, the summary tile... |
| `screens/system-index.ts` | (logic / data) | 209 |  |  |  | SET-polish (2026-10-10): the index of the settings - every destination an administrator can reach under הגדרות... |
| `screens/system-infra.ts` | `system-infra` | 107 |  |  |  | The sections register themselves (`screens/electricity/settings-*.ts`); see docs/architecture/ELECTRICITY_UI_S... |
| `screens/system-local-users.ts` | `system-local-users` | 658 |  |  |  | One Arx-only identity as GET /identity/local-users lists it (never a hash, never a link). |
| `screens/system-look.ts` | `system-look` | 581 |  |  |  | הגדרות › כללי › מראה (Bubble foundation, owner 2026-10-02): every look dial of the skin - density, surface, po... |
| `screens/system-lookup-scope.ts` | `sw-lookup-scope` | 104 |  |  |  | "בירור מצב פעולה ישנה" (section 5, owner decision option א + question 5): who may look up the status of an OLD... |
| `screens/system-messaging-accounts.ts` | `system-messaging-accounts` | 593 |  |  |  | Slice 5a: Settings › ערוץ ההודעות (`#/system/messaging-accounts`, section 9.9.3; the approved mock-up's "ערוץ ... |
| `screens/system-mobile-options.ts` | `system-mobile-options` | 142 |  |  |  | The options in the order the settings card lists them (the structure guard first: it is on by default). |
| `screens/system-multimedia-players.ts` | `system-multimedia-players` | 709 |  |  |  | The kinds a speaker / player / receiver card may be set to (settings choose; the detected kind is the default)... |
| `screens/system-multimedia.ts` | `system-multimedia` | 562 |  |  |  | The keys a model may add on top of its profile (section 4: "model-specific extras are enabled per screen in se... |
| `screens/system-nav-size.ts` | `system-nav-size` | 420 |  |  |  | The preview's tabs (the same icons and labels as the rail; shell/nav.ts NAV_A). |
| `screens/system-nav.ts` | `system-nav` | 479 |  | bubble, domus, tesla |  | SET-polish (2026-10-10): the settings' own navigation. On a wide screen a column at the start side of every הג... |
| `screens/system-notices.ts` | `system-notices` | 770 |  |  | 1 | Section 9: הגדרות › לוח הודעות (#/system/notices) and one board's page (#/system/notices/<board id>). The modu... |
| `screens/system-notifications.ts` | `system-notifications` | 1394 | yes |  | 12 | The log table reaches back 14 days; the failures panel above it counts the last 24 hours (each is labelled wit... |
| `screens/system-palette-editor.ts` | `system-palette-editor` | 465 |  |  |  | The key colours the editor offers (path inside a scheme, Hebrew name), the accent first. The rest of a palette... |
| `screens/system-plan-view.ts` | `system-plan-view` | 432 |  |  |  | הגדרות › מפה › תצוגה ריאליסטית (UI; LOOK_SPEC section 10, owner rule 2026-10-09: every look choice stays chang... |
| `screens/system-presence-places-logic.ts` | (logic / data) | 28 |  |  |  | The pure parts of the place editors and the "מי במבנה" thresholds (screens/system-presence-places.ts), free of... |
| `screens/system-presence-places.ts` | `system-presence-places`, `system-presence-screen` | 351 |  |  |  | הגדרות › אפליקציה לנייד › מקומות (board r035): the geofences, the beacons and the Wi-Fi sites on ONE screen, t... |
| `screens/system-presence.ts` | `system-presence` | 382 |  |  |  | The pages of הגדרות › אפליקציה לנייד. |
| `screens/system-readiness.ts` | `system-readiness` | 969 |  |  |  | הגדרות › מוכנות (slice 1, owner-approved mockup 24.10): one score for how complete and how safe the installati... |
| `screens/system-schedules.ts` | `system-schedules` | 558 |  |  |  | The technical name of each class as the settings page shows it (a settings screen keeps the exact names). |
| `screens/system-security-cameras.ts` | `system-security-cameras` | 933 |  |  |  | A new number per toast: the element is re-created, so its 10 s timer starts again. |
| `screens/system-security-privacy-masks.ts` | `system-security-privacy-masks` | 1210 |  |  |  | What one camera's mask looks like on screen: the NVR's mask, the frame and limits, and the draft being edited. |
| `screens/system-security-public.ts` | `system-security-public` | 203 |  |  |  | "Settings > Security > Public interface" - the administrator's settings of the public-surface hardening, one p... |
| `screens/system-security-wiskey.ts` | `system-security-wiskey` | 178 |  |  |  | "Settings > Security > Access-control reads" - the administrator's screen of the four `wiskey.acr5_*` switches... |
| `screens/system-security.ts` | `system-security`, `system-security-nvr` | 214 |  |  |  | GET /api/v1/health - the connection facts, for every signed-in user (the same read הגדרות › חיבורים starts fro... |
| `screens/system-service-identity.ts` | `system-service-identity` | 327 |  |  |  | P3: GET /identity/service-identity (local channel only, system.configure) - services/service_identity.status o... |
| `screens/system-setup.ts` | `system-setup` | 592 |  |  |  | GET /api/v1/health — the add-on's own connection facts (no device probe, every signed-in user). |
| `screens/system-storage.ts` | `system-storage` | 493 |  |  | 1 | — storage analytics (board 2 screen 11, Beta): range pills, three stat cards, usage forecast with a "projected... |
| `screens/system-tabs-mode.ts` | `system-tabs-mode` | 773 |  |  |  | The capsule's own sample (Unreleased): the floors of a house, an "all" row with a divider after it, an icon an... |
| `screens/system-tabs.ts` | `system-tabs-config` | 549 |  |  |  | The names of the bar styles (הגדרות › לשוניות › סגנון סרגל). |
| `screens/system-tickets.ts` | `system-tickets` | 1079 | yes |  |  | RFQ-VENDOR-UPLOAD (contract 19.10): the limit fields and the server's hard caps (the settings document validat... |
| `screens/system-timeline-colors.ts` | `system-timeline-colors` | 296 |  |  | 1 | הגדרות › וידאו ומדיה › צבעי ציר הזמן . One row per thing the investigation timeline draws: its na |
| `screens/system-transit.ts` | `system-transit` | 291 |  |  |  | הגדרות › תחבורה ציבורית (#/system/transit). The installation's part of the feature: the module switch, up to f... |
| `screens/system-update.ts` | `system-update` | 548 |  |  | 1 | הגדרות › עדכונים (installation scope, `system.update`: system administrators). The installed and the latest ve... |
| `screens/system-video-conn-test.ts` | `system-video-conn-test` | 276 |  |  |  | The run's browser facts: family and major version only (never the full user-agent string). |
| `screens/system-wall.ts` | `system-wall` | 449 |  |  |  | Section 8: הגדרות › מסכי קיר. A list of wall users (a table on desktop, cards on a phone), an add dialog that ... |
| `screens/system-wiskey-diagnostics.ts` | `system-wiskey-diagnostics` | 238 |  |  |  | הגדרות › מתגי מסכי כניסה › "WisKey רואה את Arx כ־" (B0, read-only, system administrators). WisKey's own answer... |
| `screens/system-wizard.ts` | `system-wizard` | 653 |  |  |  | Tells the shell's "השלם את ההתקנה" hint what the wizard just learned, so it does not wait for its own next rea... |
| `screens/tabs-place-strings.ts` | (logic / data) | 40 |  |  |  | 2026-10-17: the strings of the header dropdown placement card (הגדרות › כללי › לשוניות). Screen-local on purpo... |
| `screens/tickets-board.ts` | `tickets-board` | 681 | yes |  |  | Slice 6, the manager board (`#/tickets/board`, section 13.5; mock-up v2 "לוח"): the large title, the departmen... |
| `screens/tickets-detail.ts` | `tickets-detail` | 71 |  |  |  | D18: the full-screen form of a ticket (`#/tickets/<id>`) - the deep-link address of a ticket (notifications of... |
| `screens/tickets-handlers.ts` | `tickets-handlers` | 430 | yes |  |  | Owner request 2026-10-14: "מטפלים וספקים" (#/tickets/handlers[?seg=vendors/contacts]) - the fifth entry of the... |
| `screens/tickets-list.ts` | `tickets-list` | 586 | yes |  |  | `#/tickets/mine?status=open` -> the path and the params the router writes (no history entry for a filter keyst... |
| `screens/tickets-maintenance.ts` | `tickets-maintenance` | 110 |  |  |  | Slice 2: the section "תחזוקה ובקרה" of the service-management area (`#/tickets/maintenance/<page>`), drawn as ... |
| `screens/tickets-overview.ts` | `tickets-overview` | 1050 | yes |  |  | The board and the numbers row every minute while visible (spec 5); the requests for quotation, the payment dat... |
| `screens/tickets-rfqs.ts` | `tickets-rfqs` | 313 |  |  |  | "בקשות הצעת מחיר" (#/tickets/rfqs): the manager's requests for quotation - a request sent to SEVERAL vendors w... |
| `screens/tickets-table.ts` | `tickets-table` | 721 | yes |  |  | Slice 6b (D24, section 13.6) `<tickets-table>`: the board's first-class TABLE view, hosted by the tickets area... |
| `screens/user-identity.ts` | (logic / data) | 12 |  |  |  | A users list prints the sign-in name under the display name only when it adds something. A display name that e... |
| `screens/wall-arrangement.ts` | (logic / data) | 105 |  |  |  | The wall arrangement model behind the "סידור הקיר" dialog (T091 order + column span, owner request 2026-09-30:... |
| `screens/wall-count.ts` | (logic / data) | 40 |  |  |  | How many cameras the live wall shows . The ladder is a fixed set of steps cut off at the number of cameras the... |
| `screens/wall-grid.ts` | (logic / data) | 45 |  |  |  | Pure grid-layout maths for the all-cameras wall (T091's grid_col_span, T018's bestFit()/fitTile() sizing) - no... |
| `screens/wall-photo-sets.ts` | `sw-wall-photo-sets` | 169 |  |  |  | Section 6.2: "תמונות למסכי קיר" - the product's own photo sets (upload only; no URL, no library path, no camer... |
| `screens/wiskey-bulk-people.ts` | `sw-bulk-people-dialog` | 538 |  |  |  | The bulk people dialog of the people screen - import from a CSV file, export, and bulk edit of the selected pe... |
| `screens/wiskey-card-capture.ts` | `wiskey-card-capture` | 533 |  |  |  | How long the reader waits for a card: WisKey's collector request has a 30 s device deadline (client/capture.py... |
| `screens/wiskey-embed-phase.ts` | (logic / data) | 6 |  |  |  | What a WisKey frame that loaded but is still "loading" after the settle limit becomes: the timeout state ("unr... |
| `screens/wiskey-embed.ts` | `wiskey-embed` | 1245 |  |  |  | WisKey's own Home Assistant panel, embedded as-is (recorded decision 2026-09-28, "embedded panel"). The `hikvi... |
| `screens/wiskey-event-drawer.ts` | `wiskey-event-drawer` | 285 |  |  |  | The body of the entry-log drawer - one event: when, where, how, and (when the server says the caller may open ... |
| `screens/wiskey-events-export.ts` | `wiskey-events-export` | 173 |  |  |  | The browser saves `blob` as `name` (an anchor with a download attribute on a short-lived object URL). |
| `screens/wiskey-events.ts` | `wiskey-events` | 1011 |  |  |  | "פעילות" - the entry log of the access-control area (slice S8; the first native version is phase 1b). Rows com... |
| `screens/wiskey-format.ts` | (logic / data) | 338 |  |  |  | Ported from the owner's WisKey frontend (home-assistant-hikvision-intercom, frontend/src): the zone-aware time... |
| `screens/wiskey-message-dialog.ts` | `wiskey-message-dialog` | 602 |  |  |  | The words of a failure, one calm line (never a code, never "delivered"). |
| `screens/wiskey-overview.ts` | `wiskey-overview` | 960 |  |  | 1 | WisKey's door filter (wiskey-v4-overview.ts `WiskeyDoorFilter`). |
| `screens/wiskey-people.ts` | `wiskey-people` | 1502 |  |  |  | The sync status as a badge for the person editor's station rows (WisKey `badge(status)`): the editor's own con... |
| `screens/wiskey-person-actions.ts` | `wiskey-person-actions` | 651 |  |  | 1 | What happened, for the page (the list refetches, the person's page reloads, the result line under its header). |
| `screens/wiskey-person-drawer.ts` | `wiskey-person-drawer` | 479 |  |  |  | A sync status as a badge: the operator sees the word (answer 5 of 2026-10-12), the error text only when the se... |
| `screens/wiskey-person-editor.ts` | `wiskey-person-editor` | 1216 |  |  |  | The browser's own check of an IANA zone name (the server checks it again with the zone database). |
| `screens/wiskey-person-messages.ts` | `wiskey-person-messages` | 287 |  |  |  | An outcome as a badge: "sent" is what the service accepted (never "delivered"), "not sent" a refusal, "unknown... |
| `screens/wiskey-schedules-css.ts` | (logic / data) | 289 |  |  |  | Styles of the native schedules screen (slice S9). Only `--sw-*` tokens (unit-token-lint), no skin rules: the s... |
| `screens/wiskey-schedules.ts` | `wiskey-schedules` | 581 |  |  |  | A station's programs / code presence are read again after this long (the server caches them 30 s / 300 s anywa... |
| `screens/wiskey-station-permissions.ts` | `wiskey-station-permissions` | 256 |  |  |  | The person's access per station, inside the person's page (tab "גישה"). One row per station the caller may see... |
| `screens/wiskey-stations-actions.ts` | (logic / data) | 262 |  |  |  | The physical actions of the native stations screen (slice S6), as one small state machine with no DOM: door re... |
| `screens/wiskey-stations-css.ts` | (logic / data) | 756 |  |  |  | Styles of the native stations screen (slice S6). Only `--sw-*` tokens (unit-token-lint), no skin rules: the sk... |
| `screens/wiskey-stations-icons.ts` | (logic / data) | 20 |  |  |  | The few glyphs the stations screen needs that the shared icon set (components/sw-icon.ts) does not have: a han... |
| `screens/wiskey-stations-logic.ts` | (logic / data) | 607 |  |  |  | Pure logic of the native stations and doors screen (slice S6): no DOM, no Lit, no network - the unit spec (tes... |
| `screens/wiskey-stations-views.ts` | (view helper) | 537 |  |  |  | The templates of the native stations screen (slice S6): the card, the list row, the table, the call row, the d... |
| `screens/wiskey-stations.ts` | `wiskey-stations` | 718 |  |  |  | The read copy of a station's door settings stays this long before the drawer reads again. |
| `screens/electricity/page-accounts.ts` | (logic / data) | 2 |  |  |  | Plugged into the electricity shell (docs/architecture/ELECTRICITY_UI_SHELL.md); the element lives in src/elect... |
| `screens/electricity/page-bills.ts` | (logic / data) | 2 |  |  |  | Plugged into the electricity shell (docs/architecture/ELECTRICITY_UI_SHELL.md); the element lives in src/elect... |
| `screens/electricity/page-customers.ts` | (logic / data) | 2 |  |  |  | Plugged into the electricity shell (docs/architecture/ELECTRICITY_UI_SHELL.md); the element lives in src/elect... |
| `screens/electricity/page-meters.ts` | `elec-meters-page` | 511 |  |  |  | Storage unavailable: the choice lasts until the page closes |
| `screens/electricity/settings-business.ts` | (logic / data) | 2 |  |  |  | Plugged into the electricity shell (docs/architecture/ELECTRICITY_UI_SHELL.md); the element lives in src/elect... |
| `screens/electricity/settings-calendar.ts` | (logic / data) | 2 |  |  |  | Plugged into the electricity settings (docs/architecture/ELECTRICITY_TOU.md); the element lives in src/electri... |
| `screens/electricity/settings-prices.ts` | (logic / data) | 2 |  |  |  | Plugged into the electricity shell (docs/architecture/ELECTRICITY_UI_SHELL.md); the element lives in src/elect... |
| `screens/electricity/settings-retention.ts` | `elec-settings-retention` | 190 |  |  |  | Who edits it: the retention classes are system settings, the drafts belong to the module's managers. |
| `screens/water/page-accounts.ts` | `water-accounts-page` | 458 |  |  |  | An existing formula the editor cannot show as signed terms (a share): kept unless the terms are edited |
| `screens/water/page-alerts.ts` | `water-alerts-page` | 199 |  |  |  | תשתיות › מים › התראות (sections 5.3 and 16): the alert log in the meters page's shape - the head row (פתוחות /... |
| `screens/water/page-bills.ts` | `water-bills-page` | 298 |  |  |  | תשתיות › מים › חיובים (section 16): the electricity bills (elec-bills-list.ts / elec-bill-page.ts) with water ... |
| `screens/water/page-customers.ts` | `water-customers-page` | 228 |  |  |  | תשתיות › מים › לקוחות (section 16, D11): the electricity customers (elec-customers.ts) - the SHARED customer c... |
| `screens/water/page-meters.ts` | `water-meters-page` | 432 |  |  |  | תשתיות › מים › מונים (section 5.1): `screens/electricity/page-meters.ts` with the water adapter - the head row... |
| `screens/water/page-settings.ts` | `water-settings-page` | 287 |  |  |  | תשתיות › מים › הגדרות (section 16, owner correction 24.10): water-specific settings only. "תעריפי מים וביוב": ... |
| `screens/water/page-usage.ts` | `water-usage-page` | 211 |  |  |  | The instants of a range in the browser's zone (the installation's in practice): today, the last 7 / 30 days, t... |
| `components/architect-request-dialog.ts` | `architect-request-dialog` | 181 |  |  |  | The request text, as the dialog shows, copies, shares and downloads it. |
| `components/architect-request.ts` | (logic / data) | 75 |  |  |  | The request to the architect ("בקשה לאדריכל"): pure helpers shared by the dialog and its unit tests (no DOM at... |
| `components/automation-icons.ts` | (logic / data) | 117 |  |  |  | The stroke icons of the automations area (24x24, stroke 1.8, round caps; the same family as components/media-i... |
| `components/camera-image-health-card.ts` | `camera-image-health-card` | 117 |  |  |  | One compact row on בריאות מצלמות - is the picture of the cameras usable (dark / blurred / frozen / shifted). T... |
| `components/camera-image-health-settings.ts` | `camera-image-health-settings` | 321 |  |  |  | Every threshold, in screen order. |
| `components/cast-store.ts` | (logic / data) | 129 |  |  |  | (UI): one shared view of the open cast sessions for the pill, the live screen and the picker. It fetches `GET ... |
| `components/dd-style.ts` | (logic / data) | 51 |  |  |  | The dropdown style ids, as plain data (no Lit, no decorators): `shell/tabs-mode.ts` (and through it `shell/nav... |
| `components/device-activity-logic.ts` | (logic / data) | 276 |  |  |  | Device activity: the pure logic of the popup - the Hebrew wording of the twelve kinds, before / after formatti... |
| `components/device-activity-press.ts` | (logic / data) | 308 |  |  | 1 | Device activity: the long-press (and its accessible alternatives) that opens the activity popup of an electric... |
| `components/device-activity.ts` | `device-activity` | 1005 |  |  |  | Storage unavailable: the choice lives for this popup only |
| `components/device-card-logic.ts` | (logic / data) | 151 |  |  |  | (2026-10-07): the pure logic of the three equipment cards inside the device activity window - water heater (דו... |
| `components/fit-text.ts` | (logic / data) | 88 |  |  |  | The label of a dropdown ALWAYS fits inside its control - never an ellipsis, never a clipped word. One helper f... |
| `components/frigate-admin-shared.ts` | (view helper) | 341 |  |  |  | FRGD: what the Frigate management panels (Settings > the recorder > "שינויים ב־Frigate") share - one sheet of ... |
| `components/frigate-auto-profile.ts` | `frigate-auto-profile` | 204 |  |  |  | FRGD: the automatic profile of ONE Frigate recorder (Settings only; section 11.1): the mode (off / suggest onl... |
| `components/frigate-camera-control.ts` | `frigate-camera-control` | 252 |  |  |  | The switch to put back when the person cancels (the toggle flips itself on click) |
| `components/frigate-cases-panel.ts` | `frigate-cases-panel` | 217 |  |  |  | FRGD: Frigate's cases for ONE recorder (Settings only; F2b class `cases`, permission analytics.cases). A table... |
| `components/frigate-config-panel.ts` | `frigate-config-panel` | 535 |  |  |  | FRGS: zones and the curated camera settings of ONE Frigate recorder (Settings > the recorder > "שינויים ב־Frig... |
| `components/frigate-control-settings.ts` | `frigate-control-settings` | 343 |  |  |  | The inverse kind an undo of a change performs (its first supervised write): absent = the undo is not gated. |
| `components/frigate-event-control.ts` | `frigate-event-control` | 164 |  |  |  | F2 (gap closure): the two event actions of a Frigate tracked object on the review detail - keep its footage (t... |
| `components/frigate-exports-panel.ts` | `frigate-exports-panel` | 306 |  |  |  | FRGD: Frigate's exports for ONE recorder (Settings only; F2b class `exports`, permission analytics.exports + v... |
| `components/frigate-manual-events.ts` | `frigate-manual-events` | 147 |  |  |  | FRGD: manual events on ONE Frigate recorder (Settings only; F2b, class `events`, permission analytics.events).... |
| `components/frigate-review-card.ts` | `frigate-review-card` | 647 |  |  | 1 | The table view's columns, one grid template shared by the header row (investigate-reviews) and every row (this... |
| `components/frigate-review-detail.ts` | `frigate-review-detail` | 334 |  |  | 1 | F1B / FRGD: the body of the review drawer - the still as a hero, the facts as a quiet two-column grid, the tra... |
| `components/frigate-summary.ts` | `frigate-summary` | 149 |  |  |  | F1B: what a Frigate recorder offers (version, cameras, detectors, retention, the features Arx discovered on / ... |
| `components/frigate-supervision.ts` | `frigate-supervision` | 178 |  |  |  | FRGD: the supervision view of ONE Frigate recorder (Settings only; section 11): which kinds already had their ... |
| `components/frigate-zone-editor.ts` | `frigate-zone-editor` | 301 |  |  |  | FRGS: the zone stage - the camera's still with its Frigate zones drawn over it, and the polygon being edited. ... |
| `components/media-bulk-dialog.ts` | `media-bulk-dialog` | 228 |  |  |  | The HA floor / area id. |
| `components/media-command.ts` | (logic / data) | 60 |  |  |  | One deliberate press -> one command -> an honest outcome (MEDIA_API.md §3.4, CR §5.3). Shared by the screen ca... |
| `components/media-group-dialog.ts` | `media-group-dialog` | 270 |  |  |  | A generic confirmation: the question, one sentence, the rooms under a closed "פרטים", and what the confirm but... |
| `components/media-icons.ts` | (view helper) | 104 |  |  |  | The stroke icons of the multimedia area (24x24, stroke 1.8, round caps - the set of sw-icon.ts plus the remote... |
| `components/media-library-browse.ts` | `media-library-browse` | 311 |  |  |  | What the panel does with a tapped item: the ordinary `play_item` command (play now, after the current one, or ... |
| `components/media-ma-connection.ts` | `media-ma-connection` | 164 |  |  |  | Phase 2b (docs/changes/.md section 17.3 / 17.8): הגדרות › מולטימדיה › חיבור - the direct Music Assistant conne... |
| `components/media-now-hero.ts` | `media-now-hero` | 371 |  |  | 4 | The Bubble skin's "now playing" hero (phase C, 2026-10-02; the media board's top panel): ONE glass panel over ... |
| `components/media-now.ts` | (logic / data) | 75 | yes |  | 6 | What a screen's card draws for its "now" - pure (no DOM, no Lit), so the card, the area card (S3) and the unit... |
| `components/media-player-card.ts` | `media-player-card` | 937 | yes |  | 2 | ONE card per physical speaker, player or receiver (MEDIA_PLAYERS_API.md §2, mockup `players-index.html` "PLAYE... |
| `components/media-player-css.ts` | (logic / data) | 1076 |  |  |  | The player panel's look. It extends the remote's glass tokens and base rules (media-remote-css.ts: `--mr-*`, t... |
| `components/media-player-icons.ts` | (view helper) | 27 |  |  |  | The few glyphs the player panel needs on top of the remote's set (same 24 px stroke style, `currentColor`). |
| `components/media-player-logic.ts` | (logic / data) | 446 |  |  |  | The player panel's rules as pure functions and small classes - no DOM, no Lit, no network (the unit specs load... |
| `components/media-player-now.ts` | (logic / data) | 66 |  |  | 2 | What a player's card draws for its "now" - pure (no DOM, no Lit), so the card, the groups page's rows and the ... |
| `components/media-player-panel.ts` | `media-player-panel` | 1114 | yes |  |  | The player panel (): what the TV remote is to a screen, for a speaker, a player, a receiver or a group. It liv... |
| `components/media-player-run.ts` | (logic / data) | 57 |  |  |  | One deliberate press -> one player command -> an honest outcome (MEDIA_PLAYERS_API.md §3, CR §6.1). The player... |
| `components/media-player-volume.ts` | `media-player-volume` | 292 |  |  |  | The result of the last group run for a room, shown under its name ("הוגבל לתקרה", "לא הצטרף" ...). |
| `components/media-preset-editor.ts` | `media-preset-editor` | 211 |  |  |  | A saved group as the editor starts from it (`NEW_PRESET` for a new one). |
| `components/media-queue-list.ts` | `media-queue-list` | 479 |  |  |  | Phase 2b (docs/changes/.md section 17.8): the FULL queue of a player inside the player panel - the "הבא בתור" ... |
| `components/media-remote-css.ts` | (logic / data) | 1200 | yes |  | 56 | The remote's look. Always glass whatever `devices.style` says; light or dark by the installation's `devices.sc... |
| `components/media-remote-keys.ts` | (logic / data) | 126 |  |  | 2 | The remote's vocabulary as data - the Hebrew label and the glyph of every KeyId, the glyph set itself and the ... |
| `components/media-remote-logic.ts` | (logic / data) | 364 |  |  |  | The remote's rules as pure functions and small classes - no DOM, no Lit, no network (the unit specs load this ... |
| `components/media-remote-pad.ts` | `media-remote-pad` | 312 |  |  |  | The remote's d-pad (concentric: four arrows round a round OK) and its alternative, the touchpad (swipe = an ar... |
| `components/media-remote-press.ts` | (logic / data) | 100 |  |  |  | How a press on a remote control turns into key events - one small class shared by the d-pad, the rockers and e... |
| `components/media-remote.ts` | `media-remote` | 873 | yes |  | 11 | The remote ("שלט", ): ONE component for the screens page, the area card and the home widget. A modal `sw-drawe... |
| `components/media-screen-card.ts` | `media-screen-card` | 630 | yes |  | 7 | ONE card per physical screen (MEDIA_API.md §2.1, mockup v2 "Domus" glass): the now-showing poster (our own hue... |
| `components/multi-select.ts` | (logic / data) | 53 |  |  |  | The pure selection logic of a multi-select dropdown (sw-dropdown `multiple`, 2.0.1, owner request 2026-10-05: ... |
| `components/notify-center.ts` | `notify-center` | 767 | yes |  |  | / CR §6.1: the notification center. Opened from the user menu's bell; desktop: a glass sheet at the content's ... |
| `components/notify-css.ts` | (logic / data) | 405 | yes |  |  | The look of the notification surfaces (the center, its rows and detail, the Settings tab). It stands on the gl... |
| `components/notify-detail.ts` | `notify-detail` | 366 | yes |  |  | The detail of one notification (the mockup's second level of the center): what / where / when, the state and s... |
| `components/notify-icons.ts` | (view helper) | 68 |  |  |  | The pictograms of the notification surfaces (the approved mockup's set: the stroke style of sw-icon, 24x24, ro... |
| `components/notify-logic.ts` | (logic / data) | 275 |  |  |  | The pure logic of the notification center and the Settings tab (no DOM, no network): what a row says, which ta... |
| `components/notify-row.ts` | `notify-row` | 322 | yes |  |  | One notification row of the center (the approved mockup): the severity bar, the pictogram ring with the folded... |
| `components/notify-store.ts` | (logic / data) | 323 |  |  |  | The one client-side store behind the notification center, the avatar badge and the user menu chip. It owns the... |
| `components/notify-whatsapp-logic.ts` | (logic / data) | 43 |  |  |  | NOTIFWA: the pure state rules of `<notify-whatsapp-section>` (unit-tested in frontend/tests/unit-notify-whatsa... |
| `components/notify-whatsapp-mine.ts` | `notify-whatsapp-mine` | 141 |  |  |  | NOTIFWA review F1 / F2: the signed-in user's OWN WhatsApp row - the number notifications would go to (masked, ... |
| `components/notify-whatsapp-section.ts` | `notify-whatsapp-section` | 225 |  |  |  | NOTIFWA: the WhatsApp section of Settings › התראות - the master switch (OFF by default), the sending account (... |
| `components/nvr-connection-form.ts` | `nvr-connection-form` | 641 |  |  |  | Fields the server keeps as columns; any other field of a vendor's catalogue entry travels in `extra`. |
| `components/nvr-recorders-card.ts` | `nvr-recorders-card` | 360 |  |  |  | Section 7.2: what disabling really does. The cameras leave the live wall, the kiosk, the overview and every ca... |
| `components/nvr-restart-banner.ts` | `nvr-restart-banner` | 191 |  |  |  | The connection form tells the banner that a save / removal just made a restart necessary (it does not wait for... |
| `components/recorder-health-panel.ts` | `recorder-health-panel` | 541 |  |  |  | The thresholds the settings card edits, in screen order: key, label, unit. |
| `components/restarts-card.ts` | `sw-restarts-card` | 229 |  |  |  | How long the screen waits for Arx to answer again before it asks for a manual start (the same two minutes as t... |
| `components/run-trace.ts` | `run-trace` | 258 | yes |  |  | `<run-trace .trace .mode .now .timeZone>`: "למה זה רץ" the full trace of one run as the platform shows it, wit... |
| `components/scene-capture.ts` | `scene-capture` | 459 | yes |  |  | `<scene-capture .name .members .entities .phase .error>`: the table of a scene . The aut |
| `components/script-fields-form.ts` | `script-fields-form` | 179 | yes |  |  | `<script-fields-form .fields .values .entityChoices>`: the short form of a script that has `fields` (CR §4.4):... |
| `components/scroll-lock.ts` | (logic / data) | 78 |  |  |  | The ONE scroll lock behind every modal overlay (sw-drawer `modal` today; any new overlay uses it too). While a... |
| `components/sr-heading.ts` | (view helper) | 46 |  |  |  | UXFIX-(UX audit 2026-10-20, finding 14): a page whose layout draws no visible title still carries exactly one ... |
| `components/sw-automation-card.ts` | `automation-card` | 325 | yes |  |  | `<automation-card .item .href .traceHref>`: one automation of the list (mockup `docs/design/mockups/automation... |
| `components/sw-automation-row.ts` | `automation-row` | 262 | yes |  |  | `<automation-row .item .href>` one automation as a 52 px row instead of a card - the |
| `components/sw-avatar.ts` | `sw-avatar` | 38 |  |  |  | Initials avatar (board 3: users table, top bar). |
| `components/sw-badge.ts` | `sw-badge` | 130 |  | tesla |  | Visible data-quality states. Live / recorded / offline / stale / unknown / forbidden must stay |
| `components/sw-block-card.ts` | `sw-block-card` | 261 | yes |  |  | One block of the builder (a trigger, a condition or a step): a card with the block's own Hebrew sentence, its ... |
| `components/sw-brand.ts` | `sw-brand` | 137 |  |  | 2 | 4.4: ONE logo component for every placement. `<sw-brand kind="company/product">` draws the installation's comp... |
| `components/sw-bridge-key-card.ts` | `sw-bridge-key-card` | 251 |  |  |  | "מפתח הגשר" / Bridge key - Settings › Connections, right after the stored-passwords card. System administrator... |
| `components/sw-button.ts` | `sw-button` | 152 |  | arx-motion, bubble, crystal, domus, tesla |  | Block: the button fills its container (phone layouts, action grids) |
| `components/sw-camera-tile.ts` | `sw-camera-tile` | 362 |  |  |  | Camera tile as drawn on the boards: only a picture with the camera name and a green dot overlaid at the bottom... |
| `components/sw-card.ts` | `sw-card` | 156 |  | bubble, crystal, domus, index, soft, tesla |  | A card. Owner decisions 2026-09-30 (area redesign) added two optional looks used by the area screens: - `row`:... |
| `components/sw-case-picker.ts` | `sw-case-picker` | 147 |  |  |  | "הוסף לתיק" (T049): pick an open case, or create one, and add an event, a recording clip or a note to it. Set ... |
| `components/sw-cast-picker.ts` | `sw-cast-picker` | 500 |  |  |  | Operator words for the screen's confidence: never the technology name (the settings screens keep those). |
| `components/sw-cast-pill.ts` | `sw-cast-pill` | 285 |  |  |  | The global "משדר N" pill, one in the action row of every screen - the floating corner of the shell. It exists ... |
| `components/sw-cast-stop.ts` | `sw-cast-stop` | 133 |  |  |  | The stop control of one cast. When the screen was off before the cast and the installation rule is on (`power_... |
| `components/sw-chip.ts` | `sw-chip` | 90 |  | arx-motion, bubble, crystal, domus, tesla |  | Selectable chip / filter pill (boards: "All / Motion / Person / Vehicle" with colour dots). |
| `components/sw-csp-reports.ts` | `sw-csp-reports` | 194 |  |  |  | P2, הגדרות › גישה מרחוק: the Content-Security-Policy reports of the remote channel (counters per directive and... |
| `components/sw-demo-banner.ts` | `sw-demo-banner` | 125 |  |  |  | The demo-mode strip. Shown to EVERY signed-in user while a demo runs (anyone looking at the box must know the ... |
| `components/sw-dialog.ts` | `sw-dialog` | 171 |  | bubble, crystal, domus, tesla |  | Small centred modal for short forms and confirmations. Closes on Escape, backdrop click or the ✕. |
| `components/sw-drawer.ts` | `sw-drawer` | 411 | yes | bubble, crystal, domus, tesla |  | The focusable elements under `root` in composed (visual) order: into shadow roots and through slots. |
| `components/sw-dropdown.ts` | `sw-dropdown` | 1699 |  | bubble, crystal |  | The look of the closed control and of the list (0.1.157, owner decision 2026-10-03: all six approved). `auto` ... |
| `components/sw-field.ts` | `sw-field` | 254 |  |  |  | Labelled form field wrapper; the control (input/select/textarea) is slotted and styled here. |
| `components/sw-floor-glyph.ts` | `sw-floor-glyph` | 65 |  |  | 3 | Isometric floor-stack glyph (board 1 screen 3): the highlighted slab is the floor in question. |
| `components/sw-floor-iso.ts` | `sw-floor-iso` | 140 |  |  | 12 | Isometric floor thumbnail (board 1 screen 3): the floor slab drawn in isometric projection with its room outli... |
| `components/sw-history-lanes.ts` | `sw-history-lanes` | 136 |  |  |  | The per-layer lanes of the historical map's time scrub, drawn above the recording track (sw-timeline) for the ... |
| `components/sw-icon.ts` | `sw-icon` | 171 |  | bubble, tesla |  | Stroke-based 24×24 icon set. Icons never mirror in RTL except the explicit `flip` ones (chevrons). |
| `components/sw-kpi.ts` | `sw-kpi` | 264 |  | bubble, crystal, domus, infra, soft, tesla |  | Stat tile as on the boards: icon in a soft-blue square, big value, label, green/amber sub-label. Owner 2026-09... |
| `components/sw-list-display-settings.ts` | `sw-list-display-settings` | 178 |  |  |  | `<sw-list-display-settings list="schedules/automations">` (owner approval 2026-10-25: long lists use pages, wi... |
| `components/sw-live-player.ts` | `sw-live-player` | 1140 |  |  |  | Live player over the add-on's WebSocket relay (go2rtc signalling behind it). - WebRTC: offer/answer + trickle ... |
| `components/sw-native-device-card.ts` | `sw-native-device-card` | 60 |  |  |  | החשבון שלי › המכשיר שלי (): what the native app says about this phone. The card waits for the app's `deviceSta... |
| `components/sw-offbox-backup.ts` | `sw-offbox-backup` | 364 |  |  |  | Phase 2: Settings › אבחון › גיבוי ושחזור - the off-box targets (S3-compatible / SFTP), the encryption key (exp... |
| `components/sw-page.ts` | `sw-page` | 146 |  | bubble, crystal, domus, infra, soft, tesla |  | Page frame as on the boards: optional breadcrumb, 18px title, grey one-line subtitle, actions on the end side.... |
| `components/sw-pager.ts` | `sw-pager` | 101 |  |  |  | `<sw-pager .page .pages>`: the pages of a long list on a control screen (owner rule 2026-10-24: control screen... |
| `components/sw-partner-api-card.ts` | `sw-partner-api-card` | 353 |  |  |  | "ממשק לשותפים" / Partner interface - Settings › Connections, after the bridge-key card. `partner.manage` only ... |
| `components/sw-passkeys.ts` | `sw-passkeys` | 247 |  |  |  | החשבון שלי › אימות דו־שלבי › מפתחות גישה (phase 4): the passkeys of an Arx-only identity - add (a fresh sign-i... |
| `components/sw-pill.ts` | `sw-pill` | 553 |  | bubble | 1 | The pill row of the Bubble foundation an icon ring, a label, a state line and sub-buttons at the end (slot `su... |
| `components/sw-place-tree.ts` | `sw-place-tree` | 175 |  |  |  | A places tree used as a filter (slice S6, the design's `sw-place-tree`): "all", then floors (collapsible) with... |
| `components/sw-popover.ts` | `sw-popover` | 105 |  | bubble, crystal, domus, tesla |  | Floating card anchored near a map marker (board 1 screen 4: "Office 2F – Entrance" card with the live picture ... |
| `components/sw-remote-sessions.ts` | `sw-remote-sessions` | 222 |  |  |  | P2: the remote sign-ins (SmplWise Arx sessions) - one row per browser or client: what it is (browser family · ... |
| `components/sw-scene.ts` | `sw-scene` | 266 |  |  | 176 | Illustrated placeholder scenes for camera tiles, thumbnails and site cards. They give the boards' "picture" fe... |
| `components/sw-schedule-bar.ts` | `sw-schedule-bar`, `sw-day-chips`, `schedule-condition-chip`, `sw-schedule-markers` | 280 |  |  |  | Schedules, the small shared pieces of the list, the drawer and (by tag) S4's editor header: - `<sw-schedule-ba... |
| `components/sw-schedule-grid.ts` | `sw-schedule-grid` | 1058 |  |  | 2 | The 24-hour scheme of a schedule (docs/design/mockups/scheduler screens 05 / 06 / 21 / 24). A row is one day (... |
| `components/sw-search-access.ts` | `sw-search-access` | 54 |  |  |  | Who may use the search in the top-left pill. Off by default - a search is a way to reach places a person was n... |
| `components/sw-second-factor.ts` | `sw-second-factor`, `sw-second-factor-user`, `sw-second-factor-policy` | 399 |  |  | 3 | The otpauth link as an inline SVG QR code (one path, no data: URL, so the strict remote CSP is untouched). |
| `components/sw-secrets-card.ts` | `sw-secrets-card` | 215 |  |  |  | (docs/operations/ADDON_OPTION_REMOVAL_NOTE.md): הגדרות › חיבורים › סודות / Secrets - the go2rtc API password, ... |
| `components/sw-share-members.ts` | `sw-share-members` | 200 |  |  |  | One small glyph per kind (16px, currentColor): the same line style as the map's symbols. |
| `components/sw-sheet.ts` | `sw-sheet` | 488 |  | bubble, crystal | 4 | The element that really holds focus (through shadow roots). |
| `components/sw-state-panel.ts` | `sw-state-panel` | 143 |  |  |  | The mandatory non-ready states (DESIGN_CONTRACT): loading, empty, error, forbidden, stale/offline, partial. |
| `components/sw-steps.ts` | `sw-steps` | 86 |  |  |  | Wizard progress header as on the onboarding board: numbered circles with labels beneath, connected by lines. |
| `components/sw-table.ts` | `sw-table` | 183 |  | bubble, crystal, domus, tesla |  | Data table in the boards' language: white card, quiet grey header, 40px rows with thumbnails / avatars rendere... |
| `components/sw-tabs.ts` | `sw-tabs` | 408 |  | bubble, crystal, domus, tesla | 8 | RFQQUESTIONS: something waits for the user here (a red number pill after the label; the dropdown shows `alert`... |
| `components/sw-timeline.ts` | `sw-timeline` | 401 |  |  | 4 | A case bookmark on the track (T049): a flag at its start, a thin band over its window. |
| `components/sw-toggle.ts` | `sw-toggle` | 84 |  | arx-motion, bubble, crystal, domus, soft, tesla |  | Keep `label` as the switch's accessible name but do not render it (the row already shows the text). |
| `components/sw-view-switch.ts` | `sw-view-switch` | 93 |  |  |  | A shared icon name (sw-icon) or one of the local glyphs (screens/wiskey-stations-icons.ts). |
| `components/sw-vslider.ts` | `sw-vslider` | 273 |  |  |  | The vertical slider of the Bubble skin (2026-10-05; the Bubble Card "vertical slider" button): a tall pill who... |
| `components/sw-week-grid.ts` | `sw-week-grid` | 258 |  |  |  | One range of a day's schedule; `mode` is used by the recording schedule (CMR / MOTION / EDR…), absent for armi... |
| `components/update-run.ts` | `sw-update-run` | 372 |  |  |  | The page that follows one run: shown while it runs (also across the restart of Arx), then its outcome. Events:... |
| `components/wk-action-button.ts` | `wk-action-button` | 166 |  |  |  | The one action button of the native stations screen (slice S6): a door's "פתח", a call's answer / decline / en... |
| `components/wk-announce-dialog.ts` | `wk-announce-dialog` | 426 |  |  |  | The announcement composer of the stations screen (slice S6; the design's `wk-announce-dialog`): where to (one ... |
| `components/wk-listen-button.ts` | `wk-listen-button` | 202 |  |  |  | Listening to a station () in the stations drawer: one button to start and stop, a mute toggle and a level mete... |
| `components/wk-station-live.ts` | `wk-station-live` | 171 |  |  |  | A station's live picture and push-to-talk in the stations screen's drawer (slice S18). The picture is the prod... |
| `components/wk-talk-button.ts` | `wk-talk-button` | 261 |  |  |  | Two-way talk with a station (slice S18; owner 25.10: full duplex, the microphone open for the whole session, n... |
