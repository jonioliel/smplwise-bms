# TVNOTICE2-297 - the TV notice board: the owner's answers of 27.10 (header, "updated" wording, idle logos)

Branch `pilot/TVNOTICE2-297`, cut from `pilot/TVNOTICE-297` (`bb7c8e862`). Target 2.26.0. No migration (the choices live in the settings rows
`notices.tv.*` and in a board's display JSON, as every TVOPT-295 choice).

| owner answer | what the product does |
|---|---|
| Header (27.10): keep today's header as the default, the one-row header is a setting with the two options | Already so since TVOPT-295: `notices.tv.header` factory value `c` (the two-row header as before); `a` (logo and greeting together) and `b` (greeting centred) are choices in Settings > notice board > TV screen defaults and per board (display tab). Unchanged; pinned again by `test_notice_tvnotice2_297.py`. |
| "Updated" line wording (27.10): both wordings selectable, default = the approved preview wording | New value `place` of `display.updated` / `notices.tv.updated`: "עודכן · <the board's place> <time>" (the board name stands in when the board has no place). It is the new factory default. The previous wording is kept as `full` ("עודכן <time> · <board name>"); an installation or a board that stored `full` keeps it. Labels: "מקום ושעה" / "שעה ושם הלוח". |
| Idle board (27.10): clock and SmplWise as today by default, a setting to also show the developer logo | New choice `idle_logo`: `sw` (default, nothing changes) / `both`: when the board has no notice to show, the developer (company) logo is drawn above the "no notices" message. An explicit choice, so it shows even where the header's company-logo block is off; no company logo uploaded = nothing added. Label "כשאין הודעות": "שעון ולוגו SmplWise" / "גם לוגו היזם". |

Interpretation to confirm with the owner: "idle" is read as the board with no notice to show (the `.empty` state). The screen savers
(OLED care) are unchanged: a static logo there would defeat their purpose.

Upgrade effect: an installation that never saved its own "updated" default switches from "עודכן 09:12 · <board name>" to
"עודכן · <place> 09:12" after the upgrade (the owner's chosen default). The v4 mock-up pixel check pins `updated: 'full'` (its footer
uses the older wording).

Files: `services/notices/model.py` (UPDATED_LINES, IDLE_LOGOS, TV_FACTORY), `routers/notices.py` (TvDefaultsIn.idle_logo),
`notice-tv/tv-logic.ts` (types, readers, `updatedLineParts`), `notice-tv/main.ts` (the line, the idle logo, `data-idle-logo`),
`notice-tv/tv.css` (the idle logo box), `notices/display-layout.ts` + `i18n/notices.ts` (the two segmented choices).

Tests: backend `test_notice_tvnotice2_297.py` (new), `test_notice_tvopt_295.py` (factory values); unit `unit-tvnotice2-297.spec.ts` (new),
`unit-tvopt-295.spec.ts`; Playwright (runner) `notice-tv-tvnotice2-297.spec.ts` (new), `evidence-notices.spec.ts` (button counts),
`pixel-notice-tv-mock.spec.ts` (pins `full`).
