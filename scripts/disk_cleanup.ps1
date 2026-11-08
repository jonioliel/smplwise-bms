# Workstation disk cleanup after a release (owner request 2026-11-08). DRY RUN by default: it only lists what it would remove.
#   powershell -NoProfile -File scripts\disk_cleanup.ps1            # list candidates and sizes
#   powershell -NoProfile -File scripts\disk_cleanup.ps1 -Apply     # remove them
# What it removes:
#   1. git worktrees of this repository whose branch is merged into origin/main AND whose checkout is clean
#      (no tracked or untracked changes). The branch itself stays (local and on GitHub); only the folder goes.
#      Junctions inside the worktree (frontend\node_modules linked to the main checkout) are unlinked FIRST, so the
#      main checkout's node_modules is never deleted through a link.
#   2. Test temp caches in %TEMP%: pytest-of-<user>, playwright-transform-cache.
#   3. Claude session temp folders in %TEMP%\claude\<project>\<session> not written for -TempAgeDays days (default 3).
# Never touched: the main checkout, detached worktrees, worktrees with changes or unmerged branches, folders named in -Keep,
# the recycle bin, Downloads, browser data, WisKey / intercom folders, Claude memory and transcripts (~\.claude).
param(
  [switch]$Apply,
  [int]$TempAgeDays = 3,
  [string[]]$Keep = @(),
  [switch]$NoSize
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

function Get-SizeMB([string]$path) {
  if ($NoSize -or -not (Test-Path -LiteralPath $path)) { return 0 }
  $sum = 0
  $stack = New-Object System.Collections.Stack
  $stack.Push((Get-Item -LiteralPath $path -Force))
  while ($stack.Count -gt 0) {
    $d = $stack.Pop()
    try { $items = $d.EnumerateFileSystemInfos() } catch { continue }
    foreach ($i in $items) {
      if ($i.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }   # never follow junctions / links
      if ($i -is [IO.DirectoryInfo]) { $stack.Push($i) } else { $sum += $i.Length }
    }
  }
  [math]::Round($sum / 1MB)
}

function Remove-Links([string]$root) {
  # unlink every junction / symlink below $root without touching its target
  $stack = New-Object System.Collections.Stack
  $stack.Push((Get-Item -LiteralPath $root -Force))
  while ($stack.Count -gt 0) {
    $d = $stack.Pop()
    try { $items = $d.EnumerateFileSystemInfos() } catch { continue }
    foreach ($i in $items) {
      if ($i.Attributes -band [IO.FileAttributes]::ReparsePoint) { $i.Delete() }
      elseif ($i -is [IO.DirectoryInfo]) { $stack.Push($i) }
    }
  }
}

$plan = @()
# 1. merged, clean worktrees
git -C $repo fetch -q origin 2>$null
$self = (Resolve-Path $repo).Path.TrimEnd('\')
$cd = (git -C $repo rev-parse --git-common-dir) -replace '/', '\'
if (-not [IO.Path]::IsPathRooted($cd)) { $cd = Join-Path $repo $cd }
$common = (Resolve-Path -LiteralPath $cd).Path
$main = (Split-Path -Parent $common).TrimEnd('\')   # the main checkout owns the shared .git
$wt = $null; $br = $null
$entries = @()
foreach ($line in (git -C $repo worktree list --porcelain)) {
  if ($line -like 'worktree *') { $wt = $line.Substring(9); $br = $null }
  elseif ($line -like 'branch *') { $br = $line.Substring(7); $entries += [pscustomobject]@{ Path = $wt; Branch = $br } }
}
foreach ($e in $entries) {
  $p = ($e.Path -replace '/', '\').TrimEnd('\')
  if ($p -ieq $main -or $p -ieq $self) { continue }
  $name = Split-Path -Leaf $p
  if ($Keep -contains $name) { continue }
  git -C $repo merge-base --is-ancestor $e.Branch origin/main 2>$null
  if ($LASTEXITCODE -ne 0) { continue }
  if (git -C $p status --porcelain 2>$null) { "keep (has changes): $name"; continue }
  $plan += [pscustomobject]@{ Kind = 'worktree'; Path = $p; Branch = $e.Branch.Replace('refs/heads/', ''); MB = (Get-SizeMB $p) }
}
# 2. test temp caches
foreach ($n in @("pytest-of-$env:USERNAME", 'playwright-transform-cache')) {
  $p = Join-Path $env:TEMP $n
  if (Test-Path -LiteralPath $p) { $plan += [pscustomobject]@{ Kind = 'temp'; Path = $p; Branch = ''; MB = (Get-SizeMB $p) } }
}
# 3. old Claude session temp folders
$ct = Join-Path $env:TEMP 'claude'
if (Test-Path -LiteralPath $ct) {
  $cut = (Get-Date).AddDays(-$TempAgeDays)
  foreach ($proj in Get-ChildItem -LiteralPath $ct -Directory -Force | Where-Object { $_.Name -ne 'bundled-skills' }) {   # the app's own files
    foreach ($s in Get-ChildItem -LiteralPath $proj.FullName -Directory -Force) {
      $last = (Get-ChildItem -LiteralPath $s.FullName -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property LastWriteTime -Maximum).Maximum
      if (-not $last) { $last = $s.LastWriteTime }
      if ($last -lt $cut) { $plan += [pscustomobject]@{ Kind = 'session-temp'; Path = $s.FullName; Branch = ''; MB = (Get-SizeMB $s.FullName) } }
    }
  }
}

$plan | Sort-Object MB -Descending | Format-Table Kind, MB, Branch, Path -AutoSize | Out-String -Width 220
$total = ($plan | Measure-Object MB -Sum).Sum
"candidates: $($plan.Count), about $([math]::Round($total / 1024, 1)) GB"
if (-not $Apply) { 'dry run: nothing removed (add -Apply to remove)'; return }

$freeBefore = (Get-PSDrive C).Free
foreach ($i in $plan) {
  try {
    if ($i.Kind -eq 'worktree') {
      Remove-Links $i.Path
      git -C $repo worktree remove $i.Path 2>$null
      if ($LASTEXITCODE -ne 0) { "worktree remove refused: $($i.Path)"; continue }
      if (Test-Path -LiteralPath $i.Path) { Remove-Links $i.Path; Remove-Item -LiteralPath $i.Path -Recurse -Force }
    } else {
      Remove-Links $i.Path
      Remove-Item -LiteralPath $i.Path -Recurse -Force
    }
  } catch { "failed: $($i.Path): $($_.Exception.Message)" }
}
git -C $repo worktree prune
"freed about $([math]::Round(((Get-PSDrive C).Free - $freeBefore) / 1GB, 1)) GB; free now $([math]::Round((Get-PSDrive C).Free / 1GB, 1)) GB"
