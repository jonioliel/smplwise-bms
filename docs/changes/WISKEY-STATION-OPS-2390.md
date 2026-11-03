# WISKEY-STATION-OPS-2390 - station maintenance from Arx (sync now, rescan, health refresh, clock check)

Branch `pilot/WISKEY-STATION-OPS-2390`, cut from `origin/main` @ `efc12d0e3` (v2.38.0). Plan: `private/planning/WISKEY_FULL_INTEGRATION_PLAN_2026-11-03.md`,
task T4 (matrix rows 3, 33, 34, 36). Everything was built and tested against fakes and mocked backends only. Nothing was sent to a real
WisKey, Home Assistant, station or installation; no lab access; nothing is switched on anywhere by this branch beyond what a
permitted operator clicks.

## 1. What an operator gets

- **The drawer's "טכני" section** (stations screen, a station the caller sees with its technical part) gains a "תחזוקה" block
  (`frontend/src/components/wk-station-maintenance.ts`, mounted with one line):
  - read-only health detail, **no confirmation**: last sync, last read from the station, event stream, clock (skew), consecutive failed
    polls, last error, and the **sign-in failure** (`authentication_failed`): source, WisKey's sync step and the time, the device's
    status code / sub-status when WisKey kept them, how many of WisKey's retained records failed so, and what fails right now (sync /
    event stream / event history);
  - four actions, each behind a confirmation dialog: **סנכרן עכשיו**, **סריקה מחדש**, **רענון בריאות**, **בדיקת שעון**. One request
    per click; the line under each button says honestly: "שולח…", "התקבל - הסנכרון בתור", "הושלם", "נכשל: <reason>", "לא נשלח:
    <reason>", "נשלח, אין תשובה ברורה - ייתכן שבוצע", or the last run from the audit rows / the cool-down left.
  - offline station: only the sync is offered (the three device reads are disabled, with a hint).
- **The list action** (stations toolbar, `frontend/src/components/wk-stations-maintenance.ts`, mounted with one line): "תחזוקה" ->
  pick the action and the stations -> confirm -> one request per station, one after the other, never repeated; a result line per
  station and a tally. Offline stations are left out of the device reads (a sync may still be queued for them).
- Shown only to who may: the block needs `access.admin.read` or `access.stations.manage` somewhere; the buttons and the toolbar action
  need `access.stations.manage`. The server judges every station again.

## 2. WisKey commands (checked in `C:\hik intercom` @ `origin/codex/wiskey-mac-m12-policy-b-2026-11-02` = `2834aa5e`, rc.10)

| Arx action | WisKey command | rc.10 source | What WisKey does | Arx result |
|---|---|---|---|---|
| `sync` | `sync/station` | `websocket.py:451, 1788` -> `access/manager.py:160 request()` | queues the station's reconciliation; `{accepted: true}` | `acknowledged` |
| `rescan` | `stations/rescan` | `websocket.py:445, 1786` -> `manager.py:210 async_rescan()` | re-reads capabilities + inventory (no reconciliation), waits | `completed` |
| `health_refresh` | `health/refresh` | `websocket.py:332`, `health_api.py:82` | clock read + media inspect (35 s cap, max 3 at once), returns the health report | `completed` |
| `clock_refresh` | `stations/clock_refresh` | `websocket.py:441, 1191`, `clock_runtime.py:69` | READS the station clock again; sets nothing | `completed` |

All four are in the pinned catalog (`rc37-contract.4`), station-scoped, non-READ (`api_contract: 1` on every frame), WisKey grants
`stations: manage` (sync/rescan/health) and `management: manage` (clock). Not used, on purpose: `sync/all` and `sync/user`
(installation / person scope), `clock/station_sync` (it WRITES the device clock), `sync/diagnostics` (support export).

**Channel**: the add-on's own live WisKey session (the service identity that carries the other station writes), under a new closed
allow-list `maintenance` in `services/wiskey_channels.py` with exactly these four commands; no other channel lets them through.

## 3. Rules kept

- **Permission**: `access.stations.manage` anywhere at the gate (before the body is read, audited 403), then on the station's chain
  (deny wins); `access.read` on the station (else the uniform 404). Built-in holder: `system_admin` only (roles.json) - an operator or
  site administrator needs a custom role carrying it (see the owner question below).
- **Confirmation**: `confirmed: true` is sent only by the dialogs; without it 409 `confirmation_required`, nothing sent.
- **Envelope**: `client_request_id` + `expires_at` (15 s) - expired or duplicate commands are refused, audited, not sent.
- **Audit**: `intercom.station_sync` / `intercom.station_rescan` / `intercom.station_health_refresh` / `intercom.station_clock_refresh`:
  refusal row (`phase: refused`, `outcome: not_sent`), or attempt row committed before sending + outcome row (`ok` / `refused` with
  WisKey's code / `unknown` / `not_sent`). Never a host, credential or person.
- **Rate limit** (`services/wiskey_station_ops.py Limits`): one command per station and action per cool-down (sync 30 s, the reads
  60 s; starts only after a command was handed to WisKey), 24 commands per operator per minute, at most 2 maintenance commands in
  flight installation-wide (WisKey allows 3 health refreshes). Plus the feed's own read buckets (see section 5).
- **Honest results**: success = what WisKey answered (`acknowledged` for a queued sync, never "synced"); a WisKey failure code ->
  502 `station_ops_failed` with `details.wiskey_code`; an unclear answer / timeout -> 504 `station_ops_outcome_unknown`; nothing
  sent -> the refusal's own status with `details.outcome = not_sent`. Never retried, queued or run by itself (no polling of writes;
  the block reads only when the drawer opens a station, on "רענון נתונים", and once after an action answered).
- **Read-only detail**: `GET /access-control/stations/{id}/maintenance`, no confirmation; the health part only with the status page's
  rule (`access.read` + `access.admin.read` on the station). One `health/get` per station per 15 s (READ channel, cached).
- **authentication_failed**: from the report's `sync_diagnostics.recent` (WisKey's step + stage time + device status code; the
  sub-status only from WisKey's own allow-list, else "other"; the person pseudonym is dropped), plus the current state of sync / event
  stream / event history. Because WisKey keeps only the last 200 stages of ALL stations, Arx keeps the newest failure it has SEEN per
  station in process memory (`SEEN`), so the owner still sees it after WisKey's ring rolled over; a restart forgets it (no table, no
  migration). A stream / history failure has no device time: it is stamped with when Arx first saw it (`observed: true`).
- UI: Hebrew, RTL, no platform name (unit spec and browser spec check it).

## 4. Files

New: `smplwise_vms/backend/smplwise/services/wiskey_station_ops.py`, `smplwise_vms/backend/smplwise/routers/access_control_station_ops.py`,
`smplwise_vms/backend/tests/test_wiskey_station_ops.py`, `frontend/src/api/station-ops.ts`, `frontend/src/i18n/wiskey-station-ops.ts`,
`frontend/src/components/wk-station-maintenance.ts`, `frontend/src/components/wk-stations-maintenance.ts`,
`frontend/tests/unit-wiskey-station-ops.spec.ts`, `frontend/tests/evidence-wiskey-station-ops.spec.ts`, `frontend/tests/wiskey-station-ops-mocks.ts`.

**Shared edits** (small, for the merge owner):
- `smplwise_vms/backend/smplwise/services/wiskey_channels.py`: `MAINTENANCE` allow-list, added to `ALLOWLISTS`, `ADAPTER_CHANNELS`,
  `HA_FRAMES`, `describe()`.
- `smplwise_vms/backend/smplwise/main.py`: one import + one `include_router` line after `access_control_writes`.
- `frontend/src/screens/wiskey-stations-views.ts`: one import line + one mount line inside `technical()` (after `</dl>`). Not the call row.
- `frontend/src/screens/wiskey-stations.ts`: one import line + one mount line in the toolbar (after the announce button).
- Tests: `tests/test_wiskey_channels.py` (the adapter channel tuple and the live-guard map gain `maintenance`),
  `tests/test_pwclean_295.py` (the pre-cleanup catalog hash is computed without the new `maintenance` key, so it still proves the cleanup).

Not touched: `wk-station-live.ts`, the call row, deep links, pairing, managed install, inbound calls, `wiskey_direct_catalog.py`,
`intercom_sync.py`, `intercom_client.py`, `intercom_adapter.py`, `fake_wiskey.py`, `wiskey-stations-mocks.ts`, roles, migrations.
`contracts/API_INVENTORY.md` is regenerated at release (`scripts/api_inventory.py`): +2 routes.

## 5. Known limits

- The `maintenance` lane has no slot / bucket of its own in `intercom_sync` (not edited here): it takes one of the 4 read slots and
  the read buckets; the module's own `MAX_INFLIGHT = 2` keeps 2 read slots for the screens. A health refresh can take up to WisKey's
  35 s; the feed waits 35 s, so a slow refresh can read "sent, no clear answer" while WisKey still finishes it.
- The sign-in memo lives in process memory; persisted history would need a table (a migration) - not done.
- Permission label of `access.stations.manage` still says "עריכת הגדרות עמדה (...)" - it now also covers maintenance; the label was
  not changed here to avoid unrelated pixel churn in the roles screen.
- Not built: `sync/all` (one click for the whole installation), `sync/user` (per person, people screen), `clock/station_sync`
  (setting the device clock), `sync/diagnostics`.
- Lab: NOT_RUN. The first real run needs the owner's lab approval (plan T4: "lab approval for the first run").

## 6. WisKey gaps / asks

- Q-WK-9 (existing): no health field with the LAST auth failure per step and its time for polling, the event stream and history -
  only `sync_diagnostics.recent` (sync stages, 200 rows shared by all stations) has a time; the stream / history only expose a state.
- Q-WK-11 (existing): confirm that `sync/station`, `stations/rescan`, `health/refresh`, `stations/clock_refresh` are permitted for
  Arx's service identity over the classic channel with `api_contract` (the add-on's identity is a HA admin today).
- `health/refresh` returns `media` evidence and full diagnostics; there is no lighter "refresh and return the card" variant.
- `sync/station` answers `{accepted}` only; there is no request id to follow that one reconciliation to its end (Arx reads the
  station's sync state afterwards instead).

## 7. Rollback

Revert the branch's commit(s). No migration, no setting, no stored state (the memo and the cache are process memory). Removing the
two mount lines hides the UI; removing the `include_router` line removes the endpoints; the channel entry is inert without a caller.

## 8. Test receipts (2026-11-03)

| What | Where | Command | Result |
|---|---|---|---|
| Backend, new | workstation, `.venv` (no browser) | `python -m pytest -o addopts= -q -p no:cacheprovider tests/test_wiskey_station_ops.py` | 25 passed |
| Backend, channel neighbours | workstation | `pytest tests/test_wiskey_channels.py tests/test_pwclean_295.py tests/test_wiskey_diagnostics.py tests/test_eccact_readback_295.py tests/test_wa_pacing_coverage_295.py tests/test_wiskey_contract.py tests/test_wkdirect_295.py tests/test_wiskey_station_ops.py` | 247 passed, 2 skipped, 1 failed (the live-guard map in test_wiskey_channels, fixed in this branch; re-run: test_wiskey_channels 32 passed, 2 skipped) |
| Unit spec (node, no page) | workstation | `npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-station-ops.spec.ts` | 7 passed |
| Typecheck | runner @ `a127b5146` | `run_smart.py tsc pilot/WISKEY-STATION-OPS-2390 --machine runner` | tsc ok |
| Browser, new + stations neighbours | runner @ `f4039b87d` | `run_smart.py spec ... tests/evidence-wiskey-station-ops.spec.ts tests/evidence-wiskey-stations.spec.ts --project=desktop --project=mobile --project=tablet` | 161 passed, 7 skipped |
| Browser, layout / pixel / media (unchanged by the mounts) | runner @ `a127b5146` | `run_smart.py spec ... tests/layout-wiskey-stations.spec.ts tests/pixel-wiskey-stations.spec.ts tests/evidence-wiskey-station-media.spec.ts` (3 projects) | no failure in these files (the same run's failures were the new spec's dialog assertion and the stations hygiene allow-list, both fixed and re-run above) |

NOT_RUN: the full backend suite, the full release gate, any lab / real WisKey check. No pixel spec was added (the existing stations
pixel baselines stay valid: the blocks take no room for a caller without the permissions).
