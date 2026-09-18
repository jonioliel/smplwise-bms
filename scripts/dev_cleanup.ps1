# Developer workstation hygiene: removes what test runs can leave behind so the machine never fills up.
#   - headless Chrome / Chromium started by Playwright (command line carries --headless or --remote-debugging-pipe)
#   - node processes of `vite preview` and of Playwright itself
#   - ffmpeg children of the developer backend that lost their parent
#   - developer backends (`python -m smplwise`) that are not the one listening on 8099 (-StopBackend stops that too)
# Never touches the user's own Chrome windows (no --headless flag) or any process outside these patterns.
param([switch]$StopBackend)

$killed = @()
$listener = (Get-NetTCPConnection -LocalPort 8099 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
$procs = Get-CimInstance Win32_Process
foreach ($p in $procs) {
  $cl = [string]$p.CommandLine
  $kill = $false
  if ($p.Name -match '^(chrome|chromium|msedge)\.exe$' -and ($cl -match '--headless' -or $cl -match '--remote-debugging-pipe') -and $cl -match 'playwright|--user-data-dir=.*(Temp|tmp)') { $kill = $true }
  elseif ($p.Name -eq 'node.exe' -and $cl -match 'vite(\.js)?"?\s+preview|playwright[\\/](test|core)|@playwright') { $kill = $true }
  elseif ($p.Name -eq 'ffmpeg.exe' -and -not ($procs | Where-Object { $_.ProcessId -eq $p.ParentProcessId })) { $kill = $true }
  elseif ($p.Name -eq 'python.exe' -and $cl -match '-m\s+smplwise' -and ($StopBackend -or $p.ProcessId -ne $listener)) {
    # the venv launcher spawns the real interpreter: keep the pair that owns the listener
    $child = $procs | Where-Object { $_.ParentProcessId -eq $p.ProcessId -and $_.ProcessId -eq $listener }
    if ($StopBackend -or -not $child) { $kill = $true }
  }
  if ($kill) {
    try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; $killed += "$($p.Name):$($p.ProcessId)" } catch {}
  }
}
$os = Get-CimInstance Win32_OperatingSystem
"cleanup: killed $($killed.Count) [$($killed -join ', ')] | free RAM MB: $([int]($os.FreePhysicalMemory/1024)) of $([int]($os.TotalVisibleMemorySize/1024))"
