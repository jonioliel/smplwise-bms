# TKSECRETS — Arx 2.6.3: secrets moved from add-on options to Settings > Connections > Secrets (migration 0093)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

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
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R354 / AT370:** Arx 2.6.3: secrets moved from add-on options to Settings > Connections > Secrets (migration 0093); fakes only (integ/263).

## Deliverables
- Implementation and regression tests on pilot/TKSECRETS1, pilot/TKSECRETS2
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
