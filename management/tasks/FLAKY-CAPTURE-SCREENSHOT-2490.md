# FLAKY-CAPTURE-SCREENSHOT-2490 — Find and fix the intermittent "Unable to capture screenshot" failure in the UI test runs

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** BACKLOG

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
- **R-FLAKY-CAPTURE-SCREENSHOT-2490-1 / AT-FLAKY-CAPTURE-SCREENSHOT-2490-1:** Find and fix the intermittent "Unable to capture screenshot" failure in the UI test runs: the cause of the occasional "Unable to capture screenshot" error is found and fixed or quarantined with a ticket; evidence from repeated runs is recorded.

## Deliverables
- Branch pilot/FLAKY-CAPTURE-SCREENSHOT-2490, change note docs/changes/FLAKY-CAPTURE-SCREENSHOT-2490.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
