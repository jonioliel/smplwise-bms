# HOME-SCROLL-3-2530 — The band of large cards folds on the last fit step (the cards info style)

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
- **R-HOME-SCROLL-3-2530-1 / AT-HOME-SCROLL-3-2530-1:** With the cards info style the home screen's band of large cards folds on the squeeze step and every direction x view fits without a page scroll at 1440x900, 1366x768, 1280x800 and 1180x820.

## Deliverables
- Branch pilot/HOME-SCROLL-3-2530, change note docs/changes/HOME-SCROLL-3-2530.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
