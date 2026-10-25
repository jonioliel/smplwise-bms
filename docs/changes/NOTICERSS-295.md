# NOTICERSS-295 - editable news (RSS) sources of the notice boards

Owner request 25.10: the RSS sources were a fixed generic list; a hand-added ynet feed showed its address on the TV ticker.

## What changed
* One installation-level list of sources `{id, name, url, enabled, logo?}` (max 12; name 1-40 characters, required on EVERY source; https only,
  the fetcher's own URL rules, no repeated address). Stored in the settings table: `notices.news_sources` (JSON) and one
  `notices.news_logo.<id>` row (base64) per logo. **No migration.** The row is absent until the first save: a read returns the curated
  list (`model.CURATED_NEWS`), so an installation that never edits anything behaves as before.
* Logos reuse the bill-logo pipeline (`sanitize_image`): PNG / JPEG by magic bytes, 300 KB upload cap, 256 px, EXIF and ancillary chunks
  dropped; SVG and anything else is refused. Served only through the signed-in route and the board-token route of the TV.
* A board still stores `{name, url}` (plus the source `id` when picked from the list). At feed time the list wins (current name, URL, logo; a
  disabled source is skipped). A raw URL a board stored earlier is shown in the list as a `custom` entry under the name the board stored; saving
  the list adopts it. Its URL is never dropped. `notices.news_custom` keeps its meaning for raw URLs that are not in the list.
* The TV feed's `news[]` items carry `source` (the name) and, when the source has a logo, `logo` (a board-token URL; the TV loads it as a blob).
  The ticker shows the logo on a light chip plus the name (cut with an ellipsis at 16ch, `dir="auto"`), never the address.
* Settings UI: a list editor under the defaults card of הגדרות › לוח הודעות (add, rename, address, on/off, logo upload/replace/remove, reorder,
  delete); the list scrolls inside its box.

## Routes (new)
* `GET  /api/v1/notices/news-sources` (system.configure or notices.boards)
* `PUT  /api/v1/notices/news-sources` (system.configure) - the whole list
* `PUT  /api/v1/notices/news-sources/{id}/logo` (system.configure) - multipart `file`
* `DELETE /api/v1/notices/news-sources/{id}/logo` (system.configure)
* `GET  /api/v1/notices/news-sources/{id}/logo` (a signed-in reader)
* `GET  /api/v1/notices/display/{slug}/news-logo/{id}` (board token; also on the LAN listener)

Audit: `notices.news_sources.update`, `notices.news_logo.update`, `notices.news_logo.delete`.
