# CR-BE-SMALL-UNIFY-2440 - small backend unifications (adoption of the wave-2 helpers)

Branch `pilot/CR-BE-SMALL-UNIFY-2440`, based on `origin/pilot/CR-WAVE2-COMBINED-2439` (`4e52e5e4a`). Code review 2026-11-13,
MASTER_PLAN section 3.4 row `CR-BE-SMALL-UNIFY-2436`: report 04 F16 (adoption), F19, F21, F22, F24 (adoption), F25 (adoption),
F27 (rest). Behaviour is identical; no envelope key changes.

## What changed

| Finding | Change |
|---|---|
| 04:F16 (adoption) | Seven validation errors subclass `errors.ServiceInvalid`: `calendar/model.Invalid`, `emergency/model.Invalid`, `maintenance/model.Invalid`, `notices/model.Invalid`, `transit/model.Invalid`, `insights_common.Invalid`, `generator_log.Invalid`. Each keeps its constructor, the attributes it always had, `str()` and `args` (they call `ValueError.__init__` with the same text as before) and stays a `ValueError`. They also fill the base's `fields` (and `message` where the class has one) so `to_api_error()` works; nothing calls it yet. The routers still build each 422 envelope themselves (programme 3.6, lead decision L2). |
| 04:F24 (adoption) | `notices/push._clip` and `notify_policy._clip` are `values.clip`. `setting(conn, key)` of `offline_field`, `quiet_windows` and `readiness` returns `values.checked_setting(conn, SETTINGS, key)` (the module registry is still read at call time). |
| 04:F25 (adoption) | `notices/slides.update` writes through `db.update(conn, "notice_slides", cols, "id = ?", (slide_id,))`: the same statement, with the keys checked as identifiers. |
| 04:F27 (rest) | `lease_events`: the one silent broad handler (the degraded event's read of the last sequence) logs at debug with the traceback. `connection_probe`: its ten silent broad handlers call the new `_trace(what, exc)`, a debug line with the exception TYPE only. Deliberately no text and no traceback there: a device or resolver error can carry the address, or a URL with credentials, that the operator typed. The module gains the logger `smplwise.connection_probe`. |

Already done at this base (wave 2, `CR-DEAD-CODE-BE-2438`), so nothing to do here: 04:F19 (`transit_realtime/stride.urllib_transport`
is gone), 04:F21 (the `if False` arm in `emergency/service.py`), 04:F22 (the second `presence.ssid_hash`).

## Left as they are, and why

- `partner/reads.Invalid` is **not** moved onto the base: it never was a `ValueError`, and the partner code has several
  `except ValueError` blocks around the reads; joining a `ValueError` base would let them catch it. Pinned by a test.
- 04:F25 in `maintenance/service.py` (two sites) and `emergency/service.py` (one): their `SET` lists contain SQL expressions
  (`revision = revision + 1`, `updated_at = ?` after the keys, a reset fragment), which `db.update` cannot express. They stay; a
  `db.update` that accepts raw expressions belongs to the owner of `db.py` (`CR-SCHEMA-PROBES` in this wave, or 3B).
- 04:F27: broad handlers that are not silent were not touched - `lease_events` 389 / 473 write an audit row, 300 is the
  `queue.Empty` loop exit; `maintenance/service.py` 600, `partner/reads.py` 256 and `readiness.py` 141 / 259 return a documented
  default (they are outside F27's list of files).
- One new attribute on four classes: `notices`, `transit`, `insights_common` and `generator_log` `Invalid` had no `code`; they now
  inherit the base's `code = "validation"` (the code their routers already answer). The product has generic readers of an
  exception's `code` (`getattr(exc, "code", ...)`, 27 sites: intercom media, capture lease, WisKey writes, tickets channel and
  attachments, billing PDF, scenarios, announcements, off-box backup, schedules, camera sources); they belong to other domains
  and the three general ones (scenarios, announcements, off-box runtime) import none of these four modules, so none of them
  can meet these errors. Not traced call by call; named here so a reviewer can object.

## Resolved file list

Edited: `services/calendar/model.py`, `emergency/model.py`, `maintenance/model.py`, `notices/model.py`, `notices/slides.py`,
`notices/push.py`, `transit/model.py`, `insights_common.py`, `generator_log.py`, `notify_policy.py`, `offline_field.py`,
`quiet_windows.py`, `readiness.py`, `lease_events.py`, `connection_probe.py`. New: `tests/test_be_small_unify_2440.py`.

Row files with nothing to change: `emergency/service.py`, `maintenance/service.py`, `partner/reads.py`,
`transit_realtime/stride.py`, `presence.py` (see above).

Skipped - owned by another 3A branch, left for 3B: `services/push.py` (`_clip`, the third identical copy; `CR-SENDER-WORKER`),
`services/notify_email.py` / `notify_whatsapp.py` (04:F27; `CR-SENDER-WORKER`).

Outside my rows: nothing.

## Tests (workstation, Windows, Python 3.12 venv, `-p no:xdist`)

TESTS_PLACEHOLDER

`ruff check` (rule set F) on the row's 20 files: the same single pre-existing finding before and after
(`readiness.py`: unused `parse_utc`).

NOT_RUN locally: the full backend suite - left to the combined branch's entry check. No router changed.
