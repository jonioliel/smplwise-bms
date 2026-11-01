# ASYNCIO-DEFAULT-2342 - the server runs on asyncio + h11 by default; uvloop + httptools become an opt-in

Branch `fix/ASYNCIO-DEFAULT-2342`, cut from `origin/fix/PLAYBACK-SCRUB-2341` (which pins uvloop 0.22.1 / httptools 0.8.0 / websockets
15.0.1, `docs/changes/PLAYBACK-SCRUB-2341.md`). Owner-approved 02.11 (round 13, answer 5A). No version bump, no CHANGELOG edit, no
migration, no new add-on option, no dependency change (the pinned native wheels stay installed for the opt-in).

## Why

The 2.33.0 SIGSEGV (`docs/changes/SEGFAULT-PLAYBACK-2332.md`) happened while a playback relay socket was accepted as the previous one
closed; the native code on that path is uvloop / libuv and httptools. The root cause is still NOT PROVEN. uvicorn's `auto` picked uvloop
+ httptools whenever they were installed, so every install ran that native code by default and only the crash guard's safe mode (after
two crashes in six hours) took it out. Now the standard-library loop and the pure-Python parser are the default and the native pair is
something an installation asks for.

## What changed

| Piece | Change |
|---|---|
| `smplwise/__main__.py` | `server_impl(env, *, fast, installed)`: safe mode (`SW_SAFE_MODE=1`) -> `asyncio` + `h11` whatever else is asked; an explicit valid `SW_UVICORN_LOOP` / `SW_UVICORN_HTTP` is used as given; otherwise `asyncio` + `h11`, or `uvloop` / `httptools` when the opt-in is on AND that module is installed (Windows has no uvloop: that half stays `asyncio`). Was: `auto` / `auto`. |
| | `fast_network_wanted(env, stored)`: `SW_FAST_NETWORK` (1/true/on/yes or 0/false/off/no) wins over the stored setting; an unreadable env value does not hide the setting; neither -> off. |
| | `main()` reads the stored setting once, after `create_app()` (one read-only connection; any failure = the default), and logs one line on `smplwise.crashguard`: `server: event loop <x>, HTTP parser <y> - standard (fast network component off, default|setting|env)` / `- fast network component on (setting|env)` / `- safe mode after repeated native crashes (overrides the fast-network opt-in)` (warning level in safe mode). This replaces the previous safe-mode-only warning line. |
| `routers/settings.py` | New setting `server.fast_network` ("שרת: רכיב תקשורת מהיר"), `"false"` by default, `true|false` in `PATCH /api/v1/settings` (system.configure, as every product setting). Read at start-up only: a change applies after the add-on restarts. |
| `frontend/src/screens/system-diagnostics.ts`, `api/media.ts` | One select row "שרת: רכיב תקשורת מהיר" (כבוי / פעיל) in the settings block of Diagnostics, with the hint that off is the stabler choice and that the change applies after a restart of the add-on. |
| `smplwise/crashguard.py` | Docstring and the safe-mode log line only: safe mode keeps its meaning (asyncio + h11 forced over an opt-in); crash recording, backoff, the 2-in-6-h rule and the state file are unchanged. The supervisor still imports no application code: it does not read the setting; the child decides, and `SW_SAFE_MODE` wins there. |

The public tickets listener (`services/tickets/public_server.py`) already ran its own asyncio loop with an h11 protocol; untouched.

### Safe mode, now

- Without the opt-in, a safe-mode run uses the same loop / parser as a normal run. Safe mode still turns on after two native crashes in six
  hours, the Diagnostics card still shows it (warn), and every crash is still recorded and restarted. It stays meaningful as the record
  that the process crashed on the pure-Python stack too (which would point the next investigation away from uvloop / httptools).
- With the opt-in, safe mode takes the native pair out again, as before.

## Tests

- `tests/test_asyncio_default_2342.py` (new, 18): the default with the native modules installed; the opt-in with / without them installed;
  env vs setting precedence (8 cases); safe mode over the opt-in and over an explicit override; explicit overrides; the start-up line;
  the supervisor with `SW_FAST_NETWORK=1` (two SIGSEGV recorded and restarted, uvloop + httptools in the first two runs, asyncio + h11 in
  the safe-mode run); crashes recorded on the default stack still count to safe mode; the setting's default and PATCH validation;
  `main()` reads the stored setting, passes the choice to `uvicorn.run` and logs it (setting, env off, safe mode); an unreadable database
  means the default.
- `tests/test_crashguard_2332.py`: the `server_impl` assertion now expects `asyncio` / `h11` for an empty / bogus env (was `auto`), plus
  safe mode over a fast opt-in.

## Results (2026-11-02, Windows workstation, single process)

- `test_asyncio_default_2342.py` + `test_crashguard_2332.py`: 35 passed, 1 skipped (the POSIX-only real segfault restart).
- `test_playback_scrub_2341.py`, `test_playback_stress_2332.py`, plus the settings-touching suites `test_body_limit`, `test_f3c_g03_295`,
  `test_gate_hygiene`, `test_site_location`, `test_vendmark_295`, `test_self_update_s3_fixes`, `test_settings_nav_pref`: 273 passed,
  1 skipped (the uvloop variant of the stress test: no uvloop on Windows).
- Frontend: `tsc --noEmit` clean; unit specs that read the diagnostics screen / media API (9 files): 55 passed.
- Runner (Ubuntu, `run_smart.py backend`): `test_crashguard_2332`, `test_asyncio_default_2342`, `test_playback_stress_2332`,
  `test_playback_scrub_2341`: **62 passed, 0 skipped** (includes the POSIX real-segfault supervisor restart and the uvloop + httptools
  stress variant, i.e. the opt-in path still works).
- NOT_RUN: the Diagnostics pixel baselines (the new row adds one line to the settings block: `system-diagnostics` desktop / tablet /
  mobile baselines will move - refresh on the runner before a train); an add-on image build.

## Owner notes

1. After this ships, the add-on log's start-up line says `event loop asyncio, HTTP parser h11 - standard (fast network component off,
   default)`. To go back to the native pair: Diagnostics > "שרת: רכיב תקשורת מהיר" > פעיל, save, restart the add-on.
2. Expected cost of asyncio + h11: somewhat higher CPU per request / socket under heavy load; not measured on the lab device here.

## Rollback

Revert the branch commits: `server_impl` returns `auto` / `auto` again; the stored `server.fast_network` row is then unused.
