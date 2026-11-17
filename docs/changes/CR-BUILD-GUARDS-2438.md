# CR-BUILD-GUARDS-2438 - debug maps stay on the runner; design-debt ratchet in the release check

Branch `pilot/CR-BUILD-GUARDS-2438`, cut from `origin/main` 0a8fb55e1 (v2.43.5). Owner decisions round 32 (14.11):
Q-CODE-3 / O3 **a** (stop shipping the source maps, keep them per release on our side) and Q-CODE-4 **a** (an automatic design
regression guard now, as a ratchet). No product source file changes; no pixels.

**Base: `origin/main`, not `origin/pilot/CR-WAVE1-COMBINED-2436`.** CR-FE-GATES-2436 measures ESLint warnings, the entry budget,
client-to-inventory and unused exports; none of its code counts design debt (colours, px, native controls, scrolling), so the
guard does not build on it. It is a standalone Python script with no new dependency.

## 1. Source maps (review 07:F7)

- `frontend/package.json`: `build:addon` ends with `node scripts/sourcemaps-archive.mjs`. `npm run build` (dist, the gate's
  preview, `bundle-budget.mjs --dir dist`) is unchanged and keeps its maps; `vite.config.ts` is not touched.
- new `frontend/scripts/sourcemaps-archive.mjs`: after the two Vite builds it moves every `.map` out of `smplwise_vms/www` and
  `www-public` into `<archive>/<version>/` (same relative paths), removes the trailing `sourceMappingURL` comment from every JS / CSS
  file (no 404 in the browser's dev tools), and writes `MANIFEST.json` (version, commit, time, per map its bytes and the sha256 of
  the shipped file it belongs to). Archive: `--archive` / `SW_SOURCEMAP_ARCHIVE`, else `~/smplwise-results/sourcemaps` when
  `~/smplwise-results` exists (**the runner**: the `~/build_ui*.sh` release scripts call `npm run build:addon`, so the maps land in
  `~/smplwise-results/sourcemaps/<version>/` with no script change), else `frontend/.sourcemaps` (gitignored). A rebuild of the same
  version replaces that version's folder; an empty run (nothing to move) leaves the archive alone. About 36 MB per release.
- new `smplwise_vms/.dockerignore`: `www/**/*.map`, `www-public/**/*.map` (second line of defence for a hand-made build).
- `scripts/release_check.py`: new check **"no debug source map shipped in the add-on (www, www-public)"** - fails on any `.map` file
  or a JS / CSS file whose tail still names one. It runs in every release gate and entry check (release_gate.py runs
  release_check.py of the branch under test), so nothing on the runner had to be installed.
- The committed `smplwise_vms/www` of 2.43.5 was put into the shipped shape with the same script: 248 `.map` files removed
  (36,260 KB), the comment line removed from 248 JS files (one deleted line each; no other byte changed). The 2.43.5 maps were not
  archived (that release is out; they stay in git history).

Effect on CR-FE-GATES-2436 (`bundle-budget.mjs`, report-only, on the wave-1 branch): its default folder `smplwise_vms/www` has no
map any more, so its deny-list part has to read `--dir dist` (after `npm run build`) or the archive. Follow-up for
CR-FE-GATES-ENFORCE.

## 2. Design-debt ratchet (owner Q-CODE-4 a)

- new `scripts/design_ratchet.py` + baseline `scripts/design_ratchet_baseline.json`. String scans of `frontend/src/**/*.ts|css`
  after comments are removed; the counts are totals per metric:

| Metric | What is counted | Exempt | Baseline |
|---|---|---|---|
| color-literal | hex, `rgb()/rgba()/hsl()/hsla()` | `src/design/`, `src/fixtures/`, `*-mock.ts` | 2,510 |
| px-literal | `<n>px` | same | 25,763 |
| undefined-token | `var(--sw-x)` with no fallback, `--sw-x` defined nowhere in src | - | 14 (exactly the review's 07:F9 list) |
| native-dialog | `window.confirm/alert/prompt`, and bare calls in expressions | - | 20 |
| native-select | `<select` | - | 582 |
| native-table | `<table` | `components/sw-table.ts` | 109 |
| hand-switch | `role="switch"`, `type="checkbox"` | `components/sw-toggle.ts` | 378 |
| scroll-container | `overflow(-x/-y): auto/scroll` | - | 230 |

- **Blocking only on the ratchet**: the check fails when a total is above its baseline. Equal or lower is green; lower prints
  "lower the baseline with --update". `--update` only lowers; raising needs `--update --allow-raise` (an owner-approved exception,
  visible in the baseline diff). On a failure the report names the files changed since the merge base with `origin/main` whose
  count grew (`screens/x.ts 3->4`).
- Wiring: `scripts/release_check.py` check **"design-debt ratchet (no count above scripts/design_ratchet_baseline.json)"**, so it is
  blocking in the runner entry check and the release gate (both run release_check.py of the branch); report-only metrics of
  CR-FE-GATES stay report-only.
- Totals, not per file: a branch may move debt between files; per-file baselines would conflict in every merge.
- Pending combined branches, measured with this baseline (their `frontend/src` via `git archive`): `AUDIT30-COMBINED-2435`,
  `CR-WAVE1-COMBINED-2436`, `CR-WAVE1B-COMBINED-2436` - all at or below every count (they lower colour, px, select and scroll).
  After they merge, `--update` locks the lower numbers in.
- Time: about 35 s for the scan on the loaded workstation (release_check's gate timeout is 300 s); cached per root in one process.

## Tests actually run (workstation, Python 3.12 main checkout `.venv`, Node 24.21.0)

| Command | Result |
|---|---|
| `node --test scripts/sourcemaps-archive.test.mjs` (from `frontend/`) | 5 passed |
| `pytest -p no:xdist tests/test_build_guards_2438.py tests/test_release_check.py` (from `smplwise_vms/backend/`) | 13 passed |
| `py -3.12 scripts/release_check.py` | all ok (the two new checks ok); RESULT ready |
| `py -3.12 scripts/design_ratchet.py` | exit 0, every count = baseline |
| `npx tsc --noEmit` | see the commit report (no TypeScript file changed) |

## NOT_RUN

- `npm run build:addon` end to end (heavy; the workstation rule). The post-step was run on the committed `www` and in the unit
  test; the first real run is the next release build on the runner - check that `~/smplwise-results/sourcemaps/<version>/` appears.
- Supervisor image build with the new `.dockerignore`: runs in the entry check's `addon_build` stage.
- Full suites: the runner entry check.
