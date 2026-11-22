# CR-GO2RTC-OWNED-2438 — CR-GO2RTC-OWNED-2438 - one "owned streams" rule for go2rtc

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
- **R-CR-GO2RTC-OWNED-2438-1 / AT-CR-GO2RTC-OWNED-2438-1:** Delivered as recorded in docs/changes/CR-GO2RTC-OWNED-2438.md: one "owned streams" rule for go2rtc

## Deliverables
- Change note docs/changes/CR-GO2RTC-OWNED-2438.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
