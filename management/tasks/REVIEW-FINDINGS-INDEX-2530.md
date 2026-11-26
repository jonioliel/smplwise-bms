# REVIEW-FINDINGS-INDEX-2530 — Index of the 2.52 deep-review findings and where each was handled

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P3 | **Status:** REVIEW

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
- **R-REVIEW-FINDINGS-INDEX-2530-1 / AT-REVIEW-FINDINGS-INDEX-2530-1:** docs/review/DEEP-REVIEW-2520-INDEX.md lists every 2.52 deep-review finding with the row or decision that handled it.

## Deliverables
- Branch chore/REVIEW-FINDINGS-INDEX-2530, change note or document, tests where applicable

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
