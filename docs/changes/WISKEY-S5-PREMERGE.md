# WISKEY-S5-PREMERGE — WisKey M12 policy B, slice S5: integration with the 2.37.0 train (pre-merge)

Branch `pilot/WISKEY-S5-PREMERGE`, cut from `origin/pilot/WISKEY-RC7-ADOPT-2331` @ `48fae50b5` (S1 + S2 + S3 there), done early so the
WisKey release can start right after 2.37.0. Nothing here is merged to `main`, tagged, released, installed or switched on. No add-on
version bump (the branch reads 2.37.0, the train's number; the WisKey release assigns its own). No device, Home Assistant, runner, WisKey
or install contact. Plan: `private/planning/WISKEY_M12_INTAKE_AND_ADOPTION_PLAN_2026-11-02.md` (slice S5, policy B). The two source
branches were not pushed to.

## Merges

| # | Merged | At | Conflicts | Resolution |
|---|---|---|---|---|
| 1 | `origin/release/2370-train` | `a81f96aa6` (2.37.0; contains `origin/main` 2.36.x) | `smplwise_vms/CHANGELOG.md` (one textual conflict) | the WisKey DRAFT section kept above the train's 2.37.0 ... 2.34.2 sections; its "After installing" line names the three migrations (it said one), English + Hebrew |
| 2 | `origin/pilot/WISKEY-S4-OBSERVER` | `93b76fae8` (bridge 0.10.2, based on `287cdc1e8` of the same chain) | none | - (the train ships bridge 0.10.0, the chain 0.10.1; 0.10.2 stays the highest; mirror identical, `scripts/sync_integration.py --check` up to date) |

## Migrations renumbered

The train took `0192_ha_labels.sql` and `0193_calendar_feed_review.sql`. The three WisKey files follow it (`git mv`, DDL unchanged, one
header line each recording the renumbering); contiguous 0001-0196. None of the three was ever released.

| Before (RC7 chain) | Now |
|---|---|
| `0192_wiskey_installed_features.sql` | `0194_wiskey_installed_features.sql` |
| `0193_wiskey_relay_map_stations.sql` | `0195_wiskey_relay_map_stations.sql` |
| `0194_wiskey_relay_map_exports.sql` | `0196_wiskey_relay_map_exports.sql` |

References updated: `wiskey_installed_features.MIGRATION` and its two comments; the docstrings of `wiskey_relay_map.py`,
`wiskey_relay_map_export.py`, `wiskey_relay_map_native.py` and `tests/test_wiskey_relay_map_writer_2310.py`;
`tests/test_wiskey_adopt_2272_review.py::test_l3_the_tables_come_from_migration_0194_and_the_consumers_run_no_ddl` (renamed; it now checks
that the WisKey migration's own version is recorded instead of the unrelated version 183). Earlier change docs keep their historical numbers.

Runner rules (`Database.migrate`): files sorted by name, the integer prefix is the version, a version recorded in `schema_migrations` is
skipped, no checksum of the file text is kept. So the added header line changes nothing for an installed database, and every installation
that never ran a WisKey development branch upgrades cleanly: 2.35.0 (ends at 0191) runs 0192..0196, 2.36.x / 2.37.0 (ends at 0193) runs
0194..0196. Two files with one number would break a start (the second INSERT of the same version hits the primary key) - the renumbering
removes exactly that state, which existed only in the uncommitted merge. Limitation: a development database that ran the RC7 chain with
WisKey at 0192..0194 has versions 192 / 193 recorded and would skip the train's 0192 / 0193 - development only, never released.

New `tests/test_wiskey_s5_migration_upgrade.py` (real migration files): contiguous + unique 0001-0196 with the train's numbers kept and the
old WisKey numbers gone; 0191 -> 0196 in one start (each once, in order); 0193 -> 0196 runs exactly 194/195/196 and keeps the train's rows;
all five migrations' objects exist; a second start runs nothing; policy B after the merge (below).

## Policy B (unchanged, re-checked after both merges)

`wiskey.auto_install` default OFF (absent / null / unreadable = off), no production code path writes it except the owner's one writer
(`services/wiskey_switches.apply` behind `PUT /wiskey/switches`), and ON is refused in this build (`wiskey_auto_install.OWNER_ON_PERMITTED =
False`). Pinned by `test_wiskey_rc7_adopt_2331::test_1b_*` (static: no set_setting names the key; exactly one writer; OFF on a fresh
database), `test_wiskey_m12_policy_b_owner_switch.py` (build refusal, 403 / audit, generic settings route is not a second writer, restore
keeps the live value) and the new `test_s5_policy_b_survives_the_merge_no_migration_seeds_the_switch_and_on_stays_refused` (no migration
names the key; an upgraded database reads it absent = OFF; the constant is False). No migration or train file names the key.

## Key rotation (H-07) - the two earlier failures

`test_bridge_key_activation_295::test_h07_a_retired_keys_sealed_blob_is_not_left_in_the_database_or_the_wal` and
`test_bridge_keyrot_harness_295::test_restarts_of_both_sides_keep_the_key_set_and_the_replay_marks` failed on `287cdc1e8` (WISKEY-S4-OBSERVER
run 1) and on the chain head: the chain's 2.35.0 merge predates `bf417875b` (GATE2350-A, in v2.35.0 final). On the chain,
`bridge_keys.scrub` ran `PRAGMA wal_checkpoint(TRUNCATE)` inside `db.connection()` - a `BEGIN IMMEDIATE` transaction, where SQLite refuses
the checkpoint; the error was swallowed, and with the pooled connections (DB-CONN-POOL-2343) the WAL file stays open, so the retired key's
sealed blob stayed in the WAL. `bf417875b` adds `Database.scrub_wal()` (its own short connection outside any transaction, under the write
gate, pending + retried when a transaction ends) and `bridge_keys.scrub` calls it. The 2.37.0 train brings it in: both tests pass here
(targeted run and the full set below). No code change in this slice for it.

## Tests (workstation, Windows, single process; the runner was not used)

Interpreter: `C:\cloude\smplwisebms\.venv\Scripts\python.exe` (Python 3.12), cwd `smplwise_vms/backend` of this worktree (imports this
worktree's `smplwise`, checked). Node 24.21.0 for the frontend.

| Run | HEAD (code) | Command | Exit | Result |
|---|---|---|---|---|
| migrations (early) | merge 1, uncommitted | `pytest -q -p no:cacheprovider tests/test_wiskey_s5_migration_upgrade.py tests/test_migrations.py tests/test_migrations_263_upgrade.py` | 0 | 9 passed |
| H-07 targeted | `058e12cfa` | `pytest -q -p no:cacheprovider` the two H-07 tests by node id | 0 | **2 passed** |
| backend run 1 | `058e12cfa` + the policy-B test (committed after) | `pytest -q -p no:cacheprovider -rfE --junitxml=... <77 files>` | 0 | **2316 passed, 27 skipped, 0 failed** (2343 collected, 6682 s), receipt `docs/changes/receipts/WISKEY-S5-PREMERGE/run1.junit.xml` |
| tsc | `058e12cfa` | `npx tsc --noEmit -p tsconfig.json` (frontend) | 0 | no errors (356 s) |
| frontend unit | `058e12cfa` | `npx playwright test -c playwright.unit.config.ts --workers=1 --reporter=line` + 16 specs | 0 | **186 passed** |
| integration mirror | `058e12cfa` | `python scripts/sync_integration.py --check` | 0 | up to date |
| release check | `058e12cfa` | `python scripts/release_check.py` | - | every line ok but `git tag v2.37.0 not yet` (expected); `migrations contiguous: 196 files, last 0196_wiskey_relay_map_exports.sql`; bridge 0.10.2 both copies |
| API inventory | `058e12cfa` | `python scripts/api_inventory.py` | 0 | regenerated: 1711 -> 1716 routes (the chain's WisKey routes on top of the train) and three WisKey docstring rows; committed |

The 77 backend files: every `tests/test_wiskey*.py` (incl. the S3 maintenance, S4 observer, M12 owner switch / native gate and the new
S5 file), `test_mac_managed_auto_policy`, `test_smallfixa_wiskey_switches_295`, `test_asgi_wiskey_295`, `test_fake_wiskey*`, every
`tests/test_bridge_*.py` (key rotation / activation / pause / keyrot harnesses, install, config, lease, media, schedule, service identity,
stream source, runnable ...), `test_migrations`, `test_migrations_263_upgrade`, `test_db_conn_pool`, `test_extid_followups`,
`test_lovelace_card`, `test_bkpfix_295`. Selected per file (passed / skipped / failed): `test_wiskey_s5_migration_upgrade` 4/0/0;
`test_bridge_key_activation_295` 30/0/0; `test_bridge_keyrot_harness_295` 34/0/0; `test_bridge_key_rotation_295` 45/0/0;
`test_db_conn_pool` 28/0/0; `test_migrations` 4/0/0; `test_migrations_263_upgrade` 2/0/0; `test_wiskey_m12_policy_b_owner_switch` 34/0/0;
`test_wiskey_m12_policy_b_native_gate` 31/0/0; `test_wiskey_m12_s3_maintenance` 47/5/0; `test_wiskey_rc7_adopt_2331` 27/5/0;
`test_wiskey_s4_core_observer` 30/1/0; `test_wiskey_adopt_2272_review` 38/3/0.

The 27 skips are NOT_RUN on Windows, not passes: 7 + 1 + 1 + 1 + 1 symlink fixtures (POSIX / privilege), 5 rc.7 row 5b + 5 S3 generation
fence (fcntl), 1 flock (fcntl), 1 POSIX mode bits, 1 `jsonschema` not installed, 1 `homeassistant` not installed, 2
`test_every_command_of_every_channel_exists_in_the_pinned_catalog[pacing|readback]` ("channel holds commands newer than the pinned catalog").

The 16 frontend specs: `unit-wiskey-*` (embed-connector, native-tabs, relay-map, schedules-nav, station-media, stations-nav, stations,
switches), `unit-bridge-key`, `unit-wkaudin-295`, `unit-wkdirect-talk-max`, `unit-wkf01f02-295`, `unit-wxsch`, `unit-wxunblk`,
`unit-station-permissions`, `unit-service-identity`.

## NOT_RUN

S6 follow-up: see `docs/changes/WISKEY-S6-RELEASE-PREP.md` (merge of 2.37.0 final, version 2.37.1, the runner receipt).

- S6 (out of scope): the runner (Linux) - full backend suite, the POSIX / fcntl / symlink / jsonschema skips above, runner entry check,
  receipts with PID / command / env / exit; the add-on build (`npm run build:addon`) - the committed `smplwise_vms/www` is the train's
  build and does not carry the chain's WisKey screen changes; Vite build / preview, Playwright browser suites, pixel baselines.
- The full backend suite on this branch (only the WisKey / bridge / migration / key-rotation set above).
- `release_check.py` reports `[FAIL] git tag v2.37.0 not yet` (expected: no tag here); every other line ok.
- Nothing installed, no HA restart, no device.
