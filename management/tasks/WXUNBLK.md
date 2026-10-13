# WXUNBLK — Door-opening blocks card: see what the door path blocks and release one script-backed entity by hand

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** DONE

**Owner role:** backend | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "balanced",
  "effort": "medium",
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R311 / AT327:** Door-opening blocks card: see what the door path blocks and release one script-backed entity by hand: built on fakes / mocked backends and fixtures (pilot/WX-small-2410 @ 7f4cd4a6); no live device action.

## Deliverables
- Implementation and regression tests in an isolated branch (pilot/WX-small-2410)
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
