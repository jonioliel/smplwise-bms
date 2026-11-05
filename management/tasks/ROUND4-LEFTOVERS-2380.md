# ROUND4-LEFTOVERS-2380 — Display U1: polish round 4 leftovers (WisKey area, calendars D22, compact presence card redesign)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** REVIEW

**Owner role:** engineering | **Hardware:** False

**Dependencies:** WISKEY-RC7-ADOPT-2331

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
- **R-ROUND4-LEFTOVERS-2380-1 / AT-ROUND4-LEFTOVERS-2380-1:** The reading-B leftovers of the display phase are done after the WisKey ship: the WisKey area polish (if round-4 question Q4 = b), calendars D22 and the presence card compact follow-up.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
