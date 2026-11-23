# NATIVE-SELECT-B-2480 — Remaining 241 selects moved to the shared field in design-stripping mode (dropped)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P3 | **Status:** BLOCKED

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
- **R-NATIVE-SELECT-B-2480-1 / AT-NATIVE-SELECT-B-2480-1:** Remaining 241 selects moved to the shared field in design-stripping mode (dropped): dropped by the owner: the branch changes nothing on screen and only lowers the technical-debt counter.

## Deliverables
- change note docs/changes/NATIVE-SELECT-B-2480.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.

## Blocker
Excluded - OBSOLETE by owner decision 2026-11-22 (Q9 = drop the branch; owner answers of 22.11 night (private/planning/answers_2026-11-22_night.txt; questions in questions_all_open_2026-11-22.html)): the 241 selects moved only in a mode that strips the shared field's design, so nothing changes on screen and only the debt counter fell. Not to be worked; the card is kept.
