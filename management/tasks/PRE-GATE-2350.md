# PRE-GATE-2350 — Browser and backend evidence before the 2.35.0 gate

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
- **R-PRE-GATE-2350-1 / AT-PRE-GATE-2350-1:** The pre-gate runner check of the 2.35.0 train is run and its failures fixed (a11y skeleton spec, evidence-devices specs, compact density on area cards).

## Deliverables
- Change record docs/changes/PRE-GATE-2350.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
