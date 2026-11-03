#!/bin/sh
# round 3 runner: one pytest per file list, receipt = header + output + EXIT CODE
cd "$(dirname "$0")/../../../../smplwise_vms/backend" || exit 2
R=../../docs/evidence/WISKEY-RC4-2310/round3
name=$1
{
  echo "HEAD=$(git rev-parse HEAD)"
  echo "DIRTY=$(git status --porcelain -- . | wc -l)"
  echo "START=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "\$ /c/cloude/smplwisebms/.venv/Scripts/python.exe -m pytest -p no:cacheprovider -rfE --junitxml=$name.junit.xml \$(cat $name.files)"
  /c/cloude/smplwisebms/.venv/Scripts/python.exe -m pytest -p no:cacheprovider -rfE --junitxml=$R/$name.junit.xml $(cat $R/$name.files) 2>&1
  code=$?
  echo "END=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "EXIT CODE=$code"
} > $R/$name.txt 2>&1
