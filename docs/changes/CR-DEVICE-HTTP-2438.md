# CR-DEVICE-HTTP-2438 - the shared device-HTTP code leaves the Hikvision module

Branch `pilot/CR-DEVICE-HTTP-2438` (from `origin/main` @ 0a8fb55e1, v2.43.5). MASTER_PLAN wave 2 entry `CR-DEVICE-HTTP-2436`.
No version bump, no merge, no tag. Code and tests only: no recorder, camera, go2rtc or lab host was contacted (fake transports only).

Base: `origin/main`, not `origin/pilot/CR-WAVE1B-COMBINED-2436`: wave 1 (B) touches none of `services/nvr.py`, `services/nvr_write.py`
or the new file (its only nearby file is `services/go2rtc.py`, which this branch does not edit: go2rtc keeps importing
`_ssl_context` through `nvr`).

Overlap with the two open branches that edit NVR write code (checked with `git merge-tree`, both merge cleanly with this branch):
- `pilot/CR-NVR-GUARD-2438` (plan: DEVICE-HTTP comes after it): it inserts `from . import nvr_write_guard` just above
  `from .nvr import _client, _get` and edits `apply_change` / `rollback`. This branch leaves that import line and those functions
  untouched and adds its own import on the line after.
- `pilot/BACKEND-SAFETY-2435`: it edits `apply_change` / `rollback` (the read-back after a PUT) and adds a constant above
  `list_changes`. Untouched here.

## Why

Code review 2026-11-13, report 03 finding F15: the device-HTTP code that go2rtc, Frigate and Provision-ISR share (`_ssl_context`,
the whole-operation deadline, `bounded_timeout`, `read_capped`) lived inside the 1,350-line Hikvision module; the block "catch
`httpx.HTTPError`, raise 503 `source_unavailable` with the same Hebrew sentence" was written out at every ISAPI call; and an ISAPI
`ResponseStatus` body was read by two separate parsers (`nvr._response_status`, `nvr_write.response_status`).

## What

- New `services/device_http.py`:
  - moved verbatim: `_ssl_context` (built once), `_DEADLINE`, `deadline`, `time_left`, `past_deadline`, `deadline_error`,
    `check_deadline`, `bounded_timeout`, `read_capped` (same context-variable name, same messages);
  - `unavailable(exc, **where)` - the shared 503 `source_unavailable` answer, details = `where` in the caller's order, then `error`
    (the exception's class name);
  - `request(client, method, path, *, where=None, **kwargs)` - calls the client's own verb method (`client.get`, `client.put`, ...,
    so test doubles keep working) and maps an `httpx.HTTPError` to `unavailable` (default `where`: `{"path": path}`);
  - `read_response_status(text)` -> `ResponseStatus`: the one reader of a ResponseStatus body, with both former readings kept
    exactly: `code` / `sub` (first match anywhere in the text, also in a body that is not well-formed - the write path's reading)
    and `document()` (`{"status", "sub"}` stripped, only for a well-formed document whose root is ResponseStatus, else `{}` - the
    capability reader's). The document view is parsed only when asked for.
- `services/nvr.py` re-exports every moved name (`from .device_http import ...`), so go2rtc, Frigate, Provision-ISR, the batch
  runners and the tests change nothing. Its eight ISAPI calls that mapped the transport failure by hand now use `request` (`_get`,
  snapshot, recording search, daily distribution, the detection zones - which keep reporting the path TEMPLATE, as before - and the
  three capability reads) and the capped read uses `unavailable`. `_response_status` is the document view of the shared reader.
  Unused imports removed (`contextvars`, `time`, `Iterator`, `contextmanager`).
- `services/nvr_write.py`: `response_status` is the `(code, sub)` view of the shared reader; `_probe` (with its one stale-nonce
  retry) and `_put` use `request`.
- Not in this branch (left for the plan's later items): the same sentence at `camera_reboot.py` (2), `nvr_privacy.py` (1),
  `recorders/hikvision.py` (1), `recorders/provision_isr.py` (1) - `camera_reboot` and `nvr_privacy` are held by CR-NVR-GUARD - and
  the download's own message in `nvr.download_file`; switching callers from `nvr.<name>` to `device_http.<name>`; connection reuse
  toward devices (finding F16, needs a lab measurement and a pinned-TLS check).

## Tests (run on the workstation, `-p no:xdist`)

- New `tests/test_device_http_pins_2438.py` (20 tests): every adopted call site's error on a transport failure (status, code,
  Hebrew message, retryable, details with their key ORDER, compared as JSON), the capped read's deadline error, the stale-nonce
  retry, `_put`'s four answer codes, both ResponseStatus readings over nine bodies (namespaced, partial, wrong root, HTML, empty,
  not XML, non-numeric code), the shared TLS context. **Written first and run green against the old code (20 passed)**, then green
  again after the move.
- New `tests/test_device_http_2438.py` (17 tests): the old names are the shared objects (one deadline for every adapter), nvr.py
  no longer defines them, the sentence is written once, `request`'s mapping for every `where` shape, its pass-through of arguments
  and answers, a verb-only test double, a non-transport error is not mapped, one reader with two views, both former parsers are
  views of it. **Fails before** (run with the services reverted: `ImportError: cannot import name 'device_http'`), passes after.
- Focused run after the move: see the commit message (`test_nvr_write.py`, `test_provision_*.py`, `test_frigate_*.py`,
  `test_nvr_parse.py`, `test_nvr_connection.py`, `test_camera_reboot_2407.py`, `test_nvr_privacy_mask.py` and the two new files).

## NOT_RUN

- The full backend suite and the pixel gate: left to the runner entry check (the workstation runs focused tests only).
- No lab check: nothing here changes what is sent to a device.
- No UI change, so no baselines to refresh.
