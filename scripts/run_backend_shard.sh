#!/usr/bin/env bash
# Runs one shard of the backend pytest suite: test files are listed in sorted order and shard K of N takes every
# N-th file, so two shards (1/2 and 2/2) cover everything exactly once without any plugin.
#
#   scripts/run_backend_shard.sh 1 2 [extra pytest args]     # shard 1 of 2
#   scripts/run_backend_shard.sh 2 2 -x                      # shard 2 of 2, stop at the first failure
#
# Python: $SW_PYTHON, else the repository venv (scripts/venv_python.py), else python3.
set -euo pipefail
K="${1:?usage: run_backend_shard.sh <shard 1..N> <N> [pytest args]}"
N="${2:?usage: run_backend_shard.sh <shard 1..N> <N> [pytest args]}"
shift 2

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY="${SW_PYTHON:-}"
if [ -z "$PY" ]; then
  for c in "$ROOT/.venv/bin/python" "$ROOT/.venv/Scripts/python.exe"; do [ -x "$c" ] && PY="$c" && break; done
fi
PY="${PY:-python3}"

cd "$ROOT/smplwise_vms/backend"
files=()
i=0
while IFS= read -r f; do
  if [ $((i % N)) -eq $((K - 1)) ]; then files+=("$f"); fi
  i=$((i + 1))
done < <(find tests -maxdepth 1 -name 'test_*.py' | LC_ALL=C sort)

echo "shard $K/$N: ${#files[@]} of $i test files" >&2
exec "$PY" -m pytest "${files[@]}" -p no:cacheprovider "$@"
