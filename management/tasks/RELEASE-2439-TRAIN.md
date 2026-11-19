# RELEASE-2439-TRAIN — RELEASE-2439-TRAIN - the 2.43.9 train

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

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
- **R-RELEASE-2439-TRAIN-1 / AT-RELEASE-2439-TRAIN-1:** Delivered as recorded in docs/changes/RELEASE-2439-TRAIN.md: the 2.43.9 train

## Deliverables
- Change note docs/changes/RELEASE-2439-TRAIN.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
