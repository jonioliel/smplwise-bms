# RELEASE-2360-TRAIN — Release train 2.36.0 (building scope, mapping, labels, feed review, GDrive ready, home edit drawer, presence line, xs widget)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** IN_PROGRESS

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
- **R-RELEASE-2360-TRAIN-1 / AT-RELEASE-2360-TRAIN-1:** Release 2.36.0 is assembled, gated on the runner, merged to main and tagged v2.36.0 with bilingual release notes.

## Deliverables
- Release commit, runner gate record, tag v2.36.0

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
