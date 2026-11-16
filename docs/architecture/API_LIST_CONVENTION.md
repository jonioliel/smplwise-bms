# List routes: pagination and envelope convention

Status: convention for **new** routes (code review 2026-11-13, finding 05:P2-15; branch `pilot/CR-DOCS-REGISTERS-2440`).
**No existing route changes because of this note.** The web UI, the phone app and the bridge depend on the shapes they have.

## Why

Measured in the review at v2.43.4 over `smplwise_vms/backend/smplwise/routers/`: 58 routes take `limit` (upper bounds from
20 to 5,000), 23 take `offset`, 11 take `before` / `after` / `since`, 4 take `cursor`; the list key is `items` in 45 answers,
`results` in 12 and `rows` in 4. Each was reasonable where it was written; together a client cannot page two lists with the
same code.

## The convention

### Envelope

A list answer is an object, never a bare array:

```json
{ "items": [], "next_cursor": null }
```

- `items` is the list key. Not `results`, `rows` or the plural of the resource.
- `next_cursor` is a string when more rows may exist and `null` when the end was reached. It is always present on a
  paginated route.
- Other facts about the list sit next to these two as their own keys (`total` only where it is cheap and exact,
  `retention_days`, `coverage`, the effective `sort` and `limit`), never inside `items`.
- A list that is small and bounded by its nature (the floors of a building, the roles) needs no pagination: it answers
  `{ "items": [...] }` and takes no `limit`.

### Which pagination

| The table | Use | Why |
|---|---|---|
| Grows without bound (events, audit, activity, tickets, messages, logs) | **cursor** (keyset) | A row inserted while the user pages does not shift the pages; the query stays an index range however deep the page is. |
| Bounded and small | none | See above. |
| Bounded, and random access to page N is really needed | `offset` + `limit` | Only here. The route's docstring says why a cursor does not fit. |

`before` / `after` / `since` are **filters** (a time window), not pagination. A route may take both a window and a cursor.

### The cursor

- **Opaque to the client**: a string to send back unchanged as `?cursor=`. Clients never build or parse one.
- **Keyset**: it encodes the sort key of the last row returned plus a unique tie-breaker (the row id). The next page is
  `WHERE (key, id) < (?, ?) ORDER BY key DESC, id DESC LIMIT limit + 1`; the extra row tells whether a next page exists.
- **Bound to what it was issued for** when the page depends on a user-chosen sort or filter set: a cursor replayed with
  other filters, another sort or by another user is refused, not silently applied.
- **Bounded in length**: `cursor: str | None = Query(None, max_length=200)`.
- **A bad or expired cursor is a 422**, never a 500 and never "page 1 again". The client reloads from the top.
- A page may come back **short** (fewer than `limit` items, with a `next_cursor`) when rows are filtered after the query,
  for example by a per-row visibility rule. Clients keep loading while `next_cursor` is not null; a short page is not the
  end.

### `limit`

`limit: int = Query(50, ge=1, le=200)` unless the route has a stated reason for another bound (an export, a chart series).
The answer never holds more than `limit` items.

## Reference implementations in the code

Paths are relative to `smplwise_vms/backend/smplwise/`.

| Case | Where |
|---|---|
| Plain keyset cursor over one growing table (time + id) | `services/device_activity.py` (`_cursor`, `_decode_cursor`, `list_activity`); route in `routers/devices.py` |
| Keyset with a per-row visibility rule and short pages | `services/tickets/access.py` (`visible_page`, `SCAN_FACTOR`); route in `routers/tickets.py` |
| User-chosen sort; sealed cursor bound to the user and the filters | `services/tickets/table.py` (`encode_cursor`); route in `routers/tickets_table.py` |
| A cursor that belongs to an upstream system and can expire | `routers/access_control_reads.py` (422 `intercom_cursor_expired`) |

## Not part of this note

- A shared helper for new routes (the second half of the finding) is code and is left to a code branch. Until it exists,
  copy the shape of `device_activity`.
- Moving the existing `results` / `rows` / `offset` routes to the convention is a programme of its own: each one is a
  client contract (web UI, phone app, bridge) and changes only together with its consumers, behind an approved change.
