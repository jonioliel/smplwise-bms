# REL2211-ASSEMBLY-295: assembly record of 2.21.1

Branch `release/2211`, cut from `origin/release/2201` @ `8aa101a4d` (2.20.1). The 2.21.0 line (`release/2210`) is not included; if it is merged under this branch later, migration numbers stay unique because this version adds none (the chain ends at 0177).

## Merge order and conflicts

1. `pilot/FIX2200-295` @ `8b35e887f`: clean.
2. `pilot/TVOPT-295` @ `b83723552` (includes `eb9458878`): 5 conflicts, all "both sides added": `frontend/src/api/notices.ts` (kept NOTICERSS `NewsSource` list and the connection caps, added `tv_defaults`, `putTvDefaults`), `frontend/src/i18n/notices.ts` (both key sets, he and en), `frontend/src/notice-tv/main.ts` (import union), `frontend/src/screens/system-notices.ts` (import union), `smplwise_vms/backend/smplwise/services/notices/model.py` (kept `PERM_DELETE`-era caps settings and the `notices.tv.*` defaults).
3. `pilot/POLISH2-295` @ `787acf145` (includes `7b66d8551`; the dark-contrast and rows-per-page-7 follow-ups are inside `787acf145`): clean.
4. `pilot/NOSCROLL-295` @ `cec20e6a9` (cut on `2087620163`, an ancestor of FIX2200): 3 conflicts: `devices-automations.ts` (POLISH2's visible view switch, view default and per-view page sizes kept; NOSCROLL's `fitRows`/`measureFitItems`/`fittedPageSize` added on top; NOSCROLL's `registerScreenView` registration dropped because POLISH2 replaced it; `setView` resets the fit), `evidence-automations-list.spec.ts` and `unit-screen-display.spec.ts` (both sides).
5. Fixups: `main.ts` import of `tickerItemHtml` restored; version bump 2.21.1; API inventory regenerated (1572 routes); specs that read every card on one page now pass `fit=off` (`evidence-polish2-295`) or the mocked `ui.page_size.automations_cards` (`evidence-automations-list` session specs).

## Migrations

None added by any merged branch. Chain ends at `0177_announce_stage_a.sql`.

## Local verification

- `tsc --noEmit`: clean. `vite build` (add-on and public config): built. `scripts/release_check.py`: all ok except the tag (and `www`/`www-public` are the 2.20.1 builds: rebuild on the runner).
- Playwright (desktop project, local preview): unit-screen-display, unit-tvopt-295, unit-notice-tv-logic, unit-automations-list, unit-noticepolish-295, unit-schedules-nav, evidence-noscroll-295, evidence-polish2-295, evidence-automations-list, notice-tv-header-295, pixel-notice-tv-mock: passed after the spec fixups above.
- Backend: see the report of the assembler (test_notice_tvopt_295, test_polish_display_settings, test_announce_stage_a, test_remote_access, test_no_ip_literals, test_notices_106, test_source_policy).
- NOT_RUN: full gate, tablet and mobile Playwright projects, other pixel specs, evidence-schedules-list. Pixel baselines were not regenerated; none of the pixel specs run moved.
