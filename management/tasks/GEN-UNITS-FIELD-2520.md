# GEN-UNITS-FIELD-2520 — Generator routing: minute fields carry their unit inside the frame

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** IN_PROGRESS

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
- **R-GEN-UNITS-FIELD-2520-1 / AT-GEN-UNITS-FIELD-2520-1:** The generator routing minute fields show their unit inside the field frame like the settings of GEN-UNITS-FIELD-2490; texts in all 4 languages; evidence spec evidence-gen-units-routing-2520.

## Deliverables
- Branch pilot/GEN-UNITS-FIELD-2520, change note docs/changes/GEN-UNITS-FIELD-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
