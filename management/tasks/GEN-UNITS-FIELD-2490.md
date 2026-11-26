# GEN-UNITS-FIELD-2490 — Generator settings: units move from the field label into the field frame

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** DONE

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
- **R-GEN-UNITS-FIELD-2490-1 / AT-GEN-UNITS-FIELD-2490-1:** Generator settings: units move from the field label into the field frame: the generator settings show units inside the field frame like electricity and water; text changes exist in all 4 languages.

## Deliverables
- Branch pilot/GEN-UNITS-FIELD-2490, change note docs/changes/GEN-UNITS-FIELD-2490.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
