# NOTICEREMOVE-295 - "הסרה מהלוח" answered "ההודעה לא נמצאה" and removed nothing

Owner report on 2.20.x: Settings > לוח הודעות > a board > הודעות: clicking "הסרה מהלוח" shows the toast and nothing changes.

Root cause: `store.archive()` keeps the notice's `notice_board_items` link (it only touches the board). The board page lists
`board_notices()` (every linked, non-deleted notice, archived ones included, shown as rows without "עריכה"). The screen removes a row by
sending the whole remaining list to `PUT /notices/boards/{id}/items`, and `store.set_board_items()` accepted only non-archived ids, so any
archived notice still on the board made every removal (and every "add to board") fail with "הודעה לא נמצאה" - for all rows, not just the
archived ones.

Fix (backend only): `set_board_items` also accepts ids already linked to that board. A new archived or unknown id is still refused.
Existing data needs no migration or repair: the stale links are exactly what the fixed endpoint now lets the user clear.
Test: `smplwise_vms/backend/tests/test_notice_remove_295.py`.
