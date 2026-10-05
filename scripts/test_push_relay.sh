#!/usr/bin/env bash
# Runs the SmplWise push relay checks (typecheck + unit tests + a bundle dry run). No network, no keys, no deploy.
set -euo pipefail
cd "$(dirname "$0")/../services/push-relay"
[ -d node_modules ] || npm ci --no-audit --no-fund
npm run typecheck
npm test
WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir "${TMPDIR:-/tmp}/push-relay-dry"
