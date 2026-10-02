# Roadmap 0.1.152 and beyond

Owner decisions 2026-10-02: ship small versions fast; the full suite only for large ones (`TEST_POLICY.md`); run through the weekend; switch to the second Claude account only when the weekly quota is nearly exhausted (about 99%).
Estimates are agent work-hours, not wall clock. "Tier" is the test tier of `TEST_POLICY.md`.

## Release train

| Version | Tier | Contents | Needs from the owner | Status |
|---|---|---|---|---|
| **0.1.152** | L | Automations, scenes and scripts (CR-017); music queue and library through a direct Music Assistant connection (CR-016 phase 2b, verified live read and write); parallel playbacks up to 128 with a warning above half of the recorder's capacity | - | tests running, release 2026-10-02 afternoon |
| **0.1.153** | M | The three phone bug fixes (players header, area page sideways, playback toolbar under the video); caps 128 for live sessions and remote streams; Home Assistant 2026.10 compatibility; the Android two-finger gesture source; tabs as a dropdown option (two chips in one row, per tab group, in Settings) | - | agents working, release 2026-10-02 evening |
| **0.1.154** | L | Bubble skin foundation: option system (transparency, size, density, surface, radius, pop-up kind, touch-target size - all editable in the UI), shared `sw-sheet` and `sw-pill`, floating phone bar, layout guard | - | agent working |
| **0.1.155** | M | Bubble on home, area and multimedia screens | - | after 0.1.154 |
| **0.1.156** | M | About ten ready palettes (designed by the lead, each light and dark, every text pair checked at 4.5:1) and the colour editor with a contrast guard, import/export | - (owner delegated the palette choice) | after 0.1.155 |
| **0.1.157** | M | Bubble on security (live, investigation chrome), devices, automations lists, settings chrome | - | after 0.1.155 |
| **0.1.158** | M | Bubble variants from the catalogue: weather/clock/calendar tiles, quick-launcher grid, vertical sliders, animated weather, no-surface and native surfaces, avatar badges | which variants | after 0.1.157 |
| **0.1.159** | L | Switch model (CR-019) S2-S4: schedule policy, review list and settings screen, docs | - | agent can start now |
| **0.1.160** | L | NVR camera settings (CR-020) S1 table + S2 guarded writes (H.264/SVC) | approval for every lab write | needs the owner |
| **0.1.161** | M | Music: library search without the direct connection (bridge 0.7.0, platform restart) and voice announcements | decision on announcements | later |
| **0.2.0** | L | Structural: the system runs without an NVR or go2rtc; several NVR vendors in parallel (Provision-ISR, Frigate besides Hikvision); infrastructure tab (electricity meters, electricity bill editing and export, generators, water) | access to the NVRs; the electricity bill specification; component list from Home Assistant (owner: next week) | not before next week |

## Parallel tracks
- **iOS app** (a WKWebView shell, the Mac session): separate repository folder `mobile/`, not on this train. Needs Apple Developer account and a production signing decision for Google Play.
- **Upstream watch**: weekly Monday 08:36 scheduled task; after each monthly Home Assistant release run it by hand.
- **Nightly full run** of backend and Playwright on the integration branch when the machine is idle.
- **Held until stabilisation (owner decision):** V1 T058 multi-NVR as a whole, T095 second factor (CR-011), T096 Android push (CR-012), V2 studio phases T088-T090.

## Rules that bind every version
No Home Assistant branding in operator screens; clean operator screens (no hints or badges); the floors and areas tree survives every skin; list and table views in every design; every design option editable in the UI; layout guard passes (nothing floating over content); bilingual release notes with how to enable; migration numbers reserved before use.
