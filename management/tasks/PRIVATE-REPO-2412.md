# PRIVATE-REPO-2412 — Move development to a private repository (public add-on repository kept)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** BLOCKED

**Owner role:** release | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "balanced",
  "effort": "medium",
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization."
}
```

## Acceptance
- **R-PRIVATE-REPO-2412-1 / AT-PRIVATE-REPO-2412-1:** Following the owner's answers: development moves to a private repository, the public repository keeps only what the owner approves (the add-on distribution), CI / runner / release scripts point at the right remotes, and the move is documented with rollback; no history rewrite without the owner's approval.

## Deliverables
- Migration plan and runbook after the owner's answers

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.

## Blocker
Owner decision pending: the private repository plan questions (hosting, what stays public, history handling) are open with the owner.
