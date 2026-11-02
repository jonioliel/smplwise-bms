# POLISH-PHONE-2310 — Phone layer polish: chips and switch hit areas

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
- **R-POLISH-PHONE-2310-1 / AT-POLISH-PHONE-2310-1:** Phone layer: 16 px fields (no zoom on focus), no tap flash, no sticky hover, press feedback, 44 px hit areas, phone type tiers, dropdowns and pop-ups inside the screen (dvh).

## Deliverables
- Code and tests in git history of pilot/POLISH-PHONE-2310

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
