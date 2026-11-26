# Legacy migration - gap analysis and plan (T070, LEGACY-MIGRATION-2550)

Scope: carrying a site from the legacy **Hikvision NVR Panel add-on v1.5.27** (slug `hikvision_nvr`, the system the pilot site
runs today) into SmplWise Arx, gradually, with the legacy kept as the way back until the owner signs the decommission.

Sources: the legacy source (local branch `legacy/import`, `legacy/hikvision_nvr_v1.5.27/`: `app/main.py`, `app/static/index.html`,
`config.yaml`, `Dockerfile`), `LEGACY_AUDIT.md`, `REUSE_MATRIX.md`, `KNOWN_QUIRKS.md`, `PARITY_REPORT.md` (25 capabilities, every
legacy route claimed), `docs/changes/T070-T006-2406.md` (the earlier dry-run tool and the LAB items). Everything below was read from
the source; nothing was run against a device.

Related: the Hebrew operator guide `docs/operations/MIGRATION_FROM_LEGACY_HE.md`, the Hebrew side-by-side acceptance checklist
`docs/operations/LEGACY_ACCEPTANCE_CHECKLIST_HE.md`, the change note `docs/changes/LEGACY-MIGRATION-2550.md`.

## 1. What the legacy add-on stores

The legacy keeps very little state of its own. Everything a site configured lives in four places:

| # | Item | Where (1.5.27) | Format / notes |
|---|---|---|---|
| L1 | Add-on options (14 keys) | Supervisor `/data/options.json`, copied by `run.sh` to `/tmp/addon_config.json` | `nvr_ip`, `nvr_port` (90 on the site), `nvr_rtsp_port`, `nvr_user`, `nvr_password`, `app_pin`, `technician_pin`, `pin_length`, `session_minutes`, `snapshot_seconds`, `go2rtc_url`, `go2rtc_ingress_path` (holds an Ingress token), `log_level`, `event_search_debug` |
| L2 | NVR connection overrides | the override document in the HA configuration folder (`hikvision_nvr_override.json`) | `nvr_ip` / `nvr_port` / `nvr_rtsp_port` / `nvr_user` / `nvr_password`; they WIN over the options (an empty host / user / password never overrides) |
| L3 | Camera display names | override `camera_names` | `{"<InputProxy channel>": "<name>"}`; set by the rename dialog; separate from the NVR's own channel names |
| L4 | Recording display offset | override `recording_display_offset_mode` (`auto` / `manual` / `auto_plus_manual`), `_direction` (`add` / `subtract`), `_minutes` | `auto` = the suffix of the NVR's `localTime`, which is the STANDARD offset even in summer (KNOWN_QUIRKS T1); the site runs `auto + manual -120 = 0` |
| L5 | Running manual recordings | override `manual_recording` | rows `{trackID, channelID, startedAt(Iso), durationSeconds, until(Iso)}`; the auto-stop is an in-process timer restored at start |
| L6 | Local event store | `hikvision_nvr_event_store.jsonl` in the HA configuration folder | JSON lines with `storedAt`, at most 4,000 rows; the events screen is switched off in production (`EVENTS_ENABLED = False`) |
| L7 | Browser state | `localStorage.hikTheme` | the theme only |
| -- | Not stored at all | page memory | the live grid's screen count (1-16), camera choice and order, the recordings search; reset on every load |

Not in the legacy (so nothing to migrate): users or permissions beyond the two shared PINs, notifications, rules, schedules (the
recording schedules live on the NVR and the legacy only displayed them), saved layouts, floor maps, any Home Assistant entity or
service (0 / 0, PARITY_REPORT C6). State that stays where it is: everything on the NVR (channels, OSD names, schedules, motion, masks,
NVR users), the legacy go2rtc streams `hik_ch*` / `pb_*` (outside Arx's `smplwise_` namespace, C7).

## 2. Mapping and gaps

| # | Legacy item | Arx counterpart | Carried by the import? | Gap / decision |
|---|---|---|---|---|
| L1 nvr_ip / ports / user | NVR host, ports, user | Settings > Connections > NVR (CR-022, tested before saved) | **compared** (same / other / missing), never copied | Arx must test a connection before saving it - an import cannot do that without contacting the NVR, so a person enters it (once, at install) |
| L1/L2 nvr_password | NVR password | stored encrypted by Arx | **never** (the reader reduces it to set / empty) | by design; a read-only NVR user is recommended |
| L1 app_pin / technician_pin | sign-in | one home-system user per person + Arx roles (viewer / operator / site admin / system admin, custom roles) | **manual** | a shared PIN identifies nobody: no automatic user can be made from it |
| L1 pin_length / session_minutes | - | sessions are the home system's | skip | not applicable |
| L1 snapshot_seconds | snapshot refresh | `snapshots.max_age_s` (a cache, other meaning) | skip | different meaning; Arx's default stays |
| L1 go2rtc_url | go2rtc add-on | add-on option `go2rtc_url` | **compared** | same go2rtc expected |
| L1 go2rtc_ingress_path | - | not needed (Arx relays media itself) | skip (secret) | - |
| L1 log_level / event_search_debug | - | Arx's own option / diagnostics | skip | - |
| L3 camera_names | camera alias | `cameras.alias` | **YES - written** (only where the Arx alias is empty; matched by channel on the first recorder) | an Arx alias that differs is kept and shown; a channel Arx does not know is listed ("sync from the NVR" first) |
| L4 display offset | - | none: Arx shows the NVR's wall-clock times per IANA zone (T014) | reported (effective offset computed exactly as the legacy did) | a non-zero effective offset is a warning: check one known event in both (LAB-T070-03) |
| L5 manual recordings | manual record start / stop (`nvr.record.manual`, an NVR write) | reported | not carried | a running legacy recording is stopped in the legacy UI before the legacy is stopped (its auto-stop timer dies with it) |
| L6 event store | Arx event center (NVR alerts, recording-derived, HA sensors) | reported (row count) | not imported | stays with the legacy as an archive |
| L7 theme | per-user light / dark | - | not carried | trivial; each person picks it |
| - | live grid layout | saved views | nothing to carry | the legacy never stored one |

Feature gaps of Arx against the legacy (from PARITY_REPORT, unchanged by this row): **P09** camera (IPC) reboot - missing (owner
question T070-Q2, recommendation: accept); **P18** recorded days per month - missing (T070-Q3, recommendation: accept for the cutover);
**P12** bad-sector disk test - partial. Dropped on purpose (security): raw ISAPI proxy, go2rtc HTTP proxy, RTSP URL with credentials
to the browser.

Gaps of the migration itself that remain after this row: (a) no screen yet - the import is an API for a system administrator plus
the workstation script (open question in the change note); (b) Home Assistant dashboards / automations that link to the legacy panel
or its streams are not scanned (a LAB checklist item); (c) the legacy's characterization traces (T003/T004) were excluded by the owner
- the shadow comparison stands in for them.

## 3. The import path (built in this row)

Read-only reader, dry run, apply - all software, nothing touches a device:

1. **Copies only.** Arx never opens the legacy's own files (PARITY_REPORT C8 stays true). An administrator hands over a copy: the
   loose files, a ZIP / TAR of them (any names - members are recognised by content), an unprotected Home Assistant backup (up to
   20 MiB through the API; any size with the workstation script), or the secret-free export the script writes
   (`scripts/migrate_legacy.py --backup <file> --export legacy_export.json`). A protected (encrypted) backup is refused with its own
   reason. Format and limits: `smplwise_vms/backend/smplwise/services/legacy_source.py`.
2. **Secret-free by construction.** While reading, every password / PIN / token (including the Ingress path) becomes set / empty,
   and the NVR host and the go2rtc URL become salted digests that are only compared with Arx's own. The report, the audit rows and
   the run record therefore cannot carry a secret or a host.
3. **Dry run** - `POST /api/v1/migration/legacy/dry-run` (system administrator): one item per legacy element with an action
   (`update` / `create` / `same` / `keep` / `skip` / `manual` / `info`), a stable code, a note in the reader's language (Hebrew /
   English), the warnings and a `plan_digest`. Nothing is written but one audit row.
4. **Apply** - `POST /api/v1/migration/legacy/apply?plan_digest=&confirm=` with the same file: system administrator, interactive
   session, the typed confirm word (`ייבוא מהמערכת הישנה` / `import legacy`); the plan is made again and must have the same digest
   (else 409 - the file or Arx changed); a project backup (`auto-pre-legacy-import`, newest 5 kept) is written BEFORE the first change
   (no backup, no change); only empty aliases are filled (guarded UPDATE - idempotent: the same file again writes nothing and no
   backup); every alias gets a `camera.update` audit row (`via: legacy_import`), the run a `migration.legacy.apply` row and an entry
   in `migration.legacy.runs`.
5. **Undo.** Restore the `auto-pre-legacy-import` backup (Settings > Backup), or clear the aliases by hand. The legacy itself is not
   touched by any step.

## 4. Migration plan (gradual, with a way back at every step)

| Phase | What | Who | Way back |
|---|---|---|---|
| 0 Prepare | Arx installed next to the legacy (different slug and panel), same NVR (Settings > Connections > NVR, tested), same go2rtc; NVR-writes switch OFF; Arx backup | lead + owner | uninstall Arx; nothing else changed |
| 1 Copy | copy of the legacy files (or a backup) to the workstation; `migrate_legacy.py --backup ... --export ...` | lead | - (read only) |
| 2 Dry run | upload the export to Arx's dry run; fix what it flags (missing cameras -> sync from the NVR; host / port / user differences; offset warning) | lead | - (writes nothing) |
| 3 Apply | apply the reviewed plan (backup first) | system administrator | restore `auto-pre-legacy-import` |
| 4 Shadow | both run for at least one full day: the Hebrew checklist side by side (live, recordings, a known event's time, export, health, people) | owner + lead | stop using Arx |
| 5 Cutover | people get home-system users and Arx roles; running legacy manual recordings stopped; the legacy add-on STOPPED (not removed) | owner | start the legacy add-on again (its options and files are untouched; the NVR was never written) |
| 6 Decommission | only on the owner's written approval, after an Arx backup and a Home Assistant backup that includes the legacy add-on; the legacy's files stay as an archive | owner | restore the Home Assistant backup |

Success = every row of the Hebrew checklist passed or accepted by the owner, AT139 / AT140 evidence attached, owner sign-off.

## 5. Not done here

No lab run, no device contact, no screen. The dry run against the real legacy files (LAB-T070-01) and the shadow day are the
owner's / lead's session; the checklist is written for it.
