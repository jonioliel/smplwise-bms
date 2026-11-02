# SETTINGS-TABS-SCROLL-2331 — Scroll arrows, wheel, swipe and keys for long tab strips

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
- **R-SETTINGS-TABS-SCROLL-2331-1 / AT-SETTINGS-TABS-SCROLL-2331-1:** Long tab strips scroll with arrows at their ends, the mouse wheel, a swipe and the keyboard (arrow keys, Home / End); a strip that fits looks as before.

## Deliverables
- Change record docs/changes/SETTINGS-TABS-SCROLL-2331.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
