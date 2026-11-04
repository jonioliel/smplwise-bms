# GUIDE-BOARD-2402 — User guide for 2.40.0 / 2.40.1 and the task board after 04.11

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** IN_PROGRESS

**Owner role:** docs | **Hardware:** False

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
- **R-GUIDE-BOARD-2402-1 / AT-GUIDE-BOARD-2402-1:** The Hebrew user guide describes the 2.40.0 / 2.40.1 changes (video transport and the personal choice, the stalled picture, the fixed TTS engine, the intercom settings cards, the phone wall toolbar, the bridge pairing state after 2.39.1); GUIDE_ALL_HE.html is rebuilt from its sources; the task board records the 04.11 releases, lab work and open items; the views are regenerated.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
