# RELEASE-2470-TRAIN - the 2.47.0 train

Branch `release/2470-train`, cut from `origin/main` = tag `v2.46.0` (`407e1b13e`) on 22.11.2026 (~10:00 Israel) by the lead in the
worktree `C:\cloude\smplwise-2470train`. Owner standing rule (18.11): one train and one release gate per version, fix forward with
targeted re-runs. Owner N63 (22.11 ~09:00, "כן, לאשר מראש"): the 2.47.0 publish (main, tag, `#addon`, lab install + read-only probe)
is pre-approved after a green gate; the held look rows (CMP2-POLISH `1a2c9401d`, SEG-MODULE-LOOK `45a37ae49`) are not on this train
and no home-system restart is covered.

## 1. What merged (in this order)

| # | Branch | Head | Merge | Conflicts |
|---|---|---|---|---|
| 1 | `pilot/CR-RESPONSE-MODELS-C-2470` | bf90fad19 | ecc707dd1 | none |
| 2 | `pilot/CR-RESPONSE-MODELS-D-2470` | ba299bcf4 | aa9726fdc | `frontend/src/api/access.ts`: both rows added generated-type imports at the same place - kept all six, sorted by path |
| 3 | `pilot/CR-FIELD-UNIT-2470` | 527135aeb | ab698eaaf | none |
| 4 | `pilot/CR-CMP2-TABLES-REST-2470` | 32c09b391 | 2c211966d | none |
| 5 | `pilot/CR-HOME-V3-SEGMENTS-2470` (after the runner pixel check, section 2) | 104de9844 | 4b2957ca8 | `frontend/tests/unit-sw-segmented.spec.ts` ADOPTED list: kept the train's newer CR-CMP2-TABS-2460 comment for `home-edit-bv1` / `sw-home-personal` plus `tickets-overview`, added the row's `home/sw-home.ts`, `home/home-p3.ts`, `screens/home-widgets.ts` |
| 6 | `pilot/DOCS-RELNOTES-2480B` (docs only: user notes for 2.46.0 and 2.47.0) | 91e663d4e | 43da1064e | none; 56f5e7173 drops its "conditional" wording for the home choices (row 5 boarded) |

Every head was checked against `origin` before its merge. Row 5 was merged on a candidate branch (`cand/2470-home`) first and the
train fast-forwarded to it after the pixel check.

## 2. Pixel pre-check (owner speed-up 07.11) and baselines

`~/work/t2470px.sh home 4b2957ca8 4471` (the 2.45.0 `t2450px.sh` renamed, workers 4, no `-u`): every spec file with a `-linux.png`
baseline, all projects, at the candidate (train + HOME-V3-SEGMENTS): **821 passed, 6 failed, 520 skipped** (9.6 min). No home image
moved, so HOME-V3-SEGMENTS is pixel-identical and boarded. The 6 failures, each looked at old vs new:

| Spec / image | Cause | Decision |
|---|---|---|
| `evidence-intercom-ops` `intercom-ops-events-tables` 1440 / 390 | TABLES-REST: the anomalies and methods key / value tables gain a header row ("total"); on a phone the three tables keep their columns (`keep-columns`, in the train since GEN-REST 2.46.0) | intended - refreshed |
| `evidence-wiskey-installer` `installer-technical-confirm-box` 1440 / 390 | TABLES-REST: the change table on `sw-table`; on a phone it stacked into a long label / value list (the dialog grew 543 -> 797 px) | fixed forward (1af82bb64: the diff table takes `keep-columns`, a small figure grid like the intercom ones); refreshed: 3 columns on the phone again, 534 px |
| `pixel-wiskey-people-writes` `writes-cards-remove-ask` 1440 / 390 | FIELD-UNIT: `sw-field` draws the danger frame for a slotted input marked `aria-invalid` (also inside shadow roots); the person card number "bad number!" is marked invalid by the screen, so it now reads as wrong | intended (a correct error state, not a look change) - refreshed; listed for the owner |

The TABLES-REST branch's own runner baselines (`~/work/tablesrest-out1`) were NOT used: they were taken without `keep-columns`, so
their 390 px images show the stacked tables.

Refresh: `~/work/t2470upd.sh 1af82bb64` (`--update-snapshots=changed` on the three specs, then verify without `-u`): update 102 passed /
51 skipped; verify **102 passed, 51 skipped, 0 failed**. Committed as 34ad0085d (6 images).

## 3. Fix and housekeeping commits on the train

| Commit | What |
|---|---|
| 1af82bb64 | installer confirmation change table keeps its columns on a phone (section 2) |
| 34ad0085d | 6 refreshed Linux baselines (section 2) |
| 6179a3a8e | design ratchet lowered to the train counts: px-literal 25500 -> 25486, native-table 75 -> 58, scroll-container 229 -> 226 (nothing raised) |
| 66395d02a | release: 2.47.0 - version (`config.yaml`, `Dockerfile`, `smplwise/__init__.py`), bilingual CHANGELOG, API inventory (1910 routes, unchanged). No migration (0216 stays the last). Bridge unchanged (0.10.8) |
| 092bbc9a1 | release: 2.47.0 - rebuilt UI at 66395d02a (`~/work/build_ui2470.sh`, rc=0; 323 maps archived to `~/smplwise-results/sourcemaps/2.47.0`; tarball sha256 `22699a05...79f83d0447` checked after the copy; 0 `.map`, 0 `sourceMappingURL`) |

## 4. Checks run before the gate (workstation, Python 3.12, Node 24.21.0)

| Check | At | Result |
|---|---|---|
| `py -3.12 scripts/design_ratchet.py` | 2c211966d | no count above the baseline (color 2497, px 25486, native-select 551, native-table 58, hand-switch 359, scroll 226) |
| `scripts/sync_integration.py --check`, `scripts/gen_wire_types.py --check` (main `.venv`) | 2c211966d | up to date / exit 0 |
| `ruff check smplwise` | 2c211966d | All checks passed |
| `npx tsc --noEmit -p tsconfig.json` / `tsconfig.tests.json` / `tsconfig.scripts.json` | 2c211966d | exit 0 / 0 / 0 |
| `scripts/api_inventory.py` | 66395d02a | 1910 routes (unchanged) |
| `bundle-budget.mjs --dir ../smplwise_vms/www --enforce` (built UI) | 092bbc9a1 | within budget (gzip 37,120 B under 849,000; raw 126,159 B under 2,951,000); 0 `.map` |

Not re-run on the PC after the HOME-V3-SEGMENTS merge and the fix commit: tsc / unit (the gate runs them).

## 5. Release gate

`~/wait_gate_2470.sh` -> `GATE_EARLY_FAILFAST=continue GATE_TOTAL_SECS=12000 nice -n 10 ~/gate2/release_gate2.sh release/2470-train --full`
(base v2.46.0, full tier L with the full backend) on 092bbc9a1. Started after push_watch's entry check released the tests lock (the
lead set `~/.gate-pending` at 08:54 UTC so no new entry check starts).

| Run | At | Kind | Result |
|---|---|---|---|
| 1 | 092bbc9a1 | full | FAIL - machine overload (load up to 249: agent Playwright runs and stopped shards beside the gate; all agents then held off the runner) plus `unused-exports --enforce` (two `webauthn.ts` option types exported but unused after C / D) |
| 2 | 4d244a419 | full, alone on the runner (182 min) | FAIL on ONE real test: `layout-visdiff-246` settings-automations at 390 px - the TABLES-REST "who may" role matrix was 5 px wider than the phone. Everything else green (preview 23,050, dev 1,126, pixel 376, visual 72, backend 28,232; 75 failed once and passed alone) |
| 3 | 7d5476e92 | targeted `--after 4d244a419` | FAIL, run fault only: the fix touched a shared settings style, the selection grew to 371 specs + 141 backend files (planner ~71 min) but the derived targeted cap was 2,925 s (48 min); every failure is a timeout / missing report, 0 real failures |
| 4 | 7d5476e92 | targeted `--after 4d244a419`, `GATE_TOTAL_SECS=7200` | **PASS** in 61 min: tsc, build, fe_static, release_check, addon_build pass; preview 6,572, dev 289, visual 72, pixel 127, backend 3,832 passed; 0 real failures, 0 run faults; 6 failed once and passed alone (5 preview evidence specs on mobile / desktop / tablet, 1 backend `test_notices_security_295` cap test); max load 58.9. Report `~/smplwise-results/gate_release-2470-train_7d5476e92.gate2.md` |

Fixes between the runs:

| Commit | What |
|---|---|
| 4d244a419 | `frontend/src/arx/webauthn.ts`: the creation / request option types are file-local (`interface`, not exported) - `unused-exports --enforce` green |
| 1e38a5cf6 | role matrix on a phone: `sw-table.set-matrix` cell padding `10px clamp(var(--sw-s-1), 1vw, var(--sw-s-2))`, the four permission columns `min(72px, 16vw)` in `system-automations.ts`; desktop and tablet unchanged; ratchet px-literal 25486 -> 25485. Checked: layout + automations specs 73 passed on the runner, unit + tsc on the PC |
| 7d5476e92 | UI rebuilt at 1e38a5cf6 (sha256 `2d21f5fb...bbc27436fb` checked after the copy) |

Tooling note for later (not this train): the targeted cap (`derived_cap select`) ignores the planner's makespan; when a shared
style is touched the selection is near half the suite and the cap is too short. Run 4 sets the cap explicitly.

Selection note: run 4 did not run 10 heavy unchanged specs (deferred to the nightly full tier L on `main`) and mapped only 19 of 53
pixel specs; the full run 2 covered everything else at 4d244a419, and only 1e38a5cf6 (role matrix) + the UI rebuild changed since.

## 6. Publish

Gate green at 7d5476e92 (run 4). Published by the lead under the owner pre-approval N63: `scripts/release_check.py`, `main`
fast-forward + push, tag `v2.47.0`, the `addon` branch, lab install + read-only probe (`private-evidence/lab-1611/lab_check_2470_HE.md`).
