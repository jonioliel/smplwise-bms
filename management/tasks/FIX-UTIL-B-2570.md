# FIX-UTIL-B-2570 — Second deep review comms / utilities fixes CU2-09..CU2-11, CU2-19, CU2-21, CU2-33: presence settings atomic and validated, notice TV recovers, insights claim before send, maintenance file deletes

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
- **R-FIX-UTIL-B-2570-1 / AT-FIX-UTIL-B-2570-1:** Second deep review comms / utilities fixes CU2-09..CU2-11, CU2-19, CU2-21, CU2-33: presence settings atomic and validated, notice TV recovers, insights claim before send, maintenance file deletes; merged into the 2.57.0 train, change note docs/changes/FIX-UTIL-B-2570.md.

## Deliverables
- Branch pilot/FIX-UTIL-B-2570, change note docs/changes/FIX-UTIL-B-2570.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
