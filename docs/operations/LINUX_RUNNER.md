# Linux test runner (Ubuntu 24.04 LTS)

The suites were written and run on a Windows workstation. This page is what a Linux (or macOS) machine needs to run
the SAME tests, how to run them, and which results are platform dependent. Nothing here changes how Windows runs.
The audit behind it is in the "Portability audit" section at the end.

## 1. What the runner needs

```bash
sudo apt update
sudo apt install -y git python3.12 python3.12-venv python3-pip build-essential \
    ffmpeg poppler-utils fonts-noto fonts-noto-core fonts-noto-color-emoji fonts-liberation fonts-dejavu-core \
    curl ca-certificates unzip iproute2
```

| Need | Why | Notes |
| --- | --- | --- |
| Python 3.12 + venv | backend and its tests (`requires-python >= 3.12`) | Ubuntu 24.04 ships 3.12 |
| `pytest`, `pymupdf` | tests only; NOT in `requirements.txt` | install next to the backend requirements |
| `ffmpeg` (with libx264 + mp2) | `test_exports.py` builds an MPEG-PS sample; export / frame / thumbnail services shell out to it | the Ubuntu package has both encoders |
| `poppler-utils` | `pdftoppm` as a PDF rasteriser: part of the add-on image (see `docs/security/DEPENDENCY_AND_SECRETS_AUDIT.md`); the Python tests use `pymupdf` instead | optional for the test runner, harmless to install |
| Node 24 LTS | frontend build (`tsc`, `vite`), Playwright, the Lovelace card behaviour test | install with fnm (`curl -fsSL https://fnm.vercel.app/install \| bash; fnm install 24`) or NodeSource; `SW_NODE=/path/to/node` overrides the lookup used by `test_lovelace_card.py` |
| Google Chrome stable | only for `SW_CHROME=1` runs (H.264 live video evidence) and `playwright.guide-live.config.ts` | `npx playwright install chrome` (needs sudo) or the official `.deb`; bundled Chromium cannot decode H.264 |
| Playwright Chromium + OS libs | every normal spec | `cd frontend && npx playwright install --with-deps chromium` |
| fonts-noto | Hebrew (RTL) text; see section 5 | without a Hebrew-capable font every Hebrew label renders as tofu and layout assertions shift |
| `ss` (iproute2) or `lsof` | `scripts/dev_cleanup.sh` finds dev servers by listening port | |

Locale and time zone do not need setting: Playwright forces `he-IL` / `Asia/Jerusalem`, the backend uses UTC and
IANA zones through the `tzdata` package (a requirement, so it does not depend on the OS database).

### One-time setup

```bash
git clone <repo> smplwise && cd smplwise            # .gitattributes keeps LF; no autocrlf setting is needed on Linux
python3.12 -m venv .venv
.venv/bin/pip install -r smplwise_vms/backend/requirements.txt pytest pymupdf PyYAML
cd frontend && npm ci && npx playwright install --with-deps chromium && cd ..
python3 scripts/venv_python.py                       # prints the interpreter the helpers will use
```

`scripts/venv_python.py` returns `.venv/Scripts/python.exe` on Windows and `.venv/bin/python` on Linux/macOS
(`SW_VENV` points it at a venv kept outside the checkout). The shell helpers below use the same rule; set
`SW_PYTHON=/path/to/python` to override.

## 2. Backend tests: two shards

`scripts/run_backend_shard.sh K N` lists `smplwise_vms/backend/tests/test_*.py` in sorted (C-locale) order and runs every
N-th file starting at the K-th, so `1 2` and `2 2` cover each file exactly once without a plugin.

```bash
scripts/run_backend_shard.sh 1 2 2>&1 | tee backend_a.log      # in parallel with the next one, or one after the other
scripts/run_backend_shard.sh 2 2 2>&1 | tee backend_b.log
```

Extra arguments go to pytest (`-x`, `-k`, `--maxfail=5`). The shards use `-p no:cacheprovider` and the repo's
`addopts = -q`. Tests build their own temporary data directories, so running the two shards at the same time on one
machine is expected to work, but that has not been verified on Linux: if a shared fixed port ever collides, run the
shards one after the other. On a shared developer box keep fixed ports out of 4175-4180, 5181, 5190-5234, 8099 and 8348.

Timing-sensitive tests have two knobs (see `smplwise_vms/backend/tests/README.md`): `SW_TEST_TIME_FACTOR=2` on a slow
or shared runner, `SW_PERF=1` only on a quiet machine. A CI runner should set the factor, not `SW_PERF`.

Skipped, not failed, by design: `test_card_behaviour_in_node` when no `node` is found, `test_db_lock_storm.py` and
`tests/soak/` unless `SW_PERF=1` / `SW_SOAK=1`. POSIX file-mode assertions (`0o600` key file, kept mode of
`automations.yaml`) run on Linux and are skipped on Windows, so Linux covers more there.

## 3. Playwright

Two passes, because some specs import `/src/...` modules directly and therefore need Vite's dev server rather than the
built bundle.

```bash
cd frontend
npm run build                                      # tsc --noEmit + vite build -> dist/

# Pass 1: the built bundle (default). playwright.config.ts starts `npm run preview` itself on the SW_BASE_URL port.
SW_BASE_URL=http://127.0.0.1:4173/ npx playwright test --reporter=list 2>&1 | tee ../pw_preview.log

# Pass 2: the Vite dev server, for the specs that import /src (tabs-pair, tabs-dropdown, layout-bubble, media-remote,
# media-queue, media-player-panel, bubble-foundation, ...). Start it, run the specs, stop it.
npx vite --host 127.0.0.1 --port 5173 &  DEV=$!
SW_BASE_URL=http://127.0.0.1:5173/ npx playwright test tabs-pair tabs-dropdown layout-bubble media-remote media-queue media-player-panel bubble-foundation
kill $DEV
```

Both passes run all three projects (desktop 1440, tablet 1024, mobile Pixel 7 at 390). Live-backend specs
(`SW_LIVE=1`) additionally need `python -m smplwise` running with a throwaway data dir plus the fixture server named in
the spec header (`<venv-python> frontend/tests/fixtures/<name>_fake_ha.py`); they are not part of the default runner
pass. Evidence PNGs are written under `docs/` and `private-evidence/` (the latter is gitignored): a CI job should
treat them as artifacts, not commit them.

Cleanup after a run (stops only listeners on the ports you name, and temp dirs of Playwright older than an hour):

```bash
scripts/dev_cleanup.sh --ports "4173 5173"         # add --stop-backend for 8099, --dry-run to preview
```

Disk retention on the shared runner (gate scratch, per-branch worktrees under `~/work`) and the cleanup script are described in
`scripts/gate/INSTALL_ON_RUNNER.md`, section "Retention and disk housekeeping".

## 4. Cron / GitHub Actions

A nightly job is the two shard commands plus the two Playwright passes above. Skeleton for a self-hosted runner:

```yaml
on: { schedule: [{ cron: "0 2 * * *" }], workflow_dispatch: {} }
jobs:
  backend:
    strategy: { matrix: { shard: [1, 2] } }
    runs-on: [self-hosted, linux]
    steps:
      - uses: actions/checkout@v4
      - run: python3.12 -m venv .venv && .venv/bin/pip install -r smplwise_vms/backend/requirements.txt pytest pymupdf PyYAML
      - run: SW_TEST_TIME_FACTOR=2 scripts/run_backend_shard.sh ${{ matrix.shard }} 2
  ui:
    runs-on: [self-hosted, linux]
    steps:
      - uses: actions/checkout@v4
      - run: cd frontend && npm ci && npx playwright install --with-deps chromium && npm run build
      - run: cd frontend && npx playwright test --reporter=list
      - if: always()
        run: scripts/dev_cleanup.sh --ports "4173 5173"
```

## 5. Known platform differences

* **Pixel baselines.** `evidence-design-foundation.spec.ts` ("classic is pixel-stable", `maxDiffPixels: 0`) compares against
  PNGs stored with Playwright's platform suffix (`...-win32.png`). Linux has no baseline, so those eight checks are now
  SKIPPED with the reason "no linux baseline yet" instead of failing on a missing file. Browser, font and
  text-shaping differences make a zero-pixel diff impossible to share between operating systems, and the check already
  fails on the Windows workstation when its renderer or fonts move. Recommendation: on the runner, generate its own
  baselines once (`npx playwright test evidence-design-foundation --update-snapshots`, commit the `-linux.png` files), pin the runner image (Chrome and
  font packages) so they stay stable, and optionally loosen to `maxDiffRatio: 0.002` for the runner only. The matrix
  screenshots in the same spec are evidence, not assertions, and run everywhere.
* **Fonts.** The UI and generated SVG/HTML name Heebo, Arial, Helvetica and `Segoe UI` with generic fallbacks. On Linux
  those resolve to Liberation / Noto; text widths differ slightly from Windows, so specs that assert exact widths or
  that wrapped text fits (rather than ranges) can differ by a pixel or two. Install `fonts-noto` and `fonts-liberation`
  as listed; a missing Hebrew font is the usual cause of mass layout failures.
* **Chrome channel.** Normal specs use Playwright's bundled Chromium. `SW_CHROME=1` and
  `playwright.guide-live.config.ts` use `channel: 'chrome'` (system Google Chrome, needed for H.264 live video); on a
  headless server install Chrome stable and run with `xvfb-run` only if a spec opens a headed window (none of the
  default specs do).
* **Line endings.** The repository is LF-only (`.gitattributes`: `* text=auto eol=lf`; no tracked file is CRLF). The
  CRLF strings in tests are protocol data (SMTP, multipart, SDP, DXF) and are the same everywhere. One clipboard
  assertion normalises CRLF to LF, harmless on Linux.
* **Windows-only helpers.** `scripts/dev_cleanup.ps1` is replaced by `scripts/dev_cleanup.sh`; `scripts/load_probe.py` now
  reads `/proc` instead of PowerShell on POSIX; `tests/soak/soak_local.py` already has a `/proc` branch.
* **Permissions.** Tests that check file modes (`0o600`) run only on POSIX; on a runner that mounts the checkout from a
  Windows or FAT/NTFS volume they would fail, so keep the workspace on ext4 / APFS.
* **Case sensitivity.** All relative TypeScript imports and `smplwise*` Python imports match file names exactly
  (checked mechanically, 0 mismatches); no two tracked paths differ only by case.

## 6. Portability audit (what was found and changed)

| Finding | Where | Action |
| --- | --- | --- |
| Hard-coded `.venv/Scripts/python.exe` in run instructions | header comments of `frontend/tests/fixtures/*_fake_ha.py`, `setup_fake_devices.py`, `nvr_less_backend.py`, `notify_live_fake.py`, four `frontend/tests/evidence-*.spec.ts` headers, `scripts/lab/nvr_probe.py`, `mobile/android-shell/tools/make_icons.py` | replaced with `<venv-python>`; added `scripts/venv_python.py` |
| Windows-only `powershell Get-CimInstance` probe | `scripts/load_probe.py` | POSIX branch reading `/proc` |
| fnm lookup only under `%APPDATA%` and `node.exe` | `smplwise_vms/backend/tests/test_lovelace_card.py` | also `~/.local/share/fnm`, `~/Library/Application Support/fnm`, `bin/node` |
| Hard-coded `C:/cloude/...` worktree | `docs/evidence/automations-mockup/shots.mjs` | defaults to the checkout containing the script |
| `-win32` pixel baselines only | `frontend/tests/evidence-design-foundation.spec.ts` | skip when no baseline for this platform exists (unless `--update-snapshots`) |
| No bash cleanup / shard runner | `scripts/` | added `dev_cleanup.sh`, `run_backend_shard.sh`, `venv_python.py` |
| Already portable (no change) | `guide_live_capture.py` (`npx.cmd` only when `os.name == "nt"`), `soak_local.py`, `test_alarm.py`, `test_bridge_config_store.py` (platform-guarded), every `subprocess` call in tests (`sys.executable`), Playwright specs (`path.resolve` with relative segments), `frontend/package.json` scripts | none |
