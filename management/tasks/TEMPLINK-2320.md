# TEMPLINK-2320 — Report links: revoke on user deactivation, per-sender daily limit

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** DONE

**Owner role:** engineering | **Hardware:** False

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
- **R-TEMPLINK-2320-1 / AT-TEMPLINK-2320-1:** Every report link sent to a user is revoked when the user is deactivated or deleted; a per-sender daily limit for new links (default 50, a setting); the recipient name stays in the audit log (owner decisions 31.10).

## Deliverables
- Code and tests in git history of the merged branch

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
