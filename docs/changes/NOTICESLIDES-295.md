# NOTICESLIDES-295 - notice board: promo / info slides and the building photo (slice C)

Base: `release/2180` @ 5bc8d0add (v2.17.0 + slices A, B, E). Everything stays behind `notices.enabled` (OFF) and the add-on option `notice_boards` (false).
Gap rows closed: T6, T7, S9, S10 of `private/planning/NOTICE_BOARD_GAP_VS_MOCKUP_2026-10-24.md`.

## Data (migration `0172_notice_slides.sql`, provisional number - the integrator renumbers)
* `notice_slides`: one row per slide (`kind = 'slide'`: title <= 80, text <= 300, optional `seconds` 6-120, NULL = the board's rotation interval) or per
  building photo (`kind = 'photo'`). The picture is the sanitised bytes as base64 text (`image_b64`, `image_mime`, `image_stamp`), like `brand_assets`.
* `notice_board_slides (board_id, slide_id, position)`: a slide may be shown on several boards (owner answer 281). A photo row is linked to ONE board
  and never counts as a slide.
* Self-contained and idempotent (`IF NOT EXISTS`); rollback = drop the two tables. Deleting a board drops its photo and its links; the slides stay in the library.

## Image pipeline
`bill_pdf_logo.sanitize_image(data, max_bytes, max_side)` (new, next to `sanitize_logo`, same guarantees: magic bytes decide PNG / JPEG, nothing else;
pixel ceiling; EXIF and every ancillary chunk dropped by rebuilding the pixels; always re-encoded). Slides: <= 1 MB, long side 800 px. Photo: <= 2 MB,
long side 1920 px. Output is a JPEG unless the picture has transparency (then PNG), so a 1920 px photo stays a few hundred KB on a TV's connection.
`body_limit.py` gets two rules (PUT slide image 1 MB + framing, PUT board photo 2 MB + framing); a larger body is a 413 before the route runs.

## Routes (new block at the END of `routers/notices.py`; permission `notices.boards`, module gate like the others)
| route | purpose |
|---|---|
| `GET /notices/promo-slides/all` | the whole slide library with the boards of each (a one-segment path would be taken by `/notices/{notice_id}`) |
| `POST /notices/promo-slides`, `PATCH`/`DELETE /notices/promo-slides/{id}` | create / edit / delete (limit 10 slides per board, checked before any write) |
| `PUT`/`DELETE`/`GET /notices/promo-slides/{id}/image` | the slide picture (multipart `file`) |
| `GET`/`PUT /notices/boards/{id}/slides` | a board's slides and the order |
| `PUT`/`DELETE`/`GET /notices/boards/{id}/photo` | the building photo |
| `GET /notices/display/{slug}/slide/{id}`, `GET /notices/display/{slug}/photo` | the TV's pictures, board token only, never another board's; also answered by the LAN listener; 404 on the remote channel unless `boards_remote` |

Audit actions: `notices.slide.create|update|delete|image|image_delete|order`, `notices.photo.update|delete`.

## Feed
`slides[]` `{id, title, text, seconds?, image?}` only while `blocks.promo` is on and the board has slides (no author, no board list, no counters);
`board.display.photo` only on template 2. The URLs carry the picture stamp (`?v=`), so the feed version changes when a picture changes. The Settings
preview gets the signed-in URLs (`api/v1/notices/promo-slides/<id>/image`, `api/v1/notices/boards/<id>/photo`).

## TV page
`tv-logic.ts`: `FeedSlide`, `Item.slide`, `withSlides()` (after the notices, rotation mode only, dwell in ticks of the board interval from `seconds`). `main.ts`:
`slideHtml` (the mock-up's `.it.promo`: picture box beside the text, placeholder icon without a picture), `loadMedia()` fetches pictures with the token
header into blob URLs (CSP: `img-src` has `blob:`), the photo goes to `.photo .img` through the CSSOM and `data-photo="1"`. `tv.css`: two lines for
`img` inside the picture box. `promo` stays off by default (owner decision 258).

## Settings UI
`notices/display-slides.ts` (`<notice-display-slides>`): the promo switch (a `display-change`, part of the draft), the grid (thumbnail, title, עריכה,
"שקופית חדשה", count and seconds), a dialog (title, text, seconds, picture, the boards that show it), delete with a second click, and - for template 2 - the
building photo upload / replace / remove. After each change it emits `slides-changed` and the page refreshes the preview. `screens/system-notices.ts`:
one import and one tag in `displayTab()` (it replaces the old "בשלב הבא: שקופיות ותמונת רקע" hint line, which is now untrue; the i18n key is left).
`api/notices.ts`: the slide calls. `i18n/notices.ts`: he + en keys.

## Backup classification
The notice tables are operational, not project tables (`notices.enabled` / `notices.boards.remote` are SETTINGS_KEEP for the same reason): the new tables
follow `notices`, `notice_boards`, `notice_board_items` and are in neither `PROJECT_TABLES` nor `NEVER_EXPORTED_TABLES`; a note sits in `backup.py` and
`test_notice_slides_295.py` pins it. A restore therefore leaves slides and photos of the target box alone. See open question 1.

## Shared-file edits (kept small)
`display.py` (`build_feed` hook + `DisplayService.image` + `public` flag), `listener.py` (route), `store.py` (`delete_board` calls `slides.drop_board`),
`body_limit.py`, `backup.py` (comment), `routers/notices.py` (block at the end + the new import line is in the block), `system-notices.ts` (import + tag),
`i18n/notices.ts`, `api/notices.ts`, `notice-tv/main.ts`, `tv-logic.ts`, `tv.css`, `tests/test_remote_access.py` (two BLOCKED_ON_REMOTE routes).

## Expected pixel-baseline changes
None expected: `pixel-notice-tv-mock` renders the mock-up with `promo` off and no photo, and the placeholder scene and the rotation without slides are
unchanged. The integrator rebuilds `www` once (the committed bundle is not touched here). Screenshots of the settings display tab gain a block (evidence, not a baseline).

## Open questions
1. Should slides and photos travel in a project backup? They are operational like the boards, so today they do not; if the owner wants them in an
   archive the boards must be classified first (the links hang off board ids).
2. Photo per board (as built) or one building photo for all boards on template 2?
3. Slides in "all together" and "focus" modes are not shown (the mock-up's rule); confirm.
