# MEDIUM-REST-2540 — The rest of the medium screen findings and the wall display's new-build notice

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
- **R-MEDIUM-REST-2540-1 / AT-MEDIUM-REST-2540-1:** Map action arguments are per entity and untyped optional arguments are not sent; the walls re-read their cameras; change arrows read in the reading direction; the home push refresh is bounded and selective; +/- on an A/C that is off turns it on; the wall display shows a quiet new-build notice.

## Deliverables
- Branch pilot/MEDIUM-REST-2540, change note docs/changes/MEDIUM-REST-2540.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
