# TIME-CORRECT-2540 — Time, day and booking truth (DST days, occurrence cancel, bill zone, server clock, far series)

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
- **R-TIME-CORRECT-2540-1 / AT-TIME-CORRECT-2540-1:** Bookings on the DST change days are stored at the chosen wall-clock time; a recurring cancel offers only-this-date; a displaced booking is never approved; bill instants print on the bill's zone; commands are stamped on the server's time line; a series past the cache horizon still blocks a double booking.

## Deliverables
- Branch pilot/TIME-CORRECT-2540, change note docs/changes/TIME-CORRECT-2540.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
