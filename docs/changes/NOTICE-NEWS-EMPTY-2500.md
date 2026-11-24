# NOTICE-NEWS-EMPTY-2500 - no silent empty news on a notice board

Branch `pilot/NOTICE-NEWS-EMPTY-2500`, cut from `origin/release/2490-train` (f73c20728). Target: after 2.49.0.

## Why

The owner reported that the news disappeared from the notice board TV. The lead's read-only look at the lab: the board
"כניסה ראשית" has `display.blocks.news = true` but `display.news.feeds = []`, so `services/notices/display.py` (build_feed) builds no
`news` block and the TV silently shows nothing. The audit had two `notices.board.update` display saves (23.11 17:59Z,
`custom_feeds_added: 0`) that did not say which sources were removed, and the board editor removed a source with one "הסרה" click,
with no confirmation and no warning when the list became empty.

## What changed

Backend
- `services/notices/model.news_unset(display)`: the news block is on and the board chose no source.
- `routers/notices._board_out`: every board answer for `notices.boards` (list, detail, create, PATCH, rotate / issue-link) carries
  `news_unset`.
- `services/notices/display.preview_feed`: the Settings preview (`GET` and `POST /notices/boards/{id}/preview`) carries `news_unset`
  (for a POST with a draft, the draft's value). The TV's own feed (`/notices/display/{slug}`) is unchanged - no new key, same version hash.
- `PATCH /notices/boards/{id}` with `display`: the `notices.board.update` audit details gain `news_feeds_before`, `news_feeds_after`
  (counts) and `news_feeds_removed` (the removed sources by the source list's id; a feed stored without an id is named by the list
  entry of its URL; a raw URL the list does not know is recorded as `"custom"`; never a URL), and `news_unset: true` when the saved
  board is in that state. A name-only or enabled-only PATCH records no news details (as before).
- Wire models: `NoticeBoard.news_unset: bool`, `NoticeBoardFeed.news_unset: bool = False`; `frontend/src/api/generated/wire-notices.ts`
  regenerated with `scripts/gen_wire_types.py`. `scripts/api_inventory.py` was run: `contracts/API_INVENTORY.md` is unchanged (no
  route was added or renamed; the inventory lists routes, not shapes).

Frontend (`screens/system-notices.ts`, the module's own look: the existing `.alert` warning line, `.chip[data-tone=warn]` of the shared
table, `.badge[data-look=warn]` of the module)
- Display tab, news block: while news is on and no source is chosen, a warning line under the news switch -
  "החדשות מופעלות אבל לא נבחר מקור - לא יוצגו חדשות במסך" / "News is on but no source is chosen - the screen will show no news" -
  with "הוספת כל המקורות" / "Add all sources": the enabled sources of the installation's list, in the list's order, the ones the board
  does not have yet, at most 6 (the board's limit, as the single "הוספה"). A board-stored raw URL the list has not adopted (`custom`)
  is not added (it is not a list source, and the server refuses it while custom feeds are off). The button is hidden when the list
  has no enabled source. The warning follows the draft live (switching news off clears it).
- Removing the board's LAST source while news is on opens a short confirmation ("להסיר את המקור האחרון?" / "בלי מקור לא יוצגו חדשות
  במסך, גם כשהחדשות מופעלות."); cancel keeps the source. With news off, or with more than one source, "הסרה" acts at once as before.
- A warning chip "חדשות ללא מקור" / "News without a source" for such a board: in the boards table (state column, the shared warn
  tone), on the phone card, and on the board page's line under its name. It reads the server's `news_unset`; an older server's answer
  is read from the display itself.
- Texts in Hebrew (`i18n/notices.ts`) and English (`i18n/lang/en/i18n/notices.ts`).

## Tests

- `smplwise_vms/backend/tests/test_notice_news_empty_2500.py`: the model flag; `news_unset` on the board detail / list / PATCH answer
  and on both previews (a draft source clears it); the TV feed never carries it; the audit counts and removed ids over a sequence of
  saves (including a feed stored without an id and the last-source removal), and no URL in any audit row; a custom feed recorded as
  `"custom"`; a name-only PATCH records no news details.
- `frontend/tests/evidence-notice-news-empty-2500.spec.ts` (mocked, desktop + mobile): the chip in the table / phone card (and not on a
  board with a source); the warning, "הוספת כל המקורות" (3 of 5 list entries: one disabled and one custom left out) and the saved PATCH
  body; news off clears the warning; the last-source confirmation (cancel keeps, confirm removes, the warning and the board-line chip
  appear after the save); no question with news off or with two sources; screenshots for the compare page (`shots light|dark`,
  `SHOT_LABEL=before|after`).

Results:

- PC: `tests/test_notice_news_empty_2500.py` - **6 passed** (single file, `SW_WIRE_STRICT=1`). `ruff check` on the changed Python
  files - passed. `scripts/gen_wire_types.py` and `scripts/api_inventory.py` run on the runner (the generated diff is committed;
  the inventory had no change).
- Runner: **NOT_RUN**. The one combined job (backend shard of the notices / wire / board tests + `gen_wire_types.py --check` + ruff;
  tsc, eslint on the changed files, vite build; the new spec desktop + mobile; the related specs `evidence-notices`,
  `evidence-board-mgmt-2381`, `evidence-board-answers-2400`, `unit-noticerss-295` desktop + mobile; the before / after shots on a
  base build) was queued on slot B at 09:01 UTC and never started: about 19 jobs were ahead of it, and its waiting process was gone
  at 11:34 UTC (not stopped by this task; the server did not reboot). Script (self-contained, creates its own worktrees):
  `~/work/newsempty_job.sh` on the runner, copy in `private/planning/newsempty_job_2026-11-24.sh`. Run:
  `nohup ~/work/slotb.sh bash ~/work/newsempty_job.sh > ~/work/newsempty_job.log 2>&1 &`; results in `~/work/newsempty-results/`.
- tsc, eslint, the Playwright spec and the related specs: NOT_RUN (above).

## Compare page

NOT_RUN: it needs the job's screenshots. Generator: `private/planning/newsempty_compare_2026-11-24.py <shots dir> <out.html>`
(the job copies `before/` and `after/` into `~/work/newsempty-results/shots/`); target
`private/planning/news_empty_compare_2026-11-24.html` - before (release/2490-train) and after, desktop + phone, light + dark.

## Open points

- `news_unset` means "no source stored". A board whose every chosen source was later disabled in the installation list also shows no
  news; that case is not flagged here (the list editor shows the disabled sources). Recommendation: a follow-up only if the owner
  wants it.
- The lab board itself still has no source; fixing it is an owner action in the board editor (one click on "הוספת כל המקורות" after
  this ships, then save). No lab access in this task.
