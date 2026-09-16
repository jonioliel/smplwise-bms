# Model policy and run limits (T010)

Machine-readable source of truth: [`MODEL_POLICY.json`](../../MODEL_POLICY.json) at the repository root
(schema 1, status `ACTIVE_LOCAL`). This page explains it for people.

## Aliases

| Alias in task cards | Resolved to | Reasoning effort | Why |
|---|---|---|---|
| `balanced` | the model of the interactive Claude Code session (`claude-fable-5-1` since 2026-09-14) | medium | day-to-day segments: implementation, tests, evidence |
| `deep` | the same session model | high | architecture, security and contract decisions |

Names such as "Astra" or "Sol" in the planning kit are preferences, not API identifiers; no task text
switches models by itself. The owner chooses the session model in the Claude Code app; the policy only
records what was used so reviews can name the model and version.

## Limits (as configured)

| Limit | Value | Meaning |
|---|---|---|
| `max_repair_attempts` | 2 | after two failed repair attempts on a failing test or build, stop and report instead of looping |
| `approved_spend_limit_usd` | not set | no paid calls are made by project code; the session itself is covered by the owner's plan |
| `allow_paid_calls` | false | no AI-provider calls from the product (the plan normalizer is local; an AI provider would need the owner's consent and budget per handoff §ט) |
| `allow_physical_actions` | false | nothing physical on the lab without an explicit, task-specific approval (AGENTS.md) |
| `allow_production_deployment` | false | the owner installs versions from `main` himself; the assistant only publishes to the repository and refreshes the add-on store |

## Working rules that follow from it

- Every segment ends with tests run, evidence captured, a version bump when behaviour changed, a commit on
  `g0/intake` fast-forwarded to `main`, and a Hebrew report with the progress table (`scripts/progress.py`).
- Read-only against the NVR and Home Assistant users; writes only to the add-on's own data, the
  `smplwise_` go2rtc namespace and the bridge integration directory (see the secrets audit).
- Task cards stay `BACKLOG` with pre-evidence lines until the G0 gates close and the owner accepts.

Owner sign-off of this page closes T010 (2026-09-16 draft).
