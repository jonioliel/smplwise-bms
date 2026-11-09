# RELEASE-2400-TRAIN — Release 2.40.0: video transport, fixed TTS engine, installer tools, presence card, owner answers round 18

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** DONE

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
- **R-RELEASE-2400-TRAIN-1 / AT-RELEASE-2400-TRAIN-1:** Release 2.40.0 = 2.39.1 plus the 2.40.0 train branches, gated on the runner, merged to main and tagged v2.40.0.

## Deliverables
- Version commit, runner gate record, tag v2.40.0

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
