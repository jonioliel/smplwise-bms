# TRIAL-2500 - early integration trial of the 2.50 rows

Trial branch `trial/2500` (never merged as is). Purpose: find the integration conflicts of the 2.50 rows before the 2.50.0 train,
so that train is quick after 2.49.0.

- Base: `origin/main` = v2.48.0 `d6f09395e`.
- Every row is based on v2.47.0 `619f94d04` (221 commits behind main at the time of the trial).
- 2.49 train merged last: `origin/release/2490-train` `11eccfba8` (the 2.49.0 release commit).

## 1. Merge order and row heads

| # | Row | Head merged | Result |
|---|---|---|---|
| 1 | `pilot/ONVIF-DISCOVER-2500` | `5a729cbca` | clean |
| 2 | `pilot/ONVIF-API-2500` (on top of 1) | `004c0b695` | clean |
| 3 | `pilot/ONVIF-CLIENT-2500` (on top of 2; migration 0217) | `d58353161` | clean |
| 4 | `pilot/ONVIF-UI-2500` (on top of 3) | `5cc014eda` | clean |
| 5 | `pilot/HOME-WALL-NIGHT-2500` | `c0fb81e2e` | clean |
| 6 | `pilot/HOME-FAVORITES-2500` | `b802a3228` | clean |
| 7 | `pilot/MULTI-BUILDING-SAFETY-2500` | `d00aa3ede` | 2 conflicts (section 2) |
| 8 | `pilot/MULTI-BUILDING-HOME-2500` (migration 0218) | `63e7a7c02` | 6 conflicts (section 2) |
| 9 | `origin/release/2490-train` | `11eccfba8` | 16 conflicts (section 3) |

The ONVIF chain is linear (DISCOVER -> API -> CLIENT -> UI each contain the previous row), so merging `ONVIF-UI-2500` alone gives the
same tree; it was merged row by row to see where a conflict would come from (none did).

### Migrations

main and the 2.49 train both end at `0216_review_indexes.sql`. `0217_camera_discovery_origin.sql` (ONVIF-CLIENT) and
`0218_mb_home_building.sql` (MULTI-BUILDING-HOME) do not collide with main, with the 2.49 train or with each other: **no renumbering
needed**. If another 2.50 row (e.g. `MULTI-BUILDING-NEXT-2500`, `HOME-NEXT-2500`, `ADR019-*-2500`, not in this trial) adds a migration,
it must take 0219 or later.

## 2. Conflicts between the 2.50 rows (on main)

| File | Rows | Resolution |
|---|---|---|
| `contracts/API_INVENTORY.md` | MB-SAFETY (generated at 2.47.0) vs main (2.48.0) | main's header line kept; the file is regenerated at the trial head (`scripts/api_inventory.py`, 1921 routes) - it is a release-time file, rows should not commit it |
| `frontend/src/i18n/lang/en/i18n/msg/system-b.ts` | MB-SAFETY vs main (announce text) | union of the two key blocks; no duplicate keys |
| `frontend/src/api/generated/wire-home-interface.ts` | HOME-WALL-NIGHT (`wall_*` install settings, `HomePolicy.wall`, `HomeWallSettings`) vs MB-HOME (`building_all`, `building_id`) | union; `scripts/gen_wire_types.py --check` passes at the head |
| `frontend/src/api/generated/wire-me.ts` | same | union (`wall` + `building_id` on `HomePolicy`, then the `HomeWallSettings` interface) |
| `smplwise_vms/backend/smplwise/wire/home_interface.py` | same | union (`HomePolicy.wall` + `building_id`; `HomeInstallSettings` wall_* + `building_all`) |
| `smplwise_vms/backend/smplwise/routers/home_interface.py` | same | union in `InstallBody` (the seven `wall_*` fields + `building_all`) |
| `smplwise_vms/backend/smplwise/services/home_interface.py` | same | union: `INSTALL_KEYS.update(wall_*)`, `INSTALL_TIMES`, `HM_RE`, then `INSTALL_KEYS/VALUES["building_all"]`; in `effective()` both `"wall": wall_settings(inst)` and the conditional `building_id` |
| `smplwise_vms/backend/tests/test_home_interface.py` | same | the default-settings assertion expects `{..., **WALL_DEFAULTS, "building_all": "hide"}` |

Auto-merged but touched by two rows (checked by hand): `frontend/tests/unit-modal-stack-guard-2442.spec.ts` (HOME-FAVORITES adds
`home-fav-ui.ts` / `home-scene-2500.ts`, HOME-WALL-NIGHT adds `home-wall-rest.ts`: both kept).

**What the train must do the same way:** HOME-WALL-NIGHT and MULTI-BUILDING-HOME both extend the home install settings and
`HomePolicy` in the same five places; whichever boards second resolves as above (union) and regenerates the wire TS.

## 3. 2.49-vs-2.50 conflicts (merge of `release/2490-train` into the trial)

| File | Cause | Resolution |
|---|---|---|
| `docs/evidence/USR2/*.png` (14 files: login-local-*, service-identity-*, settings-local-users-*) | HOME-WALL-NIGHT-2500 (`c0fb81e2e`) re-captured 18 login / local-user / welcome evidence screenshots under `docs/evidence/USR2/` as a side effect of running specs; the 2.49 train re-captured them too (I18N-EN) | the 2.49 side taken. The rows should drop these files (they are not theirs) - section 6 |
| `frontend/src/i18n/lang/en.ts` (generated pack index) | 2.49 added `en/api/closed-errors`, ONVIF-UI added `en/i18n/camera-discovery`: every `tN` import number shifts | 2.49 side taken, then `node scripts/i18n-split-langs.mjs` re-run on the runner (commit `a832da7e6`); `ar.ts` / `ru.ts` auto-merged with no duplicate import |
| `frontend/src/i18n/lang/en/i18n/msg/system-b.ts` | MB-SAFETY's English keys and the 2.49 train's keys at the same table end | union; checked for duplicate keys (none) |

Files both sides changed that merged without a conflict (semantic risk, covered by the tests below): `rbac.py` (2.49 I18N-BACKEND role
/ scope names as `Msg`; MB-SAFETY adds `effective_on_chain`), `routers/notices.py`, `services/autosync.py`,
`services/camera_sources.py`.

## 4. Security note - `GET /network/info` in `self_update.ALLOWED` (ONVIF-DISCOVER-2500)

- What: one new entry `("GET", "/network/info")` in the Supervisor allow-list of `services/self_update.py`, the single door through which
  the add-on talks to its infrastructure (anything not listed raises `ProbeRefused` before a socket opens). GET, no body
  (`BODY_KEYS` has no entry, so a body is refused), no `{slug}` / `{addon}` parameter.
- Why: the camera scan may only cover the site's own network (owner Q56). The host's interface networks come from the Supervisor;
  the alternative (any private range the user types) was rejected.
- Privilege: the add-on already runs `hassio_api: true`, `hassio_role: manager`; `/network/info` is inside the Supervisor's `default`
  role (`/.+/info`), so the change adds no Supervisor privilege - only an allow-list line.
- Data handled: the answer also holds Wi-Fi details, DNS servers, gateways and the Docker network. `ranges.parse_network_info` reads
  only `interfaces[].ipv4.address` (at most 8 per interface) of interfaces not marked disabled / disconnected, keeps only networks
  inside RFC 1918 (so CGNAT, link-local, documentation and public ranges are out) that do not overlap the Supervisor bridge
  172.30.32.0/23, and caches the parsed list in memory for 60 s. The `docker` block, Wi-Fi and DNS fields are never read. Nothing of
  the answer is stored in the database or logged.
- Residual risk (low): a host interface that NetworkManager reports with an RFC 1918 address but that is not the camera LAN (e.g. a
  second NIC or a VLAN) also becomes a "site network"; the scan is still capped at 1,024 addresses, paced, Get-only and audited, and
  `cameras.discovery_allowed_ranges` can narrow it.
- Exposure: the derived `suggested_range` (a CIDR of the host's own LAN) is returned by `GET /cameras/discovery/capabilities`, which
  requires the discovery permission at installation scope (`rbac.require`, an audited 403 otherwise). That exposes the site's LAN
  prefix to installation-level camera administrators only - acceptable (they configure camera addresses on that LAN anyway).
- Fail-closed: no Supervisor / an error = no site network = every range refused (`site_network_unknown`); the 1,024-address cap
  cannot be lifted by a setting.
- Test: `tests/test_self_update_s3.py` pins the exact allow-list set (updated by the row), and `test_camera_discovery_2500.py` covers
  the parsing and the fail-closed rule.
- Verdict: acceptable as is. Recommendation for the row: keep this note (or a short version) in `docs/changes/ONVIF-DISCOVER-2500.md`
  under a "Security" heading, since a reviewer looks for every `ALLOWED` change.

## 5. Tests at the trial head

PC (at e18863785): `ruff check` of the five conflict-resolved backend files - all checks passed; `pytest tests/test_home_interface.py`
(the conflict-resolved home interface test file) - **28 passed** (247 s). Runner, done during the merge: `gen_wire_types.py --check`
exit 0; `node scripts/i18n_missing_keys.mjs --json` against `docs/i18n/EN_RATCHET.json` - no new English gap key, no new placeholder
key, hard-coded Hebrew total 3160 = the ratchet (the 2.50 rows add no untranslated text on top of the 2.49 train).

Runner (tsc x3, vite build, Node unit suite, the rows' browser specs desktop + mobile `--workers=2`, backend in 4 shards):
**NOT_RUN - BLOCKED by the runner.** The job (`~/work/trial2500_tests.sh`, specs list below) waited on slots B/C/D from 00:33 to
~04:50 UTC without getting a slot (10-15 other agents' jobs queued, several running 2-3 h); from ~04:00 UTC the runner was
out of memory (OOM kills of headless Chromium, load 100-250, SSH banner time-outs). The waiting job was cancelled to stop adding
load. No tsc / build / unit / browser / full-backend result exists for the trial head - nothing here is a PASS.

Specs the run was to cover (from `frontend/`): camera-discovery-2500, evidence-onvif-ui-2500, home-wall-night-2500,
home-wall-night-2500-shots, home-favorites-2500, home-favorites-2500-shots, evidence-mapping-assist-2330, evidence-mb-safety-2500,
evidence-mb-home-2500, pixel-home-auditfix-2437, pixel-home-fb-2431, pixel-home-gaps-2436 (plus the whole Node unit suite, which holds
unit-camera-discovery-2500, unit-home-wall-night-2500, unit-home-favorites-2500, unit-mb-safety-2500, unit-mb-home-2500 and
unit-modal-stack-guard-2442). Re-run: a worktree of `origin/trial/2500` at `~/work/trial2500`, then
`~/work/slotb.sh ~/work/trial2500_tests.sh <specs file>`.

## 6. What each row still needs before boarding

Common to every row: all eight are based on v2.47.0 and are 221 commits behind main; the train merges them as in sections 1-3.
No row needs a migration renumber.

| Row | Needs |
|---|---|
| ONVIF-DISCOVER-2500 | a "Security" paragraph in its change note for the new `ALLOWED` entry (section 4 is ready to copy); its runner slot-A run was NOT_RUN at hand-back (the trial's backend run covers its tests at the trial head) |
| ONVIF-API-2500 | nothing found by the trial beyond the test results below |
| ONVIF-CLIENT-2500 | nothing found by the trial beyond the test results below; migration 0217 stays 0217 |
| ONVIF-UI-2500 | its runner run was NOT_RUN at hand-back (PC only); the trial runs its two browser specs at the trial head |
| HOME-WALL-NIGHT-2500 | drop the 18 `docs/evidence/USR2/*.png` files its commit `c0fb81e2e` re-captured (login / local users / welcome - not this row; 14 of them conflict with the 2.49 train): `git checkout origin/main -- docs/evidence/USR2` on the branch. Resolve with MULTI-BUILDING-HOME as in section 2 (whichever boards second) |
| HOME-FAVORITES-2500 | pixel baselines refreshed and pushed by this trial (section 7, `7156c24ef`) - nothing else found |
| MULTI-BUILDING-SAFETY-2500 | rows should not commit `contracts/API_INVENTORY.md` (release-time file; it conflicts with every release); drop that hunk or accept the conflict as above |
| MULTI-BUILDING-HOME-2500 | the union with HOME-WALL-NIGHT (section 2); its pixel baselines were NOT_RUN at hand-back - the trial runs the three pixel-home specs at the trial head |

## 7. HOME-FAVORITES-2500 pixel baseline refresh

Done on the row's own branch (runner slot B, `vite build` + `vite preview`, the three `pixel-home-*` specs, desktop + mobile,
`--workers=1`): check 2 failed (exactly `auditfix-room-dark-768` and `auditfix-room-light-768`), `--update-snapshots=changed`
rewrote only those two files, verify 24 passed / 4 skipped / 0 failed. The diff images were reviewed: every changed pixel is in the
favourites grid (the tiles keep their order, two "+ הוסף" holes) - the intended Q78 change; in light only, the empty area under the left
column differs by at most 3/255 (imperceptible). Committed and pushed as `7156c24ef` on `pilot/HOME-FAVORITES-2500` (with the change
note updated), then merged into the trial (`e18863785`).
