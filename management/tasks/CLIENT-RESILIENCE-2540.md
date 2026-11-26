# CLIENT-RESILIENCE-2540 — Frontend client resilience: read deadline, unreachable is not signed out, update card, step-up dialog life

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** REVIEW

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
- **R-CLIENT-RESILIENCE-2540-1 / AT-CLIENT-RESILIENCE-2540-1:** A plain read ends after 60 s as no connection; an unreachable sign-in service keeps the session; the /me/ws hello carries build and an open page offers the update card; the step-up dialog names the action, expires after 90 s, and a physical action is replayed only within 120 s.

## Deliverables
- Branch pilot/CLIENT-RESILIENCE-2540, change note docs/changes/CLIENT-RESILIENCE-2540.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
