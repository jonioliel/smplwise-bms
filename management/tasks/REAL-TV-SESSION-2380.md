# REAL-TV-SESSION-2380 — Display D2: real-TV runbook, joint session and fixes

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** BLOCKED

**Owner role:** engineering | **Hardware:** True

**Dependencies:** TV-FIT-2380

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
- **R-REAL-TV-SESSION-2380-1 / AT-REAL-TV-SESSION-2380-1:** A real-TV runbook and checklist (TV page, lobby styles, overscan, remote keys, CSS zoom, saver, day / night) is written, run in a joint session on a lab TV, and the findings are fixed.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.

## Blocker
Waits for the owner (question Q2: a lab TV in a joint session this week, an Android TV box only, or fix blind); TV-FIT-2380 shipped in 2.38.0 (merge 571891e9d).
