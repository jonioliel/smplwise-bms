# Knowledge transfer for a successor Claude session

Distilled from the outgoing session's private memory, which does not travel to another account or machine.
Read after `AGENTS.md` and `CLAUDE.md`. It contains no secrets; lab values stay in `secrets/lab.env`
(gitignored, present only on the owner's workstation).

## Owner working rules (standing instructions)

1. **Language.** The owner works in Hebrew. Chat replies and questions are in Hebrew, numbered, with short
   lettered options (א/ב/ג) and a marked recommendation. Code, commit messages and repository documents are English.
2. **Every status update carries ETAs** (task | state | ETA table) and the progress percentages from
   `python scripts/progress.py` (overall and per phase). Be honest: "evidence" is not acceptance.
3. **Releases are batched.** Agents build on branches and merge reviewed work into `g0/intake` without bumping.
   A release round (full backend suite, Playwright stages, review fixes, `release_check`, secret scan) happens
   once or twice a day. Under the standing release authority (2026-10-01): when every check is green, release
   without waiting for the owner, then report; if anything is red, stop and ask with a recommendation. Never cut
   scope or defer items on your own.
4. **Release notes are bilingual.** Each `smplwise_vms/CHANGELOG.md` entry: English sections (added, fixes,
   documents, how to turn it on and use it) plus a Hebrew block under `## עברית — <version>: ...` with
   `### מה חדש`, `### תיקונים`, `### איך מפעילים ומשתמשים`. The first heading must stay the version heading
   (`scripts/release_check.py`). Repeat the bilingual summary in chat.
5. **Continuous development.** While backlog tasks exist, do not idle; pull the next item from the recorded
   backlog, then `management/tasks.json`. Stop only for irreversible, physical or security decisions.
6. **Quota economy.** Few parallel agents (3-4), reviews per branch with at most two rounds, Opus only for
   security-sensitive code, Sonnet for UI/copy/docs. Always pass `model` explicitly on Agent dispatches.
   The owner's own UI requests come before speculative work.
7. **Workstation hygiene** (16 GB machine froze once): run `scripts/dev_cleanup.ps1` after Playwright batches and
   at the end of a segment (`-StopBackend` when finishing), `--workers=1` for live specs, one background job at a
   time, stop if free RAM is under about 2 GB.

## Product and design rules from the owner

- No Home Assistant/HA/Ingress/Companion wording outside Settings; use "תשתית המערכת". See `docs/design/UI_COPY_RULES.md`.
- Operator screens are clean: a row shows the thing, its state and its control. A control that cannot act is
  disabled with the reason in its tooltip. Management lives only in Settings.
- UniFi Protect style plus the three reference boards in `docs/design/reference/mockups/` are the visual yardstick.
- Every design direction and skin keeps the floors/areas tree (per-floor collapse) and has a list/table mode
  (tiles | cards | list), light and dark, desktop and phone.
- Device area styling lives in named CSS custom properties documented in `docs/design/DEVICE_THEMES.md`.
  When the owner says "good enough for a start", ship it and record what he would still want.
- Plan Studio (CR-003), device control (CR-007), notifications (CR-018), automations (CR-017), schedules (CR-014)
  and media (CR-015/016) each have a change request under `docs/changes/`; decisions are recorded there.

## Running the project locally (owner's workstation)

- Backend: `smplwise_vms/backend`, started with the project venv `..\..\.venv\Scripts\python.exe -m smplwise`
  with `SW_DEV_USER`, `SW_BOOTSTRAP_ADMIN`, `SW_DATA_DIR` (gitignored `data/`), `SW_WWW_DIR`, `SW_HOST=127.0.0.1`,
  `SW_PORT=8099`, plus lab variables loaded from `secrets/lab.env`.
- UI: `frontend`, `npm run build` (dist for Playwright preview on 4173) and `npm run build:addon` (writes the
  tracked `smplwise_vms/www`; rebuild after any frontend change). The dev backend serves `www`, so rebuild and restart.
- Backend tests: `pytest` in `smplwise_vms/backend`. `addopts` contains `-q`, so `pytest -q` prints no summary
  line; run without `-q` or trust the exit code (4 = missing path, 5 = nothing collected).
- Fixture Playwright suites need the backend stopped (demo mode). Live specs run with `SW_LIVE=1 SW_CHROME=1`
  against the dev backend and the lab; sweep with `--workers=1`.
- Windows quirks: process start is slow (git calls take seconds); `MSYS_NO_PATHCONV=1` changes script path
  handling; Smart App Control blocks the native rollup binary, so the repo pins `@rollup/wasm-node` (never turn
  Smart App Control off); parallel shell calls share one cwd, so use absolute paths.
- SQLite rule: a write-mode request holds `BEGIN IMMEDIATE` for its whole life, so network-bound work must run
  inside `with unlocked(conn):` (`smplwise/db.py`); busy GET handlers use the read connection and write via
  `db.write_aside()`.
- Before every commit run the staged-diff private-data scan, `secrets/scan_staged.sh` (gitignored, on the owner's
  workstation). It must print 0. Never write its pattern into a tracked file.
- Release loop per version (25-40 min): code, backend pytest, tsc, `npm run build`, restart backend, live specs,
  `npm run build:addon`, CHANGELOG/DOCS/version bumps, `python scripts/project_status.py --write`,
  `python scripts/api_inventory.py`, secret scan, commit via `git commit -F`, push `g0/intake` and
  `g0/intake:main`, then the add-on store reload script. Releasing never installs anything on the owner's systems.

## Where current state lives

- Live coordination and the latest handoff: `docs/operations/MULTI_CLAUDE_COORDINATION.md` and the `coord/state` branch.
- Task state: `management/tasks.json`, `management/test_catalog.json`, generated `management/STATUS.md`.
- Per-version history: `smplwise_vms/CHANGELOG.md`. Open owner questions are listed in the current `HANDOFF.md`.
