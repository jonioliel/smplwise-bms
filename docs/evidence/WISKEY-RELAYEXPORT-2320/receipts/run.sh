#!/bin/sh
# WISKEY-RELAYEXPORT-2320 receipt runner: ONE pytest process (no xdist), on a clean detached worktree of the exact head.
# usage: run.sh <suite> <worktree root> ; reads <suite>/files.txt, writes <suite>/{stdout.txt,junit.xml,meta.txt}
R=$(cd "$(dirname "$0")" && pwd)
suite=$1; wt=$2
PY=/c/cloude/smplwisebms/.venv/Scripts/python.exe
D=$R/$suite
cd "$wt/smplwise_vms/backend" || exit 2
{
  echo "SUITE=$suite"
  echo "HEAD=$(git rev-parse HEAD)"
  echo "DIRTY=$(git status --porcelain --untracked-files=no | wc -l)"
  echo "SMPLWISE_IMPORT=$(PYTHONPATH=. $PY -c 'import smplwise;print(smplwise.__file__)')"
  echo "PYTHON=$($PY -c 'import sys;print(sys.version.split()[0])') $PY"
  echo "CWD=<worktree>/smplwise_vms/backend"
  echo "COMMAND=PYTHONPATH=. $PY -m pytest -p no:cacheprovider -rfE --junitxml=junit.xml \$(cat files.txt)"
  echo "START=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$D/meta.txt"
PYTHONPATH=. $PY -m pytest -p no:cacheprovider -rfE --junitxml="$D/junit.xml" $(cat "$D/files.txt") > "$D/stdout.txt" 2>&1
code=$?
{
  echo "END=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "EXIT_CODE=$code"
  echo "HEAD_AFTER=$(git rev-parse HEAD)"
} >> "$D/meta.txt"
exit $code
