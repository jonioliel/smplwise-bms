# GEN-UNITS-ARRU-2530 — Arabic and Russian unit words and labels for the generator settings and run-log settings

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
- **R-GEN-UNITS-ARRU-2530-1 / AT-GEN-UNITS-ARRU-2530-1:** On an Arabic or Russian page the generator settings and the run-log settings show their unit words and unit-field labels in that language, the unit inside the field frame at the end of the reading direction; Hebrew and English unchanged.

## Deliverables
- Branch pilot/GEN-UNITS-ARRU-2530, change note docs/changes/GEN-UNITS-ARRU-2530.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
