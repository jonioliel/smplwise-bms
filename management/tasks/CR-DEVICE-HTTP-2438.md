# CR-DEVICE-HTTP-2438 — CR-DEVICE-HTTP-2438 - the shared device-HTTP code leaves the Hikvision module

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
- **R-CR-DEVICE-HTTP-2438-1 / AT-CR-DEVICE-HTTP-2438-1:** Delivered as recorded in docs/changes/CR-DEVICE-HTTP-2438.md: the shared device-HTTP code leaves the Hikvision module

## Deliverables
- Change note docs/changes/CR-DEVICE-HTTP-2438.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
