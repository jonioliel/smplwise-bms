# TVNOTICE-297 - the notice board (לוח הודעות) on the TV: gaps against the approved mock-ups, and the one-row header

Board rows r393 (the TV screen: one header row - the installation owner's logo, "ברוכים הבאים" with the place name, the SmplWise logo
and the update time - with no wasted margins) and r323 (notice board: gap analysis against the approved mock-up, then build slices).
Branch `pilot/TVNOTICE-297`, cut from `v2.23.2` (`1b0ddd85c`). No migration, no backend change, no bubble-skin change.

## 1. What the code is compared with

| reference | where | status |
|---|---|---|
| TV v4 round 4 (layout, templates 1-3, modes, takeover, ticker, chips) | `docs/design/mockups/notice-106/tv.html` | approved (owner, 23.10 round 4, recorded in CR-NOTICE106) |
| settings / notices page v4 | `docs/design/mockups/notice-106/index.html` | approved as the editing screens (#53, #70) |
| logos v3.1 (company logo + SmplWise, plate / invert on dark) | `docs/design/mockups/logos-295/index.html` | approved (CR-LOGOS295) |
| one-row header preview (r393, from the owner's screenshot; proposal a = logo and greeting together at the start, b = greeting centred) | private review page `tv_layout_preview` (25.10, not in the repository) | the owner's four answers became settings (TVOPT-295): `display.header` a / b / c, `updated`, `space`, `night_logo`; installation defaults `notices.tv.*` |
| the 2.16.0 gap analysis (rows T1-T11, S1-S13, N1-N5, V1) | private planning note of 24.10 | baseline for section 2 |

Code read: `frontend/src/notice-tv/main.ts`, `tv-logic.ts`, `tv.css`, `frontend/notice-tv.html`, `smplwise_vms/backend/smplwise/services/notices/model.py`
(`TV_FACTORY`, `effective_display`), `display.py` (`build_feed`), the change notes NOTICEADD / NOTICEGB / NOTICEPOLISH / NOTICEPAGE / NOTICEPUSH /
NOTICESAVER / NOTICESLIDES / NOTICERSS / NOTICEREMOVE-295 and the TVOPT-295 assembly notes.

## 2. Status of the 24.10 gap rows at v2.23.2

| row | element | status at 2.23.2 |
|---|---|---|
| T1, T2, S11 | screen saver, drift, saver selector | built (NOTICESAVER-295, `display.saver`; selector `notices/display-saver.ts`) |
| T3 | clock at the right edge | built (`:root[lang="he"] .clock .t { text-align: right }`) |
| T4 | "ברוכים הבאים" + the place name (project name, not the first building row) | built (NOTICEADD-295) |
| T5, S8 | building-status chips | built (NOTICEGB-295 slice B, `notices/display-info.ts`) |
| T6, T7, S9, S10 | promo slides, building photo | built (NOTICESLIDES-295) |
| T8 | SmplWise in the template-2 header only | deliberate deviation (CR-NOTICE106 section 15) - unchanged |
| T10 | custom RSS SSRF guard, listener caps | built (NOTICEGB-295 slice G, NOTICECAPS-295) |
| T11 | a real TV (Tizen / webOS browser, overscan, remote keys) | **open** - never run on a TV |
| V1 / Q2 | the developer logo on the TV and where the two logos sit | built as settings: `display.logos` a / b / c and the one-row header (TVOPT-295) |
| S1-S7, S12 | navigation, compose, defaults, board actions, place select | built (NOTICEADD-295, NOTICEPOLISH-295; S12 the floors select, no screens count) |
| N1-N5, S3 | places tree, read receipts, home widget, push | built (NOTICEPAGE-295, NOTICEPUSH-295) |

## 3. The header (r393): gaps found in this task

The one-row header itself exists since TVOPT-295 (`display.header` a / b). This task measured it with worst-case data at 1920x1080,
1280x720, 1080x1920 and 720x1280 (a 76-character place name, one 84-letter unbreakable word, a 58-letter Latin name, a 52-character board
name, a 16:1 banner logo, a 1:4 crest logo, logo size xl).

| # | gap | severity | result |
|---|---|---|---|
| H1 | **A long place name pushed the header off the canvas.** The page grid (`.pg`) had one implicit `auto` column; the nowrap name grew it to its full width, so the greeting, SmplWise and the status ran off the left edge (header box from x=-1797 to 1832 on a 1920 canvas), and in b the name was drawn over both logos. Seen in every size, landscape and portrait. | B (breaks the screen) | **fixed** |
| H2 | A long board name in the "updated" line (`full`) took up to ~600 px of the row and squeezed the place name to a few letters. | V | **fixed** - the line is one box capped at 340 px (280 portrait) ending in an ellipsis; the place name has the priority |
| H3 | Portrait, header a: the caption and the name side by side left ~50 px for the name next to two logos. | V | **fixed** - the caption stands over the name (as header b already did in portrait) |
| H4 | No place name: an empty `<b>` box beside the greeting. | P | **fixed** - the greeting stands alone |
| H5 | The one-row header is not the default. The factory value of `notices.tv.header` is `c` (the two-row screen "as before", kept on purpose for backwards compatibility and asserted by `test_notice_tvopt_295.py`). An installation sees the r393 header only after an administrator picks a or b (installation default or per board). | V | **open - owner decision** (follow-up slice 1) |
| H6 | The status text differs from the r393 preview: the preview reads "עודכן · כניסה ראשית 09:46" (the board's place), the product reads "עודכן 09:12 · <board name>". | P | open (follow-up slice 2) |
| H7 | A tall crest logo is drawn at the row's height, so it is narrow (about 27 px wide at size xl for a 1:4 crest). It is visible and correct, only small. | P | open (follow-up slice 3) |

Checked and already right: RTL order (company logo at the right end, SmplWise at the left end) in a and b, landscape and portrait; both
logos drawn in every case; the urgent takeover keeps both logos and stays inside the canvas with the same worst-case names; the header
as before (c) with the long name stays inside the canvas (the name ends in an ellipsis inside the 700 px side column); nothing scrolls (the TV page is a
fixed canvas zoomed to the screen, so 1280x720 is the 1920x1080 layout scaled).

## 4. What changed

- `frontend/src/notice-tv/tv.css` (TVNOTICE-297 block after the TVOPT-295 header rules, scoped to the one-row header so the header as
  before and the pixel check against the v4 mock-up are untouched): `.pg` gets `grid-template-columns: minmax(0, 1fr)` under
  `data-header` a / b; `.hd.one` and `.hst` may shrink; the "updated" line is capped with an ellipsis box; header b's middle column is
  `minmax(0, max-content)` with the greeting stretched and centred inside it (short names stay centred on the screen, long names give way
  instead of covering the logos); portrait a stacks the caption over the name.
- `frontend/src/notice-tv/main.ts`: `oneRowHeader` omits the name box when there is no place name; `liveHtml(u, one)` wraps the full
  "updated" line in `.lt` in the one-row header only (the footer of the header as before keeps its markup and its pixels).
- `frontend/tests/notice-tv-header-worst-297.spec.ts` (new, desktop Chromium, 27 tests): header a and b x four screen sizes x three
  worst-case data sets - one row, both logos and the greeting drawn, nothing outside the canvas or the header, no page scroll, no
  overlap between the logos, the greeting and the status, RTL ends, the body under the header, the full name kept in the element; the
  place name and the welcome words in Hebrew and English; no place name; no company logo; the urgent takeover with long names.

## 5. Follow-up slices (not built here)

1. **Header default (H5).** Make the one-row header the installation default (`TV_FACTORY["header"]` "a" or "b"), or set it per
   installation. Changes what every existing board shows after the upgrade and the backend test that pins the factory values, so it
   needs the owner's choice of a or b. Size S.
2. **Status wording (H6).** "עודכן · <place> <time>" as in the r393 preview (the board's `display.place`, falling back to the board
   name), one line in `liveHtml`; the header as before keeps its wording unless the owner wants both. Size S, owner to confirm.
3. **Logo box by area (H7).** Size the company logo by area (a crest gets more height up to the row, a banner gets a max width) instead
   of a fixed height. Touches the header as before and the pixel check too, so it goes with a mock-up refresh. Size S-M, design first.
4. **Real-TV session (T11).** On the first installed TV: overscan / safe margins, the Hebrew date when the browser lacks the Hebrew
   calendar (today the line is simply left out), CSS `zoom`, remote keys. Size S plus owner time with the TV.
5. **Template 2 SmplWise in the footer (T8).** Only if the owner wants the mock-up's second mark back. Size XS.
