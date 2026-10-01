# Multi-Claude coordination

Several Claude Code sessions (different accounts, machines, or cloud/mobile sessions) develop this project
together. **All sessions execute tasks.** Whoever holds the master lease also distributes work, and the roles
swap (quota below 10%, or on the owner's word). Session memory does not transfer between accounts or machines,
so everything a successor needs lives in the repository, on the `coord/state` branch, and in the companion
private repository (see `DEV_ENVIRONMENT.md`).

## Roles

| Role | Does | Does not |
|---|---|---|
| Master | Executes core-line tasks, **assigns** work to other sessions, merges reviewed branches, edits `management/tasks.json`, runs release rounds (when all checks are green), keeps `HANDOFF.md` current | Hold the role after quota drops below 10% |
| Sub-developer | Executes assigned or claimed tasks, one at a time, on its own `pilot/...` branch; closing report per `AGENTS.md`; may **assign requests to the master** (a blocker, a question, a discovered task) | Touch `main`, release, edit `management/tasks.json`, or take a task needing the lab from a cloud session |

The roles are symmetric: every command below works the same whoever is master, and `--to master` always means
"whoever holds the lease right now". All safety rules in `AGENTS.md` apply to every role equally; nobody gets
extra authority for physical, destructive, or lab actions.

## Shared state (`coord/state` branch, never merged into code branches)

- `lease.json` - master id, last heartbeat, reported quota, fresh candidates.
- `claims.json` - task id to session id.
- `assignments/A0001.json ...` - one record per assignment: from, to, task id and/or text, branch, priority,
  status (`pending`, `accepted`, `done`), timestamps, and the closing report once done.
- `HANDOFF.md` - written by the master when it releases the lease.

Every write is a non-force `git push`. If two sessions race, one push is rejected (exit 2) and that session
re-runs the command. **No secrets, lab addresses, credentials, serials or MACs are ever written to this branch.**
`assign` and `done` refuse text that contains an IPv4 address, a MAC, a serial number, `password/token/key =`
values, credentials in URLs, or a 32+ character token-like string. Redact first.

## Two-way task flow

```
master:  assign --to pc2-sub --task T052 --branch pilot/T052-x --priority high
sub:     inbox                       # my pending/accepted assignments, high priority first
sub:     accept [--ref A0003]        # claims the task id too; --ref optional when only one is pending
sub:     ... work on the branch, push pilot/T052-x ...
sub:     done --report report.md [--ref A0003]     # releases the claim
master:  report                      # all assignments, all sessions, with status
master:  merges pilot/T052-x, updates management/tasks.json from the report's evidence lines

sub:     assign --to master --task blocker-note.md   # a text file works as a free-text task/request
```

`--task` takes either a task id (`T052`) or a path to a markdown file (a task card, see the template below).
A sub-developer who finds a task, a blocker or a needed decision sends it with `assign --to master`; the master
sees it in `inbox`. When the roles swap, the old master simply becomes a sub-developer and keeps using the same
commands; open assignments stay addressed to the session names, so nothing is lost. Re-address with a new
`assign` if the master changed and a request was sent to the old name.

## First 5 minutes

### Master

1. Read `AGENTS.md`, `CLAUDE.md`, `KNOWLEDGE_TRANSFER.md`; set `COORD_SESSION` (for example `pc1-main`).
2. `py -3.12 scripts/coord.py status` - confirm you hold (or can claim) the lease; read `HANDOFF.md`.
3. `claim-master --quota N` if vacant; `heartbeat --quota N` now and at least every 15 minutes.
4. `inbox` and `report` - answer what the subs sent, then check which sessions are alive (`status` candidates).
5. Split the backlog into independent task cards (template below), `assign` one per sub-developer, then start
   your own task. Reserve migration numbers (below) before assigning anything that touches the database.

### Sub-developer

1. Read `AGENTS.md`, `CLAUDE.md`, `KNOWLEDGE_TRANSFER.md`, `DEV_ENVIRONMENT.md`; set `COORD_SESSION` (for example `pc2-sub`).
2. `py -3.12 scripts/coord.py ping --quota N` then `status` (lease live? who is master?).
3. `inbox` - take the highest priority item, `accept`; if empty, `claim-task` an independent backlog task.
4. `git fetch` and create the branch named in the card from the branch the card names (usually `g0/intake`).
5. Work, push `pilot/...` regularly, `ping` on each step, and finish with `done --report`. If idle, `/loop 15m`
   running `ping`, `inbox`, `status`; take the lease only when it is vacant and your quota is the highest.

## Task-card template

Put it in a markdown file and pass the path to `assign --task`. Redact all identifiers.

```markdown
# <short title> (T0xx or free-form)
Goal: one sentence, what is true when done.
Branch: pilot/T0xx-<slug>, from g0/intake (name the base commit).
Files: allowed to touch: ...; read-only context: ...; do not touch: management/tasks.json, CHANGELOG, version files.
Migrations: reserved numbers (or "none").
Acceptance: numbered, verifiable statements.
Tests to run: exact commands (pytest with -o addopts="" and the repo .venv; specific specs only); expected outcomes.
Forbidden: lab/device writes, releases, merges to g0/intake or main, secrets, other tasks' files, scope growth.
Report format: AGENTS.md closing report - task id, files changed, head commit, exact test commands and REAL
outcomes (NOT_RUN/BLOCKED stated honestly), unmet acceptance, migration/rollback, evidence lines for the
master to paste into management/tasks.json, proposed next task.
```

## Merge discipline

- Sub-developers push `pilot/...` branches only. The **master merges** into `g0/intake` after review. Nobody
  but the master touches `main`.
- **`management/tasks.json`, `management/test_catalog.json` and the regenerated status views are master-only.**
  Subs put evidence lines (task id, state, commit, test results) in the `done` report; the master applies them.
  This prevents two sessions editing the same canonical file.
- Also master-only: `CHANGELOG.md`, version bumps, release scripts.
- **Migration numbers.** The master keeps the reservation list below in `HANDOFF.md` (and updates it on every
  assignment). A sub uses only the numbers reserved for its card. Check the highest existing
  `smplwise_vms/backend/smplwise/migrations/NNNN_*.sql` on the base branch before reserving. If two branches
  collide anyway, the master renumbers the later one during merge.

  | Range | Owner | Card |
  |---|---|---|
  | next free +0..+2 | pc1-main | (task id) |
  | next free +3..+5 | pc2-sub | (task id) |

- Keep branches small and rebased on `g0/intake` before reporting done; run the targeted tests after rebasing.
- Shared API/DB contracts have a single owner at a time (`AGENTS.md`); put it in the card.

## Succession rules

- Lease TTL: 30 minutes without a heartbeat means vacant. A released lease is vacant immediately.
- The master heartbeats on every meaningful step (at least every 15 minutes) with its remaining quota in percent.
- When the heartbeat reports quota below 10% (exit code 3), the master stops starting new work, writes the
  handoff (including open assignments and the migration reservations), and releases the lease with `handoff`.
- Non-master sessions run `ping` with their quota. When the lease is vacant, the session reporting the highest
  fresh quota must take it; `claim-master` refuses if a fresher candidate has more (`--force` overrides, owner only).
- A session cannot wake itself. Succession happens when some session is running: every session starts with
  `status`, and idle sessions may run `/loop 15m` calling `ping`, `inbox`, `status`.
- The owner may swap the roles at any time by telling the master to `handoff`.

## Commands

Set `COORD_SESSION` once per session (for example `pc1-main`, `pc2-sub`, `cloud-1`), then:

```powershell
py -3.12 scripts/coord.py status
py -3.12 scripts/coord.py ping --quota 70
py -3.12 scripts/coord.py claim-master --quota 70
py -3.12 scripts/coord.py heartbeat --quota 65
py -3.12 scripts/coord.py handoff --file handoff.md
py -3.12 scripts/coord.py claim-task --task T005 [--cloud]
py -3.12 scripts/coord.py finish-task --task T005
py -3.12 scripts/coord.py assign --to pc2-sub|master --task T052|card.md [--branch pilot/T052-x] [--priority low|normal|high]
py -3.12 scripts/coord.py inbox
py -3.12 scripts/coord.py accept [--ref A0003]
py -3.12 scripts/coord.py done --report report.md [--ref A0003]
py -3.12 scripts/coord.py report
```

Exit codes: 0 ok, 2 lost race, 3 low quota (write handoff now), 4 refused.
`claim-task` refuses a task with `requires_hardware: true` when `--cloud` is given. Only the addressee can
`accept` or `done` an assignment; accepting a task id that another session has claimed is refused.

## Quota reporting

A session reports its own remaining quota (the desktop app's usage tool when available, otherwise an honest
estimate rounded to the nearest 10). Accounts cannot read each other's quota, so the ranking is only as good as
these reports.

## Handoff contents

`HANDOFF.md` must contain: branch and last release, what is merged and what is not, tasks claimed and by whom,
open assignments, migration reservations, the next three tasks with reasons, open owner questions, house rules
(language, release authority, batching), and anything running that must be stopped. Write it so a session with
no memory can continue.
