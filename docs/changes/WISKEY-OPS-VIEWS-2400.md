# WISKEY-OPS-VIEWS-2400 - intercom operations and fleet views (integration plan T11)

Branch `pilot/WISKEY-OPS-VIEWS-2400`, from `origin/release/2382-train` @ `9d5b2963b`. Target release 2.40.0. No merge, no tag.
Plan: `private/planning/WISKEY_FULL_INTEGRATION_PLAN_2026-11-03.md`, task T11, capability rows 79, 80, 82.

## What it is

Settings › **תפעול האינטרקום** (`#/system/intercom-operations/<tab>`), natively in Arx instead of the embedded panel's
`operations_center`, `investigations`, `health` and `audit` tools:

| Tab | What | WisKey command (rc.10) |
|---|---|---|
| סיכום | KPI row (stations, online, offline, waiting for sync, sync problems, near capacity) + stations with a users meter | `overview/summary` |
| פעולות ומשימות | operations (sync / bulk / CSV) with progress and error codes; bulk jobs with failed rows, error-rows CSV, **cancel** | `operations/query`, `jobs/list`, `jobs/errors`, `jobs/action` (cancel only) |
| חקירות | timeline of entries, changes and sync side by side ("chronology is not causation"), person fields by permission | `investigations/query` |
| קיבולת ומגמות | users / cards meters per station, WisKey's growth estimate, Arx's stored trend chart (7 / 30 / 90 / 365 days) | `platform/capacity` |
| דוח אירועים | totals, stacked day chart (granted / denied), by station, anomalies, methods - counts only | `events/report` |
| ייצוא | fleet inventory CSV, the intercom's change log CSV | `fleet/inventory_export` (`json`), `audit/export` |

Mostly read-only: the only write is the job cancel.

## Permissions

- Views: `access.read` **unrestricted at the installation** (`ia.require_anywhere` + `ia.require_unrestricted`; a site / station
  binding is an audited 403). The tab is in `INSTALLATION_ONLY_HREFS`.
- Timeline person fields: name needs `access.people.read`, employee number `access.people.sensitive` (or names level when the
  installation keeps it there), an operator's name `access.admin.read` - each unrestricted; a hidden field is null and listed in
  `fields_hidden`. A free-text search (WisKey matches it on names and employee numbers) needs the same, else an audited 403.
- Exports and cancel: `access.admin.read` unrestricted at the installation.

## Safety

- New closed channel `operations` in `services/wiskey_channels.py` (additive): the nine READ commands (no `api_contract`) and
  `jobs/action`; `frame_fields` refuses any action but `cancel`. Not `jobs/approval_*`, `bulk_create`, `csv_create`, `events/print`,
  `events/export`.
- Cancel: command envelope (`client_request_id`, `expires_at` ≤ 60 s), `confirmed: true`, the job's `revision`; attempt row committed
  before the send, outcome row after; people-write lane, sent once. Refusal codes (`job_finished`, `revision_conflict`,
  `operation_not_found`, ...) = "nothing changed"; any other failure after the send = `unknown` (504, reload before trying again).
- Exports: audited (`intercom.ops.export_inventory`, `intercom.ops.export_audit`, `intercom.ops.export_job_errors`: filters, rows,
  columns - never a row). Every CSV is written by Arx (`wiskey_ops_views.csv_bytes`): BOM, all cells quoted, a leading apostrophe
  on any text that starts - also after leading spaces - with `= + - @`, tab, CR, LF or the full-width `＝ ＋ － ＠`. WisKey's own
  `_safe_cell` (operational_readiness.py) misses tab / CR / full-width; its CSV is never forwarded.
- Projections by closed construction: no `host`, `entities`, `clock`, `station_ref`, card number, or raw device text; control
  characters stripped from names; unknown enum values shown as `unknown`.
- Capability discovery: a view whose command is not in `overview.api.commands` is not sent (501 `ops_unsupported`, shown as
  unavailable).

## Migration

`0200_wiskey_capacity_samples.sql` - the next free number after 0199 (0199 is used by pilot/WISKEY-LIVE-VALIDATION-2390 and
pilot/XSCENARIO109-295; 0205 by pilot/CAL-GRID-EDIT-2343). Table `wiskey_capacity_samples` (station, WisKey sample time, counts,
limits), written when a FRESH capacity report is read, deduplicated by sample time, kept 400 days / 1000 per station. Additive;
rollback = drop the table. Not in a backup archive (allow-list).

## Deep links (on release/2382-train's `frontend/src/wiskey/deep-links.ts`)

`operations.center`, `operations.investigations`, `events.report`, `health.fleet`, `audit.panel` now carry
`native: { href: '#/system/intercom-operations/<view>', need: ['access.read'], installation: true }`; `linkFor` and every place
follow. New `NativeRoute.installation` + `DeepLinkViewer.canInstallation` (wk-deep-links passes the session's installation `can`),
so a station-scoped caller is not offered a view the server would refuse. Labels updated to the native views. With
`ui.hide_wiskey` the panel links go; the native Arx views stay.

## Charts (data-viz method)

Stacked day columns (granted slot 1, denied slot 2, ≤ 24 px, 4 px rounded data end, 2 px surface gap, legend, peak value only,
hover / focus tooltip, table twin) and a single-series trend line (2 px, 8 px end dot with surface ring, ~10 % area wash, the
advertised limit as a solid hairline, crosshair + keyboard, table twin). Palette validated with the skill's `validate_palette.js`:
light `#2a78d6,#eb6834` on `#fcfcfb`, dark `#3987e5,#d95926` on `#1a1a19` - all checks PASS. Status meters use the app's
success / warning / danger tokens. RTL: time runs the way the page reads (oldest at the right); marks are never mirrored.

## Conflicts to expect at the train merge

- `services/wiskey_channels.py` (ALLOWLISTS / ADAPTER_CHANNELS / HA_FRAMES / describe) - also edited by STATION-OPS-2390,
  DOOR-TECH-2390, INSTALLER-NATIVE-2400 (whose `installer` channel also lists `platform/capacity`; one command on two guards is fine).
- `tests/test_pwclean_295.py`: `CATALOG_SHA256_WITH_OPERATIONS` recomputed; the pre-cleanup hash is still proven over the catalog
  without `ADDED_CHANNELS`. Each later channel adds itself to `ADDED_CHANNELS` and recomputes.
- `tests/test_wiskey_channels.py` ADAPTER_CHANNELS tuples; `main.py` router line; `shell/nav.ts`, `system-index.ts`, `sw-app.ts`,
  `lazy-screens.ts` (INSTALLER-NATIVE-2400 adds a settings area in the same places).
- Settings column: the new entries are search-only sub-entries of "בקרת כניסה" (owner decision 402 - a new top-level row made the
  "מערכת ותשתית" group overflow by 7 px at 1440x900). INSTALLER-NATIVE-2400 adds a top-level row to the same group: re-run
  `layout-settings-nav-fit-402.spec.ts` after merging both.

## WisKey gaps (asks)

1. `jobs/list` / `jobs/errors` / `jobs/action` answer only the ACTOR's own jobs (`job["actor"] == actor`): Arx sees and can cancel
   only jobs created through its own WisKey identity, never the panel's. Ask: a read of all jobs for an administrator.
2. `platform/capacity` keeps up to 64 samples but returns no series; Arx stores its own (only when someone opens the view). Ask:
   return the compatible samples.
3. `fleet/inventory_export` CSV `_safe_cell` misses tab / CR / full-width formula starters (Arx re-writes the CSV).
4. `jobs/errors` returns WisKey's raw CSV (no guard) - Arx parses and re-writes it.
5. `overview/summary` returns `host` and entity ids even for the summary; Arx drops them. Ask: a summary without device addresses.
6. Row 89 (station permission audit) and row 98 (acceptance checklist) were reachable through the `audit.panel` / `health.fleet`
   panel links; those links are now native views without them (T10 / T19).

## Tests and receipts

| What | Where | Result |
|---|---|---|
| backend, targeted (8 files incl. `test_wiskey_ops_views_2400.py`, channels, pwclean, contract, adapter, capabilities) | runner, `run_smart.py backend` @ 5102d7b58 | 224 passed, 2 skipped |
| backend, same set locally (6 files) | workstation `.venv` | 188 passed, 2 skipped |
| unit specs `unit-intercom-ops`, `unit-wiskey-deeplinks` | workstation, unit config with file filter | 29 passed |
| `tsc --noEmit` | workstation | clean |
| browser: `evidence-intercom-ops` + `pixel-wiskey-deeplinks` + `evidence-wiskey-deeplinks` + `layout-settings-nav-fit-402` + `evidence-calendars-nav-2310` + `evidence-nav-size`, desktop + mobile | runner `run_smart.py preview` @ 396903a39, no snapshot update | 88 passed, 14 skipped (project-scoped), 0 skipped-pixel |

Baselines (Linux, runner): 24 `intercom-ops-*` (overview, operations, jobs, cancel box, timeline, capacity, trend, events,
events tables, exports, empty, error - desktop 1440 and phone 390), and 4 refreshed `deeplinks-classic-*` (the native links in the
stations menu and the drawer).

## NOT_RUN

- Lab: no lab access, no WisKey command sent to a real system (read or write). Every WisKey answer is the rc.10-shaped fake.
- Full backend suite and the full browser / pixel suite (coordinator: targeted runs only; the train gate covers them). Settings
  pages' full-page baselines in other specs that show the settings tab row scrolled to its end may shift by the new last tab -
  not checked beyond the specs above.
- Tablet project (the spec skips it, as the neighbouring specs do).
