# Runs the SmplWise push relay checks (typecheck + unit tests + a bundle dry run). No network, no keys, no deploy.
# Usage (repo root):  powershell -File scripts/test_push_relay.ps1
$ErrorActionPreference = 'Stop'
$node = Join-Path $env:APPDATA 'fnm\node-versions\v24.21.0\installation'
if (Test-Path $node) { $env:Path = "$node;$env:Path" }
Push-Location (Join-Path $PSScriptRoot '..\services\push-relay')
try {
  if (-not (Test-Path node_modules)) { npm ci --no-audit --no-fund; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
  npm run typecheck; if ($LASTEXITCODE) { exit $LASTEXITCODE }
  npm test; if ($LASTEXITCODE) { exit $LASTEXITCODE }
  $env:WRANGLER_SEND_METRICS = 'false'
  npx wrangler deploy --dry-run --outdir (Join-Path ([IO.Path]::GetTempPath()) 'push-relay-dry'); exit $LASTEXITCODE
} finally { Pop-Location }
