# ST7LOOK — Studio 6 look-dev round 3: normals, ground disc, level-3 plates, ceilings, lamp pools, chair model, phone pill cap

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** DONE

**Owner role:** frontend | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "balanced",
  "effort": "medium",
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R312 / AT328:** Studio 6 look-dev round 3: normals, ground disc, level-3 plates, ceilings, lamp pools, chair model, phone pill cap: built on fakes / mocked backends and fixtures (pilot/ST7-look-r3 @ a60239a7); no live device action.

## Deliverables
- Implementation and regression tests in an isolated branch (pilot/ST7-look-r3)
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
