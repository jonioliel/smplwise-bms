# FE-LEAK-TEXTKEY-2435 - home playback leak, logic keyed on display text

Branch `pilot/FE-LEAK-TEXTKEY-2435`, cut from `origin/main` v2.43.4 (`665ec8f24`). Source: code review 2026-11-13,
`08-frontend-features.md`, P1 findings F01 and F03. Frontend only; no API, backend or visual change.

## 1. Home: what the element holds is given back when it leaves the page (F01)

`sw-home.disconnectedCallback` removed only the resize listener, the wall clock and the HA subscription. A recording
playing in the home recordings screen kept its server playback session open (never closed) and its 1 s clock interval
running on a detached element; a pending overview refresh still fired a network read after removal.

- `home/sw-home.ts`: on disconnect the active v3 screen's `leave()` is called (recordings: `stop()` closes the playback
  session and clears the 1 s clock), the P3 refreshes are stopped, and `refreshT`, `toastT`, `armT`, `holdT` are cleared.
  A pending favourites save (400 ms debounce) is sent at once instead of being dropped (`flushFavs`).
- `home/home-p3.ts`: new `dispose()` clears the 12 s media / systems poll and the pending media refresh (a reconnect
  runs `load()` again, which restarts the poll).
- `home/home-recordings.ts`: a generation counter bumped by `stop()`. A play or seek that was in flight when the screen
  left closes the session it received and does not start the clock; the deferred "play at this moment" of a diary deep
  link does not start after the screen left.

- `home/sw-home.ts` `load()` and `home/home-p3.ts` `load()`: when the element left the page while the first reads ran,
  they start nothing afterwards (no v3 screen enter, no 12 s poll). The new spec caught the 12 s poll started this way.
- `home/home-p2-ui.ts` `warmFamily`: found by the new spec. When `GET /home/family` failed, the redraw after the failure
  rendered again and every render asked again - a request loop (about 30 requests a second in the spec) for as long as
  the read failed, which went on after the home left the page. A failed read is now retried after 30 s (or when forced),
  and a detached host is not redrawn. A successful read behaves as before (refresh after 3 minutes).

Behaviour while the home is on screen: unchanged, except that a failing family read is no longer repeated on every
redraw.

## 2. Logic no longer decided by the wording of a display text (F03)

| Place | Before | After |
|---|---|---|
| `electricity/elec-settings.ts` (prices, business) and `elec-settings-calendar.ts` | 403 recognised by `/הרשאה/` in the error text | `elecForbidden(e)`: `ApiError` with status 403 or code `forbidden` |
| `electricity/elec-wizard.ts` | new-customer error placed under the number field when the text matched `/מספר/` | `elecCustomerNumberError(e)`: code `customer_number_*`, or `customer_number` in `details.fields` (the backend sends a list of field names; the demo store an object) |
| `xsection/xs-data.ts` | a shaft is a lift when the label matched `/מעלית/` | `FloorLink` now carries the connector's stored `kind`; `kind === 'elevator'` |
| `map/sw-plan-canvas.ts` | upper outline when `other_label === 'מפלס עליון'` | `otherOutlineIsUpper(e)` in `map/shared-space.ts`: the server's own rule (`services/shared_spaces`: "מפלס תחתון" exactly when the datum is negative), read from `datum_m` |
| `tickets/list-card-model.ts` | "no handler" left out of the footer when the sentence matched `/שיוך\|assign/i` | `sentenceAwaitsHandler(status)` in `tickets/status-sentence.ts`: `new` or `returned`, the statuses whose sentence says it waits for a handler |

For today's Hebrew data the result is identical. Differences only where the old check was wrong: an English or reworded
message, a 409 whose text mentions permission, a phone-number error, a stairs label that contains the word "lift", a
handler's name that contains "שיוך", and the English card sentence ("waiting for a handler", which never matched
`assign`, so the footer repeated "no handler").

The review suggested a typed `other_role` field from the server for the plan canvas; the existing `datum_m` field
already determines it exactly, so no API change was made.

## 3. Tests

New:
- `frontend/tests/unit-textkey-2435.spec.ts` (Node, 12 tests): every case above with Hebrew as today and with
  English / reworded texts.
- `frontend/tests/home-leave-2435.spec.ts` (page, mocked API, 2 tests x 3 projects): opens the home recordings, starts
  playback, leaves the home interface for the full one, asserts exactly one `DELETE playback/sessions/pb1`, no interval of
  the home chunk left alive, and no playback / home / media / recordings request in the 3.5 s after leaving; and the
  same leave with nothing playing sends no playback request.

Run results: see the commit message and the segment report (only runs that were actually executed are reported).

## 4. Rollback

Revert the branch merge commit. No data, API or configuration change.
