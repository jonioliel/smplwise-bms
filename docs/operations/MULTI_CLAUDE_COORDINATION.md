# Multi-Claude coordination

> **Optional tool, not loaded automatically; owner decision 2026-10-30 (7B).** This document and
> `scripts/coord.py` are not referenced from `CLAUDE.md`, `AGENTS.md`, hooks or settings. Use them only when asked.
> `KNOWLEDGE_TRANSFER.md` and `DEV_ENVIRONMENT.md` (named below) are not on `main`; skip those steps.

## Single account, switching every 2-3 days: the handoff steps

The owner uses one Claude account at a time and moves to another every 2-3 days; two accounts never run
together. No lease, ping or peer is needed. Only the handoff matters.

Outgoing account (before leaving, or at about 90% usage):

1. Stop or finish running agents; list anything still running that must be stopped.
2. Commit and push all work on its branch; note branch names and head SHAs.
3. Write the handoff (contents as in "Handoff contents" below) to a file, with no secrets, IPs, serials or MACs.
4. `py -3.12 scripts/coord.py handoff-draft` prints an auto-filled draft. If the `coord/state` branch is
   reachable and `COORD_SESSION` is set, `handoff --auto --file extra.md` publishes it; otherwise keep the file
   in the repository handoff folder.

Incoming account:

1. Read `CLAUDE.md`, `AGENTS.md`, then the latest handoff file.
2. `git fetch origin`; check the branches in the handoff exist at the stated SHAs.
3. `py -3.12 scripts/coord.py status` (read-only) shows any published handoff.
4. Continue with the first of the "next three tasks"; do not restart stopped agents without the owner's word.

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
  It also carries `presence`: per session its quota, last ping, a free-text note and its running sub-agents.
- `claims.json` - task id to session id.
- `reservations.json` - reserved migration numbers and ports, number to session.
- `assignments/A0001.json ...` - one record per assignment: from, to, task id and/or text, branch, priority,
  status (`pending`, `accepted`, `done`, `cancelled`), timestamps, and the closing report once done.
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

## Presence: what is running on my side

`ping` and `heartbeat` accept `--note "what I am doing, ETA"` and `--agents "name|branch|task|eta; name2|..."`
(entries separated by `;`; an empty string clears the list; omitting the flag keeps the previous value). Both are
validated against secrets like assignments. Keep notes to one or two lines; they are shown in `report`.

```powershell
py -3.12 scripts/coord.py heartbeat --quota 65 --note "merging T052, release round at 18:00" --agents "rev1|pilot/T052-x|review|15m"
```

## One table: `report`

`report` prints one consolidated table of every session: lease holder, role, quota, heartbeat age, open
assignments (id, task, branch, status), the note and the running agents. `report --json` prints the same data for
scripts. `inbox --json` does the same for your own inbox.

## The loop tick: `watch`

Idle or waiting sessions run `/loop 10m` with `py -3.12 scripts/coord.py watch --quota <N>` (the `--quota` also
pings, so the peer sees you are alive). `watch` prints only what changed since the previous tick for this session
(the state is kept locally in the coord clone, not on the branch):

| Line | Meaning |
|---|---|
| `NEW A0007 from pc1-main (high): T052` | a new assignment is in your inbox; run `inbox` and `accept` |
| `DONE A0004 finished by pc2-sub` | a report you are waiting for is in; run `report`, merge the branch |
| `LEASE vacant` | no live master (repeated every tick until someone claims); the highest-quota session claims |
| `SILENT pc2-sub for 41m` | a peer pinged before but has been silent over 30 minutes (reported once per silence) |

Exit code is 0 when nothing happened, otherwise `20 + bits`: 1 new inbox item, 2 finished report, 4 lease
vacant, 8 peer silent (for example 21 = new assignment, 32 = vacant and silent). The loop acts on the code:
nonzero means read the output and handle it; zero means keep working.

## The peer's branches: `branches`

`branches [--base g0/intake] [--peer pc2-sub]` fetches the configured remote (`git fetch` only) and lists the
pushed `pilot/*` branches: ahead/behind the base, age of the last commit, owner (taken from the assignment's
`--branch`) and the last subject. Use it before merging to see what the peer has produced.

## Reservations (migration numbers, ports)

```powershell
py -3.12 scripts/coord.py reserve-migration --count 2     # next free numbers, for example 0048 0049
py -3.12 scripts/coord.py reserve-migration --value 0052  # an exact number (refused if someone else holds it)
py -3.12 scripts/coord.py reserve-port                    # next free port from 18100 up
py -3.12 scripts/coord.py reservations
py -3.12 scripts/coord.py release-reserved --kind migration --value 0049
```

Automatic numbers start above the highest migration found in your tree and on the remote's `g0/intake`, `main`
and every pushed `pilot/*` branch, and above every existing reservation. Whoever adds a migration reserves it
first, master or not.

## Handoff, auto-filled, and cancel

`handoff-draft` prints a draft with the last release commit, the pushed pilot branches (ahead/behind, owner),
claims, open assignments, reservations and every session's note and agents, plus a "to fill by hand" section.
`handoff --auto [--file extra.md]` publishes that draft (with the file appended) and releases the lease.
`cancel --ref A0003` lets the sender withdraw an unfinished assignment (it also releases the claim).

## First 5 minutes

### Master

1. Read `AGENTS.md`, `CLAUDE.md`, `KNOWLEDGE_TRANSFER.md`; set `COORD_SESSION` (for example `pc1-main`).
2. `py -3.12 scripts/coord.py status` - confirm you hold (or can claim) the lease; read `HANDOFF.md`.
3. `claim-master --quota N` if vacant; `heartbeat --quota N` now and at least every 15 minutes.
4. `inbox` and `report` - answer what the subs sent, check which sessions are alive; `branches` shows what they pushed.
5. Split the backlog into independent task cards (template below), `assign` one per sub-developer, then start
   your own task. Run `reserve-migration` before assigning anything that touches the database.

### Sub-developer

1. Read `AGENTS.md`, `CLAUDE.md`, `KNOWLEDGE_TRANSFER.md`, `DEV_ENVIRONMENT.md`; set `COORD_SESSION` (for example `pc2-sub`).
2. `py -3.12 scripts/coord.py ping --quota N` then `status` (lease live? who is master?).
3. `inbox` - take the highest priority item, `accept`; if empty, `claim-task` an independent backlog task.
4. `git fetch` and create the branch named in the card from the branch the card names (usually `g0/intake`).
5. Work, push `pilot/...` regularly, `ping --note ...` on each step, and finish with `done --report`. If idle, run
   `/loop 10m` with `watch --quota N`; take the lease only when it is vacant and your quota is the highest.

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
- **Migration numbers.** Every session reserves with `reserve-migration` (see Reservations) before creating a
  migration file and uses only numbers it holds; the list lives on `coord/state` and is copied into the handoff.
  If two branches collide anyway, the master renumbers the later one during merge.

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
  `status`, and idle sessions may run `/loop 10m` with `watch --quota N`.
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
py -3.12 scripts/coord.py report [--json]
py -3.12 scripts/coord.py cancel --ref A0003
py -3.12 scripts/coord.py watch [--quota 65]
py -3.12 scripts/coord.py branches [--base g0/intake] [--peer pc2-sub]
py -3.12 scripts/coord.py handoff-draft
py -3.12 scripts/coord.py handoff --auto [--file extra.md]
py -3.12 scripts/coord.py reserve-migration|reserve-port [--count N] [--value V]
py -3.12 scripts/coord.py reservations
py -3.12 scripts/coord.py release-reserved --kind migration|port --value V
```

`ping` and `heartbeat` also take `--note` and `--agents`.

Exit codes: 0 ok, 2 lost race, 3 low quota (write handoff now), 4 refused; `watch` returns 0 or 20+bits (see above).
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
