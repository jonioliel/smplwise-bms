# RUNNER-CLEAN-2300 - remove gate temp dirs and .tmp_s1/.tmp_s2 on the runner

Problem: on 2026-10-29 the runner disk reached 100%. `~/gate_clean.sh` (runner-local, not versioned in this repo) does not remove
(1) `~/smplwise-results/gate_*.logs/tmp_b*` (86 GB in one day) or (2) `<worktree>/.tmp_s1` and `.tmp_s2` (20-45 GB each).

Change: new `scripts/gate/runner_tmp_clean.sh` (+ test `scripts/gate/tests/test_runner_tmp_clean.sh`).
- `--dry-run` lists items and size; without it, removes them and prints `freed N MB in M items`.
- Targets: `gate_*.logs/{tmp_b*,tmp_bretry,tmp[0-9]}`; `.tmp_s1`/`.tmp_s2` in `~/work/*`, `~/gate2/*`, `~/smplwisebms`.
- Skips everything (exit 3) while `gate_status.json` has state=running, a gate/nightly process runs, or the gate/tests lock is held
  (read-only `fuser` probe). Per worktree it skips if a pytest/playwright process has its cwd or command line in it.
- Only directories whose contents are all older than 30 minutes (`MIN_AGE_MIN`); no symlinks; real path must be inside the runner home.
- Never touches reports (.md/.json), logs or `pw_*.json`.

Tested on the Windows workstation (Git Bash, temp tree): all 10 checks pass. NOT tested on Linux/the runner (no pgrep/fuser here).

## Deploy (lead, after the running gate finishes; copy with scp, run nothing else)
1. `scp scripts/gate/runner_tmp_clean.sh runner:~/runner_tmp_clean.sh` and `chmod +x ~/runner_tmp_clean.sh`.
2. Dry run: `~/runner_tmp_clean.sh --dry-run` - review the list.
3. Append to `~/gate_clean.sh` (before its final output): `"$HOME/runner_tmp_clean.sh" || true`, so every pre/post-gate clean also runs it.
4. Optional cron every 2 h: `0 */2 * * * $HOME/runner_tmp_clean.sh >> $HOME/smplwise-results/tmp_clean.log 2>&1`.
