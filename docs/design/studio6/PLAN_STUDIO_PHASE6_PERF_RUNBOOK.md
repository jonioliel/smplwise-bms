# Plan Studio 6 — quiet-window performance measurement (R178, the lever table)

Task T089, acceptance AT178, CR-029 section 3.4 (budget and ladder), section 8 row S7, section 13.2 (frame timer).
Spec: `frontend/tests/evidence-plan-studio-6.spec.ts`, part 2 ("opt-in"). Owner checklist:
`PLAN_STUDIO_PHASE6_CHECKLIST_HE.md` (the real-phone row is the owner's, not this runbook's).

## What it measures

| Test | Project | What | Asserted |
|---|---|---|---|
| `R178: level 3 (realistic lite) ...` | `mobile` (390 x 844, DPR 2.625 emulated) | the 1,000-object demo floor at the realistic lite rung (the phone rung: textures, IBL, sun shadow 1024, MSAA x2 + bloom, DPR 1), the element filling the viewport, CPU throttled x4, presets iso and persp | median fps >= 30 at both presets |
| `the lever table: ...` | any (`mobile` for the phone table, `desktop` for 1440 x 900) | the same floor and timer per row: lite baseline; textures off (dial); normal maps off (harness); lamp shadow on (harness, strongest pool lamp, 512 px cube); realistic at DPR cap 1 / 1.25 / 1.5 / 2 (dial); full and schematic for reference | nothing (reported) |

The timer is `SceneView.benchFrames`: frames drawn back to back, each closed by a one-pixel `readPixels` so the GPU has
finished it (requestAnimationFrame is vsync-capped and cannot rank configurations). One warm-up block, then 12 blocks of 5
frames; the median block mean is the result. The readback adds a pipeline stall a real frame does not have, so the number
is conservative.

**It is a proxy, not a phone:** a workstation GPU at phone width with a throttled CPU. AT178 needs the owner's real-phone
row (checklist row 4) as well; a PASS here alone does not close AT178.

## Preconditions (a quiet window)

1. A machine **with a GPU**. The workstation qualifies: a dry run on 2026-10-11 reached `ANGLE (Intel, Intel(R) UHD
   Graphics ... Direct3D11 ...)` with the gate's launch switches. Playwright's bundled headless Chromium draws with
   SwiftShader otherwise (measured: `SwiftShader Device (Subzero)`), which the spec refuses. The shared Ubuntu runner has
   no GPU known to us: there the tests skip with "software WebGL" - do not use it for this.
2. Nothing else running: no release gate, nightly, soak sampler, other agents' Playwright or vite processes, no video
   playback, no Windows Update. Check `Get-Process node, chrome, msedge -ErrorAction SilentlyContinue`.
3. Laptop on AC power, power plan "Best performance", lid open, not on a soft surface (thermal throttling).
4. The spec decides "quiet" itself and skips otherwise, with the reason printed: CPU busy over 2 s <= 25 % (all platforms)
   and, where a load average exists (Linux / macOS), the 1-minute load per core <= 0.30. Raise the limits only knowingly
   (`SW_PERF_MAX_BUSY`, `SW_PERF_MAX_LOAD`); the record keeps the limits used.
5. The commit to measure is pushed; measure a clean checkout of it (a separate worktree), never a dirty tree.

## Commands (workstation, PowerShell)

```powershell
$env:Path = "$env:APPDATA\fnm\node-versions\v24.21.0\installation;$env:Path"
git -C C:\cloude\smplwisebms fetch origin
git -C C:\cloude\smplwisebms worktree add --detach C:\cloude\wt-perf-studio6 origin/<branch-or-commit>
cd C:\cloude\wt-perf-studio6\frontend
npm ci --no-audit --no-fund
npm run build                      # the measurement runs on the production build (vite preview on 4173)
# 4173 must be free (Playwright starts `npm run preview` itself); otherwise start a preview on another port and set
# $env:SW_BASE_URL = "http://127.0.0.1:<port>/"

$env:SW_PERF_GATE = '1'            # opt in; the GPU launch switches come with it (SW_PERF_GPU=0 turns them off)
npx playwright test tests/evidence-plan-studio-6.spec.ts --project=mobile --workers=1 -g "opt-in"
npx playwright test tests/evidence-plan-studio-6.spec.ts --project=desktop --workers=1 -g "lever table: frame cost"   # optional: the 1440 px table
```

Expected duration on the workstation GPU: about 1 minute for R178, about 3 minutes for each lever table.
Afterwards: `Remove-Item Env:SW_PERF_GATE`, and `git -C C:\cloude\smplwisebms worktree remove C:\cloude\wt-perf-studio6`.

Knobs (all optional): `SW_PERF_CPU_THROTTLE` (default 4; 1 = none), `SW_PERF_MAX_BUSY` (25), `SW_PERF_MAX_LOAD` (0.30),
`SW_PERF_GPU_ARGS` (default `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist` on Windows, `--use-angle=vulkan ...`
elsewhere), `SW_PERF_OUT` (record folder). `SW_PERF_DRY_RUN=1` (with `SW_PERF_SAMPLES` / `SW_PERF_FRAMES`) exercises the
harness on any machine and renderer and asserts nothing: for checking the harness only, never evidence.

## Reading the output

- `PERF_GATE RUN: load ..., CPU busy ...` - the machine was quiet; the tests measure.
- `PERF_GATE SKIPPED: <reason>` - not opted in, machine busy, or software WebGL. The test is reported as skipped with the
  same reason. Nothing was measured; fix the precondition and rerun.
- `PERF R178 iso: median <ms> ms = <fps> fps, <draws> draws, ...` - one line per preset; the test fails when a preset is
  under 30 fps.
- `PERF lever <row>: median ... ms = ... fps, ... draws, pixel ratio ...` - one line per lever row.
- `PERF R178 record: <path>` / `PERF lever record: <path>` - the JSON record.

The record holds: date, commit, project, viewport, device pixel ratio, CPU throttle, platform, CPU model, cores, memory,
the WebGL vendor / renderer string, the browser switches, `dry_run`, `evidence_grade` (true only for a non-dry run with 12 x
5 frames), the load before and after with the limits, the method, and per row the 12 block means, the median, fps, draw
calls, triangles, pixel ratio and canvas size. **Evidence only when `evidence_grade` is true and `load_after` is still
quiet** (a busy `load_after` means something started during the run: rerun).

## Where the evidence goes

1. The records land in `private-evidence/studio6-perf/` (gitignored). They carry no host name, address or serial; the
   renderer string names the GPU model and its PCI device id, which is not private.
2. Copy the reviewed records to `docs/evidence/T089/perf/<YYYY-MM-DD>-<machine>-<project>.json` (machine = a plain
   label such as `workstation-uhd`), commit on the S7 branch.
3. Add one evidence line to AT178 in `management/test_catalog.json` (commit, environment, the two medians, the record
   path) and to T089 in `management/tasks.json`; AT178 stays NOT_RUN until the owner's real-phone row is in. Then
   `%LOCALAPPDATA%\Programs\Python\Python312\python.exe scripts/project_status.py --write` and commit the regenerated
   views.
4. A failing R178: do not change thresholds. Report the lever table: it shows which lever (DPR, normal maps, textures)
   buys the frame time back, which is the input CR-029 section 3.4 expects for deciding the phone configuration.
