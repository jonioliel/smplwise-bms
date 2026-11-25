# MFA-REVIEW-DOCS-2520 — Security review and documentation of the second factor shipped in 2.49-2.51 (slice 12)

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
- **R-MFA-REVIEW-DOCS-2520-1 / AT-MFA-REVIEW-DOCS-2520-1:** Deep security review of the second-factor gates, enrolment and recovery shipped in 2.49-2.51, the small fixes it finds with tests, and the owner guide in Hebrew and English (slice 12 of MFA-STEPUP-TRAIN-2490).

## Deliverables
- Branch pilot/MFA-REVIEW-DOCS-2520, change note docs/changes/MFA-REVIEW-DOCS-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
