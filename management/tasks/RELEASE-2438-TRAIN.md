# RELEASE-2438-TRAIN — RELEASE-2438-TRAIN: assembly of the 2.43.8 train (first part - the branches whose entry check is GREEN)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** DONE

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
- **R-RELEASE-2438-TRAIN-1 / AT-RELEASE-2438-TRAIN-1:** Delivered as recorded in docs/changes/RELEASE-2438-TRAIN.md: assembly of the 2.43.8 train (first part - the branches whose entry check is GREEN)

## Deliverables
- Change note docs/changes/RELEASE-2438-TRAIN.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
