# MAPPING-ASSIST-2330 — Mapping assistant: which home-system name belongs to which building

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
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization."
}
```

## Acceptance
- **R-MAPPING-ASSIST-2330-1 / AT-MAPPING-ASSIST-2330-1:** The assistant finds which home-system names belong to which building from a mark in the name, keeps a mark-to-building table, asks only about exceptions, applies the plan only after "Apply", keeps restorable versions (migration 0189).

## Deliverables
- Change record docs/changes/MAPPING-ASSIST-2330.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
