# Assembles the round-2 package for Astra: exports\astra-round2\ + exports\astra-round2.zip.
# Sources: docs/design/handoff (this branch), docs/design/UI_COPY_RULES.md, and the structure boards from the
# entrant-claude worktree (Domus/root skin only). Refuses to include any screenshot of the owner's running system.
# Usage (from the repo root or any worktree):  .\scripts\design\build_astra_round2.ps1 [-Repo C:\cloude\smplwisebms]
param(
  [string]$Repo = 'C:\cloude\smplwisebms',
  [string]$Handoff = (Join-Path $PSScriptRoot '..\..\docs\design\handoff'),
  [string]$Entrant = 'C:\cloude\smplwisebms\.claude\worktrees\compare-claude\docs\design\compare\entrant-claude'
)
$ErrorActionPreference = 'Stop'
$Handoff = (Resolve-Path $Handoff).Path
$out = Join-Path $Repo 'exports\astra-round2'
$zip = Join-Path $Repo 'exports\astra-round2.zip'
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
if (Test-Path $zip) { Remove-Item -Force $zip }
New-Item -ItemType Directory -Force (Join-Path $out 'structure\boards\fonts') | Out-Null
New-Item -ItemType Directory -Force (Join-Path $out 'structure\renders') | Out-Null

# 1. documents
foreach ($f in 'ROUND2_ASTRA_BRIEF_HE.md', 'ROUND1_FEEDBACK_ASTRA_HE.md', 'ROUND2_SEND_LIST.md', 'COMPARISON_TASK_HE.md', 'TOKEN_CONTRACT.md', 'COMPONENT_INVENTORY.md') {
  Copy-Item (Join-Path $Handoff $f) $out
}
Copy-Item (Join-Path $Repo 'docs\design\UI_COPY_RULES.md') $out
Copy-Item (Join-Path $Entrant 'SKINS_HE.md') $out

# 2. structure boards: the root (Domus) skin of entrant-claude = the shared structure. HTML + fonts + PNG.
$boards = Get-ChildItem (Join-Path $Entrant 'boards') -Filter *.html -File
foreach ($b in $boards) { Copy-Item $b.FullName (Join-Path $out 'structure\boards') }
Copy-Item (Join-Path $Entrant 'boards\fonts\*') (Join-Path $out 'structure\boards\fonts')
$renders = Get-ChildItem (Join-Path $Entrant 'renders') -Filter *.png -File
foreach ($r in $renders) { Copy-Item $r.FullName (Join-Path $out 'structure\renders') }
# the mirrors (if rendered) go along as structure evidence too
$mirrors = Join-Path $Entrant 'renders\mirrors'
if (Test-Path $mirrors) { New-Item -ItemType Directory -Force (Join-Path $out 'structure\renders\mirrors') | Out-Null; Copy-Item (Join-Path $mirrors '*.png') (Join-Path $out 'structure\renders\mirrors') }
# boards/index.html links ../renders/ — the package keeps boards/ and renders/ side by side, so the links hold as-is

# 3. README
$readme = @'
# חבילת סבב 2 ל-Astra — SmplWise Arx

סדר קריאה:
1. `ROUND2_ASTRA_BRIEF_HE.md` — הבריף. מה הוחלט, מה למסור, איך ננקד וימוזג. גובר על כל מסמך אחר כאן.
2. `ROUND1_FEEDBACK_ASTRA_HE.md` — ממצאי השופט על התוצר שלך מסבב 1 (רק החלק שלך).
3. `structure/` — המבנה המשותף הנתון: `boards/*.html` (נפתח מהדיסק, גופנים מקומיים; `boards/index.html` = גלריה) ו-`renders/*.png`.
   המבנה הוא הנתון; החומר/הצבע/הפקדים בו הם דוגמה שאת מחליפה בשלושת הסקינים.
4. `SKINS_HE.md` — איך שכבת סקין תחומה בנויה (מודל, לא ערכים). `TOKEN_CONTRACT.md`, `COMPONENT_INVENTORY.md`, `UI_COPY_RULES.md` — כמו סבב 1.
5. `COMPARISON_TASK_HE.md` — משימת סבב 1; המחוון (§5) ודף הניקוד (§6) עדיין תקפים.

לא כלול בכוונה: צילומי המערכת הנוכחית (יש לך מסבב 1; הפניה בשם הקובץ בלבד), והדוח המלא של השופט.
תוצר חוזר: `smplwise-arx-round2.zip` לפי §4 בבריף, לבעלים, באותו ערוץ.
'@
[System.IO.File]::WriteAllText((Join-Path $out 'README.md'), $readme, (New-Object System.Text.UTF8Encoding($false)))

# 4. guard: nothing from the owner's live-system screenshots may be inside
$currentNames = Get-ChildItem (Join-Path $Handoff 'current') -Filter *.png -File | ForEach-Object { $_.Name }
$leak = Get-ChildItem $out -Recurse -Filter *.png -File | Where-Object { $currentNames -contains $_.Name -or $_.FullName -match 'source-brief|\\current\\' }
if ($leak) { $leak | ForEach-Object { Write-Error "refusing: owner screenshot inside package: $($_.FullName)" }; exit 1 }

Compress-Archive -Path (Join-Path $out '*') -DestinationPath $zip -CompressionLevel Optimal
$n = (Get-ChildItem $out -Recurse -File | Measure-Object).Count
$mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Output "astra-round2: $n files -> $zip ($mb MB)"
