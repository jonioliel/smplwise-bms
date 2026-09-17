# SMPLWISE VMS — V1 release package (T072)

Status: **prepared, not approved**. The owner's acceptance test round and signature close this package; until then
the add-on ships as pilot builds (`0.1.x`) from `main`. `python scripts/release_check.py --tag` verifies the
consistency items below and prints the tag commands to run after approval.

## 1. What is being released

| Item | Value |
|---|---|
| Add-on | `smplwise_vms` (repository root `repository.yaml`, folder `smplwise_vms/`) |
| Version at package time | see `smplwise_vms/config.yaml` (release_check prints it) |
| Bridge integration | `smplwise_bridge` 0.2.1 (shipped inside the add-on, installed into HA's `custom_components/`) |
| Image | Alpine 3.22 base, Python 3.12, dependencies from `smplwise_vms/backend/requirements.txt` (cryptography, ezdxf and the rest have musllinux wheels — verified from Windows with `pip download --platform musllinux_1_2_x86_64`) |
| Architectures | amd64, aarch64 (as declared in `config.yaml`) |
| Build | Supervisor builds the image from the repository on install / update; no external registry |
| Database migrations | `smplwise_vms/backend/smplwise/migrations/0001` … `0012` (applied in order at start-up; a pre-upgrade backup is written to `/data/backups/auto-pre-upgrade-*.zip` before a version step) |

## 2. Compatibility matrix (tested)

| Layer | Tested with | Notes |
|---|---|---|
| Home Assistant Core | 2026.9.2 | Ingress identity headers, Supervisor `supervisor/api`, hassio discovery for the bridge |
| Home Assistant OS / Supervisor | HAOS 18.2 · Supervisor 2026.09.2 | amd64 generic-x86-64 lab host |
| NVR | Hikvision DS-7616NXI-K2(D), firmware V4.84.101, ISAPI over HTTP (port 90 in the lab), RTSP 554 | read-only user is enough; no NVR writes in the pilot |
| Relay | go2rtc add-on (AlexxIT) 1.9.14 on the HA host, port 1984 | only the `smplwise_` stream namespace is touched |
| Browsers | Chrome (real, desktop) for MSE / WebRTC / H.264 main profile; Playwright Chromium for the design fixtures | WebRTC decodes the sub profile only; the main profile plays over MSE (see docs/legacy/KNOWN_QUIRKS.md and the lab video facts) |
| Screens | 1440×900 desktop reviewed screen by screen; mobile layout covered by `evidence-mobile.spec.ts` | |
| Lovelace | `custom:smplwise-card` via the bridge's module resource (auto-registered on storage dashboards; YAML dashboards add the resource by hand) | HA restart once after a bridge version change |

## 3. Evidence that backs this package

- Backend: `smplwise_vms/backend/tests` (pytest, 140+ tests at package time) — run `python -m pytest -q` in the backend folder.
- Live evidence in real Chrome against the lab NVR + HA: `frontend/tests/evidence-*.spec.ts` (`SW_LIVE=1 SW_CHROME=1`), 40+ specs; screenshots under `private-evidence/` (never committed).
- Design fixtures: 129 checks (`frontend/tests/screenshots.spec.ts`, `screens.spec.ts`) against the demo data.
- Load: `docs/operations/RESOURCE_BUDGET.md` (8 concurrent workers, steady-state p95 < 0.2 s on every screen except the 24 h events list at 0.86 s).
- Live review of the owner's installation: `docs/operations/LIVE_REVIEW_2026-09-17_HE.md` (F1–F26, all handled by 0.1.51).
- Task cards and requirements: `management/tasks.json`, `management/STATUS.md`, `management/TRACEABILITY.md` (`python scripts/progress.py`).

## 4. Known limits (carried into V1 as documented behaviour)

1. **NVR alerts need "Notify Surveillance Center"** in the NVR's motion-detection linkage; without it the alert stream is
   silent and motion events are derived from recordings every 10 minutes (no person / vehicle events). The event centre,
   the overview and the connections page say so.
2. **Multi-camera synchronized playback is best effort**: no verified PTS↔UTC anchor; measured drift (p95) is shown and
   reported; on the lab NVR / relay four tiles degrade to seconds of drift after a minute or two, and a page of nine
   kiosk streams can stall one tile (kiosk defaults to 3×2 per page).
3. **Playback speeds**: 1×, slow motion ×0.5 / ×0.25 and frame stepping on the MSE path; 2× / 4× are disabled because the
   relay delivers the NVR stream in real time (camera-side RTSP speed is not exposed by go2rtc).
4. **No NVR writes** in the pilot: manual recording, PTZ, two-way talk, zone / mask editing and reboots are not offered
   (read-only facts are shown instead) until the owner approves writes (T075 / T045).
5. **Intercom / access control (T054)** and a **second NVR (T058)** are not part of this release; the doors screen says
   "not connected yet".
6. **Concurrency budget**: up to 4 concurrent operators on the reference workstation; the storage report is warmed in the
   background (cold build ≈ 30–50 s on the lab NVR).
7. **Bridge changes need one HA restart** (0.2.1 added the climate / media / number / select / alarm services).
8. **Legacy comparison (T003 / T004 golden traces)** is still owner-gated; the migration dry run
   (`scripts/migrate_legacy.py`, `docs/operations/MIGRATION_FROM_LEGACY_HE.md`) covers the mapping, rollout and rollback.

## 4b. Smoke test after every upgrade

`python scripts/smoke_after_upgrade.py --live` (owner's installation through Ingress; the privileged checks need a VMS
role for the token's user) or `--base http://127.0.0.1:8099` (developer backend). Sixteen read-only checks; the only
side effect is one playback session the script closes. A FAIL line names what broke; a skip names what the caller
may not run.

## 5. Rollback

1. Every version step writes `/data/backups/auto-pre-upgrade-<stamp>.zip` before migrating (kept: last 5).
2. To go back: install the previous add-on version from the repository (pin the repository to the previous commit or
   use the store's version), then restore the pre-upgrade backup from הגדרות › גיבוי ושחזור (project + access scope).
   Migrations are additive (new tables / columns only), so an older backend also runs on a newer database.
3. The bridge integration is re-installed by the add-on on start; a downgrade of the add-on downgrades the bridge on
   the next HA restart.
4. The legacy add-on, if still installed, can simply be started again (see the migration runbook); the NVR is never
   changed by the VMS.

## 6. Open items that only the owner can close

- Acceptance test round on the owner's installation (the morning checklist + the live review's "מה לבדוק").
- Golden traces from the legacy add-on (T003 / T004) for the characterization comparison.
- NVR write approval (T075 / T045), intercom hardware (T054), second NVR (T058).
- "Notify Surveillance Center" on the NVR.

## 7. Approval

| Field | Value |
|---|---|
| Version approved | |
| Commit | |
| Approved by (owner) | |
| Date | |
| Tag | `vX.Y.Z` — created with `git tag -a vX.Y.Z -m "SMPLWISE VMS X.Y.Z — approved release"` and pushed after signing |

No target date replaces the gates above: the package is signed only when every listed item is either evidenced or
explicitly excluded.
