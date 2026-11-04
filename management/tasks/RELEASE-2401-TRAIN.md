# RELEASE-2401-TRAIN — Release 2.40.1: phone wall toolbar, intercom settings cards, bridge 0.10.4

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
- **R-RELEASE-2401-TRAIN-1 / AT-RELEASE-2401-TRAIN-1:** Release 2.40.1 = 2.40.0 plus BRIDGE-UPDATE-LISTENER-2401, WALL-PHONE-TOOLBAR-2401 and SETTINGS-INTERCOM-CARDS-2401, gated on the runner, merged to main and tagged v2.40.1.

## Deliverables
- Version commit, runner gate record, tag v2.40.1

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
