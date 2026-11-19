# CR-W3B-BE-COMBINED-2443 — CR-W3B-BE-COMBINED-2443 - the wave-3B backend chain (BE-1..BE-4) on the 2.43.8 train, for 2.43.9

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
- **R-CR-W3B-BE-COMBINED-2443-1 / AT-CR-W3B-BE-COMBINED-2443-1:** Delivered as recorded in docs/changes/CR-W3B-BE-COMBINED-2443.md: the wave-3B backend chain (BE-1..BE-4) on the 2.43.8 train, for 2.43.9

## Deliverables
- Change note docs/changes/CR-W3B-BE-COMBINED-2443.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
