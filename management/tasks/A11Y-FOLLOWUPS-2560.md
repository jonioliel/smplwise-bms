# A11Y-FOLLOWUPS-2560 — Accessibility follow-ups: DST note, one announcer, alert card and area row names, step-up button description

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
- **R-A11Y-FOLLOWUPS-2560-1 / AT-A11Y-FOLLOWUPS-2560-1:** Accessibility follow-ups: DST note, one announcer, alert card and area row names, step-up button description; merged into the 2.56.0 train, change note docs/changes/A11Y-FOLLOWUPS-2560.md.

## Deliverables
- Branch pilot/A11Y-FOLLOWUPS-2560, change note docs/changes/A11Y-FOLLOWUPS-2560.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
