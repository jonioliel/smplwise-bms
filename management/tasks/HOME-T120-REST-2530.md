# HOME-T120-REST-2530 — T120 gap analysis and "My account" inside the home interface

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
- **R-HOME-T120-REST-2530-1 / AT-HOME-T120-REST-2530-1:** A home-only person reaches their own security, sign-ins and language from the home interface personal menu (not on a wall panel); the home-only gate neither refuses nor grants anything new.

## Deliverables
- Branch pilot/HOME-T120-REST-2530, change note docs/changes/HOME-T120-REST-2530.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
