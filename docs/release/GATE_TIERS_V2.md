# Release gate v2: risk tiers and the changed-path to test map (GATEEFF2-295)

Status: proposal for the lead and the owner, written 2026-10-21 on top of `pilot/GATEEFF-295` (head `256205472`). Nothing here is
installed on the runner and nothing was run on it. Numbers marked "measured" come from `select_tests.py report` and
`tier_domain_map.py report` run on a workstation checkout of that head (read-only, 2026-10-21); everything else is quoted from the
release reports under `private/planning/` or from `docs/release/GATE_SPEED.md`. It extends `docs/release/TEST_POLICY.md`
(tiers S/M/L, owner decision 2026-10-02), it does not replace it.

## 1. Are we over-testing? What the evidence says

| Observation | Source | Consequence |
|---|---|---|
| 2.10.0 gate: 186 min, 154 reds. 47 stale preview/dev tests + 2 backend were tests that met intended changes of the SAME diff; 104 were pixel baselines of intended UX changes; 13 flaky. Two real defects were found by the gate and the visual matrix (phone bar labels, dd chips under the corner) | `RELEASE_2100_REPORT_DRAFT.md` | The cost was triage and re-gating, not the existence of old tests. A stale test that fails because the diff changed behaviour is the signal a gate exists to give. Lanes (GATEEFF-295) cut the triage; they must not hide that signal |
| 2.9.0 .. 2.9.3 gates: 138-177 min; reds were 2 stale backend tests (2.9.0), 7 reds from one feature (2.9.1), 2 branch-meeting reds (2.9.2), 1 stale test on 3 sizes (2.9.3) | `RELEASE_290..293_REPORT_HE_EN.md` | Every red was closed by a test-only fix and a targeted run (owner rule, `targeted_plan.py`). The full re-gate was never needed |
| Wall time is structural: serial phases, `--workers=1` chunks, per-test app start with 123 migrations on a fsync-bound disk | `GATE_SPEED.md` section 1 | v2 schedule (one Playwright pool, 6 shards, tmpfs, DB template) is where the minutes come from: model 85-95 min against 151 |
| Selection pays on small branches only. Of the 38 branch merges of the 2.10.0 train (measured): 17 needed neither side in full, 13 needed the full backend, 12 the full frontend, 4 both. Average selected: backend 268 of 439 shard-min (61 percent), frontend 425 of 889 worker-min (48 percent). The whole 2.10.0 diff (1161 files) is full on both sides | `select_tests.py report merges:v2.9.3..bd4636e7f` (measured) | A release-size diff is tier L whatever we do. Do not promise fewer tests per release; promise shorter wall time, a machine-made triage, and real savings on S/M releases |

Conclusion: no test is deleted or weakened. The gate gets faster (v2), quieter (lanes, managed quarantine), and, for small
releases only, narrower (selection under the nightly-health rule).

## 2. How the policy tiers map to the engine today (and the gaps)

`docs/release/TEST_POLICY.md` defines S/M/L by risk. The engine has its own `--tier S|M|L` flag that is NOT the same thing:

| Engine `--tier` | What it runs | Maps changed files? |
|---|---|---|
| `S` | tsc, build, `unit-*` specs, release_check | no |
| `M` | S + the whole backend + every Playwright spec on the dist preview (no dev-server, fixture or pixel groups) | no |
| `L` | everything (backend shards, preview, dev server, fixture, pixel, release_check) | only with `--select-base` / auto selection (tier L only) |

So the policy tiers are realised like this:

| Policy tier | Engine invocation | Notes |
|---|---|---|
| **S** (targeted by changed paths + smoke) | `~/release_gate.sh <branch> --tier L --select-base <previous release tag> --base <previous release tag>` | Selection = every touched test + the smoke set + the security core + the import closure (`select_tests.py`). Runs only while the last full nightly on main finished (`nightly_health`, 48 h, 70 percent of the baselines); otherwise the engine runs the full tier and says why in the report's `selection_policy` line |
| **M** (S + affected module suites) | the same command, then the family files of section 4 for every family the diff touches, run as a targeted pytest/Playwright batch on the runner | The engine has no "also run this glob" option. Gap G1 below. Until it exists, M = S selection + a hand-run family batch, and the report must say so |
| **L** (migration, RBAC, bridge allow-list, auth, backup, new screen family, skin/theme layer, owner review flag) | `~/release_gate.sh <branch> --tier L --full --schedule v2` (v1 until the shadow run is recorded) | Full tier. The 2.10.0, 2.9.x and 2.8.0 trains were all L |

Decide the tier from the diff with the helper (read-only, no test is run):

```
python scripts/gate/tier_domain_map.py diff --base <previous release tag> --head <candidate>
python scripts/gate/tier_domain_map.py paths smplwise_vms/backend/smplwise/services/temperature_report.py frontend/src/components/sw-tabs.ts
python scripts/gate/select_tests.py report --root . <previous release tag>..<candidate>      # the engine's own numbers
```

A release takes the highest tier any file needs (TEST_POLICY). The helper prints the floor from file paths; the lead raises it for
anything an owner review flagged, a new screen family, or "when in doubt go one tier up".

### Known gaps (listed, not hidden)

| # | Gap | Effect | Proposed follow-up (not done here) |
|---|---|---|---|
| G1 | No `--also-backend GLOB` / `--also-spec GLOB` option on the engine | Tier M's "whole domain directory" cannot ride on the gate; it is a hand-run batch | small task GATEEFF3: two env knobs read by `select_tests.py`, family lists from `tier_domain_map.py` |
| G2 | Selection is blocked while the nightly does not finish (the 2026-10-16..20 nightlies all hit their budget) | S/M releases run the full tier today | nightly on v2 schedule (section 6 of `GATE_V2_ROLLOUT.md`) |
| G3 | The engine's `--tier S/M` differ from the policy S/M | confusion in reports | the report line "policy tier" should be written by the lead; a rename of the engine flags is a separate decision |
| G4 | Fixture-backed specs other than the camera card self-skip in the gate (`TEST_POLICY.md`) | no tier covers them | out of scope |
| G5 | `mobile/` (Android/iOS shells) and `services/push-relay/` have no test in the gate; `scripts/test_push_relay.*` exist but are not run by it | a change there is gated by nothing | owner decision; listed in section 7 |
| G6 | Name-based families are a heuristic (section 4); `select_tests.py` stays the authority | a test whose name carries no family word is reached only by the import closure or the full tier | the unmapped list (section 7) |

## 3. Tier floor by changed path

Implemented by `scripts/gate/tier_domain_map.py` (`tier_floor`), which reuses the full-tier triggers of `select_tests.py`.

| Changed path | Floor | Why |
|---|---|---|
| `smplwise_vms/backend/smplwise/migrations*/`, `main/db/config/errors/audit/__init__/__main__/body_limit.py`, `routers|services/__init__.py`, `tests/conftest.py|db_template.py|hygiene.py`, requirements/pyproject, `Dockerfile` | L | `select_tests.py` FULL_BACKEND: every test database or every route |
| `roles.json`, `rbac.py`, `auth.py`, `capabilities.py`, `mode.py` | L | permission catalogue: every screen and API check (FULL_BOTH) |
| `services/` or `routers/` files whose name matches backup, local_passkeys, local_identity, local_passwords, second_factor, webauthn, trusted_caller, secrets_store, signing, bridge_keys, bridge_rotation, revocation, service_identity, ha_user_auth, ha_user_admin, door_authority, door_execute, capture_lease | L | TEST_POLICY: authentication, backup/restore, security-relevant |
| `frontend/package*.json`, vite/tsconfig/playwright configs, `src/main.ts`, `router.ts`, `shell/`, i18n core, styles core (tokens/base/global/theme), `design/`, `src/fixtures`, `tests/fixtures`, `tests/gate_tablet_allowlist.json` | L | FULL_FRONTEND: shell, skin/theme layer, shared fixtures |
| `custom_components/smplwise_bridge/*_policy.py`, `runnable.py`, `services.yaml`, `const.py`, `config_flow.py`, `service_identity.py` | L | bridge allow-lists and options flow |
| other `custom_components/` files | M | TEST_POLICY: a bridge change |
| `frontend/src/components/`, `frontend/src/styles/` (non-core) | M | shared component or style |
| `services/user_prefs.py`, `services/settings*.py`, `services/tabs_mode.py`, `routers/me.py`, `routers/settings.py` | M | a setting with a /me/prefs path |
| any other `smplwise_vms/backend/`, `frontend/`, `scripts/` file | S | ordinary change; selection decides the tests |
| `scripts/gate/` | S | plus `selftest_gate.py` on the runner |
| `smplwise_vms/www*/` (built bundle) | S | release_check bundle-current check |
| `docs/`, `management/`, `contracts/`, `*.md` | none | `release_check.py` + `test_docs_config_consistency.py`, `test_version.py`, `test_release_notes_marker.py` |
| more than 400 changed files | L | `select_tests.py` MAX_FILES |

A version-only bump (`__version__`, Dockerfile label, `config.yaml`) is ignored by selection, as in `select_tests.py`.

## 4. Test families (changed path to test group)

Counts are the files whose NAME carries a family word, measured by `tier_domain_map.py report` on `256205472` (559 backend test files,
671 Playwright specs). A file can sit in several families. Regenerate with `python scripts/gate/tier_domain_map.py report`.
The words per family are the `DOMAINS` table in that script; no test name below is invented, and the full file lists come from
`ls smplwise_vms/backend/tests/test_*.py` filtered by those words.

| Family | Product paths (regex heads) | Backend tests | Specs |
|---|---|---|---|
| tickets | `routers|services/tickets*`, `frontend/src/tickets/`, `public-ticket/` | 101 | 112 |
| access control / doors | `services|routers/access*, door*, bulk_people`, `frontend/src/access-control/`, `access-external/` | 33 | 68 |
| wiskey / intercom / service identity | `services/intercom*, wiskey*, service_identity`, `frontend/src/wiskey/` | 39 | 35 |
| temperature | `services|routers/temperature*`, `frontend/src/temperature/` | 3 | 3 |
| energy / electricity | `services/energy*, bill_pdf*`, `frontend/src/electricity/` | 13 | 17 |
| generator | `services|routers/generator*`, `frontend/src/generator/` | 3 | 5 |
| elevators | `services|routers/elevator*`, `frontend/src/elevators/` | 3 | 5 |
| recorders / playback / NVR | `services|routers/nvr*, recorder*, playback*, recordings, go2rtc, stream_codecs` | 53 | 41 |
| frigate | `services|routers/frigate*` | 13 | 8 |
| plans / maps / 3D | `services/plan_*, geometry*`, `routers/plan*`, `frontend/src/map/`, `screens/explore-*` | 57 | 90 |
| media / cast | `services|routers/media*, cast*, ma_direct`, `screens/media-*` | 27 | 31 |
| notifications / messaging / push | `services|routers/notify*, messaging*, announce*, mobile_*, push*, presence`, `frontend/src/messaging|pwa/`, `services/push-relay` | 28 | 35 |
| automations / schedules | `services|routers/automation*, schedule*, rules, switch_protection*` | 37 | 25 |
| alarm | `services|routers/alarm*` | 2 | 1 |
| devices / Home Assistant | `services|routers/devices, device_*, ha*, home_*`, `screens/devices-*, home-*` | 34 | 41 |
| settings / navigation / tabs | `frontend/src/shell/`, `screens/settings*`, `services/tabs_mode, user_prefs, nav_size`, `routers/settings, me` | 13 | 51 |
| identity / auth / secrets | `services/local_*, webauthn, second_factor, secrets_store, signing, revocation` | 46 | 20 |
| backup / update / setup | `services/backup*, self_update, update_runs, setup_wizard, bundle` | 27 | 12 |
| wall / live | `services|routers/wall*`, `screens/live-*, kiosk-*` | 11 | 43 |
| investigate (events / cases / search) | `services|routers/events*, cases, exports, search, semantic, rules`, `screens/investigate-*` | 28 | 25 |
| design / skins / accessibility | `frontend/src/design|styles|components/` | 9 | 136 |
| health / storage / database | `services/health_report, storage, thumbnails, process_stats` | 23 | 5 |
| bridge (custom_components) | `custom_components/` | 18 | 9 |
| gate tooling | `scripts/gate/` | 22 | 0 |

Run a family on the runner (tier M batch) with the real file names, never a typed list:

```
cd ~/work/<worktree> && ls smplwise_vms/backend/tests/test_*.py | grep -i -E 'ticket|rfq|cr038|tk2|vendor|portal|public_ui|mgrdash|qvalid' > /tmp/family_be.txt
```

## 5. What always runs, whatever the tier

From `select_tests.py` (constants, not copied by hand): the smoke set `test_migrations.py`, `test_smoke_after_upgrade.py`,
`test_gate_hygiene.py`, `test_health_summary.py`, `test_health_report.py`, `test_backup.py`, `test_release_check.py`, `test_db_gate.py`,
`test_db_template.py`, `test_gate_speed.py`, `test_select_tests.py`; every `unit-*` spec, `evidence-nav*` and `layout-shell*`; EVERY
security/permission suite in full (file names matching `security|rbac|perm|auth|secret|csrf|privacy|scope|role|passkey|webauthn|login|session|ingress|grant|harden|poc`);
every test file added or modified in the diff; `scripts/release_check.py`; tsc; the visual matrix (warning) unless `--no-visual`.
TEST_POLICY adds: a security review for security-relevant changes, and a nightly full run on main.

## 6. What a tiered gate saves (honest numbers)

| Release kind | Typical diff | Policy tier | Expected wall (model, v2) | Basis |
|---|---|---|---|---|
| UI-only fix, no shell/design change | 7 of the 21 branches of the 2.9.2 + 2.9.3 trains | S | backend about 15 min, frontend 26-92 percent less than full | `GATE_SPEED.md` 5.2 table (2.9.2/2.9.3 branches) |
| service change, no migration | 6 of those 21; in the 2.10.0 train 15 of 38 branches selected 80 percent or less of the backend files | S or M | backend 13-15 percent less; frontend 80-92 percent less | same |
| migration, rbac/roles, nav/shell, design tokens, main.py | 4 branches of 38 full on both sides; whole releases | L | v2 85-95 min (model) instead of 138-186 | `GATE_SPEED.md` section 2; NOT measured on the runner |

Do not read the "S" rows as a promise for the next release: a point release such as 2.10.1 can still pull a migration or a
shell change and then it is L.

## 7. Not mapped, and risks of this map

Unmapped by name (no family word): 41 backend test files and 58 specs; the generated list is in
`docs/release/GATE_TIERS_V2_UNMAPPED.txt` (regenerate: `python scripts/gate/tier_domain_map.py report --unmapped`). They are still run
by the full tier and reached by the import closure under selection. Notable groups that no family names: `owner-round1..11`
evidence specs, `unit-walk-*`/`unit-studio*` (3D walk and studio, partly in "plans / maps / 3D" by other words), `unit-public-*`
(public portal), and a handful of backend infrastructure files.

Paths with no test at all in the gate: `mobile/android-shell/` (and `mobile/ios-shell/`, which is untracked in the main checkout), `services/push-relay/`,
`scripts/` other than `scripts/gate/` and the scripts a test imports. Owner decision needed whether any of them should be gated.

Selection risks (from `GATE_SPEED.md` 5.2, unchanged): dynamic dependencies, specs that reach a component only through a route,
data/text coupling across features, f-string API paths, and order effects between tests. The safety net is the nightly full run on
main and `select_tests.py audit`, which lists every nightly red that a selection run had dropped. Selection must not become the default
for release gates until the acceptance criteria in `GATE_V2_ROLLOUT.md` section 7 hold.

## 8. Reading the other documents

- Install, verify, rollback, shadow run, acceptance criteria, nightly schedule: `docs/release/GATE_V2_ROLLOUT.md`.
- Seed quarantine register (what qualifies, what does not, and why the live list stays empty today): `docs/release/GATE_QUARANTINE_SEED.md`.
- Engine behaviour and knobs: `docs/release/GATE_SPEED.md` sections 1-7 and `scripts/gate/INSTALL_ON_RUNNER.md`.
