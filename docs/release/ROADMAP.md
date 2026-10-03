# Roadmap 0.1.152 and beyond

Owner decisions 2026-10-02: ship small versions fast; the full suite only for large ones (`TEST_POLICY.md`); run through the weekend; switch to the second Claude account only when the weekly quota is nearly exhausted (about 99%).
Estimates are agent work-hours, not wall clock. "Tier" is the test tier of `TEST_POLICY.md`.

## Release train

| Version | Tier | Contents | Needs from the owner | Status |
|---|---|---|---|---|
| **0.1.152** | L | Automations, scenes and scripts (CR-017); music queue and library through a direct Music Assistant connection (CR-016 phase 2b, verified live read and write); parallel playbacks up to 128 with a warning above half of the recorder's capacity | - | tests running, release 2026-10-02 afternoon |
| **0.1.153** | M | The three phone bug fixes (players header, area page sideways, playback toolbar under the video); caps 128 for live sessions and remote streams; Home Assistant 2026.10 compatibility; the Android two-finger gesture source; tabs as a dropdown option (two chips in one row, per tab group, in Settings) | - | agents working, release 2026-10-02 evening |
| **0.1.154** | L | Bubble on home, area and multimedia screens; performance dial (`ui.look.performance`); the "kavarnit" tab with the schedules first; tabs card | - | released 2026-10-03 |
| **0.1.155** | M | Ten ready palettes and the palette editor with a contrast warning | - | released 2026-10-03 |
| **0.1.156** | S | Test stability: two flaky specs fixed, no product change | - | released 2026-10-03 |
| **0.1.157** | M | Dropdown tabs style (4-6 mockups, owner picks) then dropdown on all widths; Bubble on security, devices, automations lists, settings chrome | the dropdown style pick | next |
| **0.1.158** | M | Bubble variants from the catalogue: weather/clock/calendar tiles, quick-launcher grid, vertical sliders, animated weather, no-surface and native surfaces, avatar badges | which variants | after 0.1.157 |
| **0.1.159** | L | Switch model (CR-019) S2-S4: schedule policy, review list and settings screen, docs | - | agent can start now |
| **0.1.160** | L | NVR camera settings (CR-020) S1 table + S2 guarded writes (H.264/SVC) | approval for every lab write | needs the owner |
| **0.1.161** | M | Music: library search without the direct connection (bridge 0.7.0, platform restart) and voice announcements | decision on announcements | later |
| **0.2.0** | L | Structural: the system runs without an NVR or go2rtc; several NVR vendors in parallel (Provision-ISR, Frigate besides Hikvision); infrastructure tab (electricity meters, electricity bill editing and export, generators, water) | access to the NVRs; the electricity bill specification; component list from Home Assistant (owner: next week) | not before next week |

## Candidate ideas from the design references (owner 2026-10-02: NOT all are adopted - evaluate what is worth it, make mockups first; target: a high-level system in one to two weeks)
Source: `GLASS_DASHBOARDS_ANALYSIS.md` (branch `pilot/design-glasshome-research`; GlassHome app is proprietary, its `ui`/widget SDK repos are MIT; Magic Frame is Polyform Noncommercial = inspiration only, no code).

| # | Idea | Where it goes | Lead's recommendation |
|---|---|---|---|
| 1 | **Performance tier for the glass look** (the one item the owner pre-approved: "if you recommend it with Bubble, do it"): no `backdrop-filter` on large tiles/lists, only on the dock, buttons and the scrim; selectable as a dial and chosen automatically on weak devices | with the Bubble releases (first item after 0.1.154) | **do it with Bubble** (the main wall-tablet risk) |
| 2 | **Material dials** `depth`, `tint`, `material` presets (Frosted, Paper, Chalk, Neon) in `ui.look`, 1px bevel rim, state-tinted tiles | after the palettes and the colour editor (0.1.156+) | useful, overlaps Bubble/Domus glass |
| 3 | **`crystal` skin** (wallpaper-led, day/night photos, glow) | after 2, behind a mockup first | the lead disagrees (overlap, needs a wallpaper) but the owner wants it: build last, mockup first |
| 4 | **Wall-display module** (kiosk screen, six-digit pairing code, restricted principal per tablet, per-breakpoint layout, live sync, periodic reload; ties to CR-007/SC31) | product feature: needs a CR and owner decisions (next week with the other new product inputs) | big (36-52 h), a product decision |
| 5 | **Photo-frame/ambient mode** and **rule-based notification tiles** | extras of the wall-display module | after 4 |
| 6 | Never adopted: unauthenticated view URLs/actions, a dock covering content | - | breaks AGENTS.md and our layout rules |

## Parallel tracks
- **iOS app** (a WKWebView shell, the Mac session): separate repository folder `mobile/`, not on this train. Needs Apple Developer account and a production signing decision for Google Play.
- **Upstream watch**: weekly Monday 08:36 scheduled task; after each monthly Home Assistant release run it by hand.
- **Nightly full run** of backend and Playwright on the integration branch when the machine is idle.
- **Design unification (later, after the Bubble family):** dark tokens for the settings screens (they have none today), one visual language across the whole system; recorded so it is not lost (owner 2026-10-02).
- **Held until stabilisation (owner decision):** V1 T058 multi-NVR as a whole, T095 second factor (CR-011), T096 Android push (CR-012), V2 studio phases T088-T090.

## Rules that bind every version
No Home Assistant branding in operator screens; clean operator screens (no hints or badges); the floors and areas tree survives every skin; list and table views in every design; every design option editable in the UI; layout guard passes (nothing floating over content); bilingual release notes with how to enable; migration numbers reserved before use.
