# RELEASE-2460-TRAIN - the 2.46.0 train

Branch `release/2460-train`, cut from `origin/release/2450-train` at `521165ad4` (the 2.45.0 rebuilt UI, before its gate fixes) on
20.11.2026 (~00:50 Israel) in the worktree `C:\cloude\smplwise-2460train`. Owner standing rule (18.11 night): one train and one release
gate per version, fix forward with targeted re-runs. The 2.45.0 train was in fix-forward while this train was assembled; `v2.45.0`
(95ff81727) was merged in as soon as the lead released it.

## 1. Before the merges - CR-CMP2-TABS-2460 Linux baselines

The row's runner job (`~/work/tabs2460-run.sh e46a04ceb`, after the 2.45.0 gate, `nice -n 19`, `--workers=1`) had finished:
check 120 passed / 39 skipped / 6 failed + visual-matrix 9 passed / 6 failed - every failure a screenshot comparison; update 48 passed;
new specimen 4 passed; verify without `-u` 48 passed / 18 skipped and 8 passed. Every changed image was looked at old vs new (crops of the
difference box): the events centre chip rows (accent-filled chips with count pills), the plan wizard's devices / cameras strip (the
standard 28 px pill with icon and count pills), devices schedules (the kinds strip on `sw-tabs`; desktop / tablet: lighter unselected
labels, a narrower strip, the list 1 px lower; phone: equal-width tabs). All intended; committed into the branch as `19019064b`
(13 refreshed, 4 new `pixel-sw-tabs`) and pushed before the merge.

## 2. What merged (in this order)

| # | Branch | Head | Merge | Conflicts |
|---|---|---|---|---|
| 1 | `pilot/CR-ROUTER-SQL-C-2450` | d228cb84c | 44d5c028f | none |
| 2 | `pilot/CR-ROUTER-SQL-D-2460` (based on ROUTER-SQL-B, already in 2.45.0) | 794f79233 | b02ecf3a8 | none |
| 3 | `pilot/CR-ROUTER-SQL-HA-2450` | 2fe8870f5 | 18f031129 | none |
| 4 | `pilot/CR-IFC-SPLIT-2460` | 85b816176 | 069e9f44e | none |
| 5 | `pilot/CR-SINGLETON-RESETS-2460` | 1f9ba5c01 | 6777deca5 | none |
| 6 | `pilot/CR-ROUTE-CHAR-2460` | 345bea645 | 24e79dc2a | none |
| 7 | `pilot/CR-CMP2-GEN-REST-2460` | e2e485012 | 7b2d8e206 | none (it was based on TABLES-CONSUMPTION, so `sw-table` already had the foot row) |
| 8 | `pilot/CR-CMP2-TABS-2460` (with the baselines of section 1) | 19019064b | 30b776cdb | none |
| 9 | `pilot/DOCS-RELNOTES-2480` (docs only) | 517282166 | ab5568c2d | none |
| 10 | `pilot/CR-BRIDGE-BUMP-RATCHETS-2460` (bridge 0.10.8, exact design ratchet, entry-chunk budget) | 10332de2a | f253a1b62 | none |
| 11 | `origin/main` = tag `v2.45.0` (the 2.45.0 gate fixes) | 95ff81727 | 951a20767 | none |
| 12 | `pilot/FIX-SINGLETON-READBACK-2460` (lead's addition) | 6a4523308 | 25e467516 | none |
| 13 | `pilot/CR-BE-FOLLOWUPS-2470` (lead's addition "only if it merges cleanly"; based on IFC-SPLIT + 2450) | d336c0ace | 16beb26e2 | none |

Every head was checked against `origin` before its merge. No textual conflict anywhere (the expected ones in
`singletons_unregistered.txt`, `gen_wire_types.py`, `savepoints.py`, `sw-table.ts` did not occur: the rows touched different lines).

## 3. Design ratchet on the merged tree (after merge 10, again after merge 13)

`py -3.12 scripts/design_ratchet.py` against the bridge row's exact baseline (taken at 521165ad4): **color-literal 2499 > 2497**,
**px-literal 25501 > 25495**; the other six at or below (`--base 521165ad4` lists the files that went up).

| Metric | Decision |
|---|---|
| color-literal +2 | new code (TABS, `screens/automation-editor-css.ts`): the sw-tabs mapping repeated the literal fallbacks of `--ab-seg-thumb` / `--dv-shadow-control`, both always defined where the strip renders (editorTokens on the editor host; the device-test body is light DOM in the editor's shadow root; the devices theme layer). **Fixed**: fallbacks dropped (pixel-neutral) -> 2497 = baseline |
| px-literal +6 (+4 after the fix, +5 after merging v2.45.0) | new knob defaults of this train's shared components (sw-chip-choice count pill +5, sw-load-bar +2, sw-table group band / keep-columns +7, sw-tabs pill / key +5, glass / editor key heights, events chip size) less the removed hand-built rules, plus one line of the released 2.45.0 fix forward (`temperature/report.ts` `--sw-seg-h: 44px` on a phone). The design layer has no fixed spacing scale (`--sw-gap`, `--sw-r-pill` vary per look), so a token swap would move pixels. **Baseline raised to the merged count only: 25495 -> 25500** (`--update --allow-raise`, then the one released line) |
| native-table 78 -> 75, hand-switch 361 -> 359 | lowered to today's counts |

Commit fb9615d63.

## 4. Fix commits on the train

| Commit | What |
|---|---|
| fb9615d63 | design ratchet (section 3) |
| b248252f3 | unused-exports baseline: one entry no longer on a list pruned (`src/map/still-bake.ts#VARIANTS`; `--update-baseline`, file-local 54 -> 53) |
| (this note's commit) | merge interaction ROUTE-CHAR x BE-FOLLOWUPS: `test_route_char_2460::test_patch_a_site` pinned the old untrimmed site name in the `site.update` audit row; BE-FOLLOWUPS makes the edit trim like create (its intended fix). The characterisation now expects the trimmed name in the answer and the audit row |

## 5. Tests actually run before the gate

Python 3.12 (main checkout `.venv`; `py -3.12` for ruff and the scripts, `PYTHONUTF8=1`), Node 24.21.0, `frontend/node_modules` junction to
the main checkout. The workstation ran at 100 % CPU (other agents) the whole time, so the unit suite ran on the idle runner instead.

| Check | At | Result |
|---|---|---|
| `py -3.12 scripts/design_ratchet.py` | f253a1b62 / 16beb26e2 / fb9615d63 | UP color +2, px +6 / px +5 after the fix / **ok** (section 3) |
| `scripts/sync_integration.py --check`, `scripts/gen_wire_types.py --check` (`.venv`) | f253a1b62 | up to date / exit 0 |
| `ruff check smplwise` (ruff 0.17.5), `scripts/gate/lint_backend.py --gate` | f253a1b62 | All checks passed; 0 findings |
| `npx tsc --noEmit -p tsconfig.json` / `tsconfig.tests.json` / `tsconfig.scripts.json` | f253a1b62 and fb9615d63 | exit 0 / 0 / 0 (both times) |
| ESLint `eslint src --pass-on-unpruned-suppressions` | fb9615d63 | exit 0 |
| `node scripts/unused-exports.mjs --enforce` | fb9615d63 | OK (one stale baseline entry -> pruned b248252f3) |
| `node scripts/i18n-split-langs.mjs` | fb9615d63 | nothing moved (tree clean) |
| `scripts/api_inventory.py` | ebc43c5da | 1910 routes (unchanged) |
| `scripts/release_check.py` | ebc43c5da | only `[FAIL] git tag v2.46.0 not yet`; RESULT: ready for the owner's approval |
| Runner (`~/work/t2460-train`, `nice -n 19`): Playwright unit config, all `unit-*.spec.ts`, workers 2, retries 1 | ebc43c5da | **5067 passed, 10 skipped, 0 failed, 0 flaky** (2.4 min) |
| `bundle-budget.mjs --dir ../smplwise_vms/www --enforce` (the built UI) | d2805ac5e | entry raw 2,819,864 B, gzip 810,373 B; budget 849,000 / 2,951,000 (lowered by the bridge row) - OK; 0 `.map` |
| backend guard set, first run (`-p no:xdist`; 20 files: singletons, build guards, SQL boundary, wire route coverage, both route-char files, IFC x3, blueprints x2, switch-protection reach, wire routers B, version, release-notes marker, router helpers, setting callers, async routes, golive check, db gate) | 16beb26e2 (version bumped during the run) | 2 failed: `test_version::test_versions_agree` (the version files changed under the running test - not a defect) and `test_route_char_2460::test_patch_a_site` (merge interaction, fixed above). The count line was hidden (`-q` twice) |
| backend guard set again (21 files, + `test_catalog`) | GUARDS_SHA | GUARDS_RESULT |

## 6. Version and built UI

| Commit | What |
|---|---|
| ebc43c5da | release: 2.46.0 - version (`config.yaml`, `Dockerfile`, `smplwise/__init__.py`), CHANGELOG (bilingual, with the bridge Install line of CR-BRIDGE-BUMP-RATCHETS-2460 section 1.2), API inventory regenerated (`scripts/api_inventory.py`: 1910 routes, unchanged; only the version line). No migration (0216 stays the last). Bridge 0.10.8 |

## 7. Release gate

GATE_PLACEHOLDER

## 8. Release - NOT done by this agent

Main push, tag `v2.46.0`, `#addon` refresh, the lab install and the ONE Home Assistant Core restart for bridge 0.10.8: the lead runs them
(owner pre-approved 2.46.0 including one HA restart). Lab steps: `docs/changes/CR-BRIDGE-BUMP-RATCHETS-2460.md` section 1.1.
