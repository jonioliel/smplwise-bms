# XS-MINI-WIDGET-2351 — Mini building cross-section on the home widgets row

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
- **R-XS-MINI-WIDGET-2351-1 / AT-XS-MINI-WIDGET-2351-1:** A home widget "חתך בניין" shows the building as a stack of floors tinted by the lights that are on, with alarm, temperature and open-door marks; press a floor to open it; off by default.

## Deliverables
- Change record docs/changes/XS-MINI-WIDGET-2351.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
