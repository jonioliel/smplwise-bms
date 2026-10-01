# Multi-Claude coordination

Several Claude Code sessions (different accounts, machines, or cloud/mobile sessions) develop this project
together. One is the **master**; the others are **sub-developers**. Session memory does not transfer between
accounts or machines, so everything a successor needs lives in the repository and on the `coord/state` branch.

## Roles

| Role | Does | Does not |
|---|---|---|
| Master | Core-line tasks, merges reviewed branches, sets priorities, runs release rounds (when all checks are green), keeps `HANDOFF.md` current | Hold the role after quota drops below 10% |
| Sub-developer | One independent side task at a time on its own `pilot/T0xx-...` branch, closing report per `AGENTS.md` | Touch `main`, release, or take a task needing the lab from a cloud session |

All safety rules in `AGENTS.md` apply to every role equally. A sub-developer or a new master has no extra
authority for physical, destructive, or lab actions; those still need the owner's task-specific approval.

## Shared state (`coord/state` branch, never merged into code branches)

- `lease.json` - master id, last heartbeat, reported quota, fresh candidates.
- `claims.json` - task id to session id.
- `HANDOFF.md` - written by the master when it releases the lease.

The lease is taken with a non-force `git push`. If two sessions race, one push is rejected (exit 2) and that
session re-evaluates. No secrets, lab addresses, credentials, serials or MACs are ever written to this branch.

## Succession rules

- Lease TTL: 30 minutes without a heartbeat means vacant. A released lease is vacant immediately.
- The master heartbeats on every meaningful step (at least every 15 minutes) with its remaining quota in percent.
- When the heartbeat reports quota below 10% (exit code 3), the master stops starting new work, writes the
  handoff, and releases the lease with `handoff`.
- Non-master sessions run `ping` with their quota. When the lease is vacant, the session reporting the highest
  fresh quota must take it; `claim-master` refuses if a fresher candidate has more (`--force` overrides, owner only).
- A session cannot wake itself. Succession happens when some session is running: every session starts with
  `status`, and sub-developers may run `/loop 15m` calling `ping` then `status` and claiming the lease when vacant.

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
```

Exit codes: 0 ok, 2 lost race, 3 low quota (write handoff now), 4 refused.
`claim-task` refuses a task with `requires_hardware: true` when `--cloud` is given.

## Quota reporting

A session reports its own remaining quota (the desktop app's usage tool when available, otherwise an honest
estimate rounded to the nearest 10). Accounts cannot read each other's quota, so the ranking is only as good as
these reports.

## Handoff contents

`HANDOFF.md` must contain: branch and last release, what is merged and what is not, tasks claimed and by whom,
the next three tasks with reasons, open owner questions, house rules (language, release authority, batching),
and anything running that must be stopped. Write it so a session with no memory can continue.
