# NOTICEPOLISH-295 - notice board settings polish (slice E, for 2.17.1)

Base: pilot/NOTICEADD-295 (65da82d90). No migration. All behind notices.enabled / notice_boards.

## Built
- S4: the defaults card no longer uploads a logo; it links to Settings > General > System look (`#/system/diagnostics?tab=general`).
  The backend route `PUT/DELETE /notices/settings/logo` and the TV fallback to it are untouched, so old data keeps working.
- S5: history retention is a select (year = 365, half a year = 180). An older stored value (for example 90) is shown as its own
  option and is never rewritten by opening the page.
- S6: boards table actions: "הפעלה" for a disabled board (PATCH enabled=true), "העתקת קישור" (administrators only), "פתיחה".
- S7: board header: "פתיחת מסך הטלוויזיה", "העתקת קישור" (administrators only), "קישור חדש", on/off toggle.
- S12 (part): the board's place is a select of the installation's floors ("floor - building") plus "אחר..." for free text; it is
  stored in the same `display.place` text field. Falls back to the plain text field when the floor list is not available
  (it loads for notices.manage holders only).

## Copy link: decision and trade-off
The TV token is stored only as a SHA-256 (`notice_boards.token_hash`, migration 0165); the plain token is shown once. It cannot be
retrieved. Storing it reversibly needs a new column/secret store (a migration) and weakens the hash-only design, so it was NOT done.
"Copy link" is therefore implemented as: confirmation -> issue a new link (rotate-token) -> copy and show it (with QR).
Trade-off: the previous link stops working at once, so a TV already paired must be re-opened with the new link. The button is shown
only when the user holds system.configure AND notices.boards. "קישור חדש" (notices.boards) now also asks for the same confirmation.
Note: a notices.boards holder without system.configure can still issue a new link, as before.

## "פתיחת מסך הטלוויזיה"
Opens the signed-in preview (`notice-tv.html?preview=<id>`), the same renderer as the TV, without the token. The real TV link cannot
be opened (see above).

## NOT built
- Screens count ("2 מסכים"): the server records only `last_seen_at` per board; counting distinct screens needs new tracking storage (migration).

## Shared-file edits (minimal)
- `frontend/src/notices/model.ts`: appended `RETENTION_*`, `retentionOptions`, `placePresets`.
- `frontend/src/i18n/notices.ts`: new keys; `dRetention` label changed (no "(ימים)").
- `frontend/tests/evidence-notices.spec.ts`: four tests appended.
- `system-notices.ts`: only overview/defaultsCard/boardsTable/boardPage/generalTab, rotate flow; displayTab untouched.

## Expected pixel/screenshot changes (not refreshed)
Evidence shots `settings-*` and board general tab (defaults card: logo row, retention select; boards table actions; board header buttons; place select).
