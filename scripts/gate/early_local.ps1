# LOCAL early check (GATE-SPEED-2320): what every agent runs on the workstation BEFORE pushing - no runner, ~3-5 min.
#   powershell -NoProfile -File scripts\gate\early_local.ps1 [-Base origin/main] [-Only a,b] [-Skip a,b]
# Runs, in parallel, on the current checkout: spec-lint (new specs since the base), tsc, the repository-wide unit rule specs
# (gate_early_check.json), the backend lint tests and release_check. The early layout list is runner only (branch_early.sh).
# Needs frontend\node_modules (a worktree: a junction to a checkout that has one) and Node on PATH (this script adds the fnm Node 24
# install when node is missing). Backend python: $env:EARLY_BACKEND_PYTHON, else <repo>\.venv, else the main checkout's .venv,
# else Python 3.12 under %LOCALAPPDATA%. Exit 0 GREEN, 1 RED / NOT_RUN. Files: %TEMP%\smplwise-early\entry_early_<branch>_<sha>.md + .json.
param(
  [string]$Base = "origin/main",
  [string]$Only = "",
  [string]$Skip = ""
)
$ErrorActionPreference = "Stop"
$G = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = (& git -C $G rev-parse --show-toplevel).Trim()
if (-not $Root) { Write-Output "early_local: not inside a git checkout"; exit 2 }
$Root = $Root -replace '/', '\'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  $fnmNode = Join-Path $env:APPDATA "fnm\node-versions\v24.21.0\installation"
  if (Test-Path $fnmNode) { $env:Path = "$fnmNode;$env:Path" }
}

$common = (& git -C $Root rev-parse --git-common-dir).Trim()
if (-not [System.IO.Path]::IsPathRooted($common)) { $common = Join-Path $Root $common }
$mainRoot = Split-Path -Parent ([System.IO.Path]::GetFullPath($common))
$cands = @($env:EARLY_BACKEND_PYTHON, (Join-Path $Root ".venv\Scripts\python.exe"), (Join-Path $mainRoot ".venv\Scripts\python.exe"),
           (Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"))
$Bpy = $null
foreach ($c in $cands) { if ($c -and (Test-Path $c)) { $Bpy = $c; break } }
if (-not $Bpy) { Write-Output "early_local: no python found (set EARLY_BACKEND_PYTHON)"; exit 2 }
$Py = if ($env:GATE2_PYTHON) { $env:GATE2_PYTHON } else { $Bpy }
$Out = if ($env:EARLY_OUT_DIR) { $env:EARLY_OUT_DIR } else { Join-Path $env:TEMP "smplwise-early" }

$argsList = @("$G\early_check.py", "run", "--root", $Root, "--base", $Base, "--where", "local", "--out-dir", $Out, "--backend-python", $Bpy)
if ($Only) { $argsList += @("--only", $Only) }
if ($Skip) { $argsList += @("--skip", $Skip) }
$env:PYTHONIOENCODING = "utf-8"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
& $Py @argsList
$rc = $LASTEXITCODE
$sw.Stop()
Write-Output ("early_local: wall time {0:N0} s" -f $sw.Elapsed.TotalSeconds)
exit $rc
