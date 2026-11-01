#!/usr/bin/env bash
# Agent test runs go through this (GATE-FAST-2291, item 8): refused with a Hebrew message while a release gate holds the machine.
#   run_guarded.sh "<agent name>" <command> [args...]
# Exit 75 = a gate holds the machine (nothing was started). Otherwise it execs the command. The same check can be put at the top of
# run_remote.sh / run_smart.py:  python3 ~/gate2/gate_holder.py guard --who "<agent>" || exit 75
G="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
who="${1:-agent}"; shift || true
[ $# -gt 0 ] || { echo "usage: run_guarded.sh \"<agent>\" <command> [args...]"; exit 2; }
python3 "$G/gate_holder.py" guard --who "$who" || exit 75
exec "$@"
