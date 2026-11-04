# AREA-PRESENCE-LINE-2351 — Presence line in the area screen and quick pop-up

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
- **R-AREA-PRESENCE-LINE-2351-1 / AT-AREA-PRESENCE-LINE-2351-1:** The area screen and the area quick pop-up show one presence line (room state from its presence sensors and the people the phone app places there, by permission and the show-names setting; building-presence viewers without people rights see an anonymous count); off by default.

## Deliverables
- Change record docs/changes/AREA-PRESENCE-LINE-2351.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
