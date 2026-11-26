# STALE-ANSWERS-2540 — A late answer never overwrites a newer selection; a double action runs once

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
- **R-STALE-ANSWERS-2540-1 / AT-STALE-ANSWERS-2540-1:** The bulk dialog, recorded playback, home bill, home scene sheet and resident day keep the newest selection when an older answer lands last; home recording taps and seeks run once / in order; a home ticket note with the same client_request_id is added once.

## Deliverables
- Branch pilot/STALE-ANSWERS-2540, change note docs/changes/STALE-ANSWERS-2540.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
