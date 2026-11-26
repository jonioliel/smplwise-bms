# TEST-STABILITY-2530 — Two test stability fixes: the nvrless plan editor placement click, a hermetic engine_sync selftest

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
- **R-TEST-STABILITY-2530-1 / AT-TEST-STABILITY-2530-1:** evidence-nvrless-cameras-2412 places the camera at a mapped plan point after real readiness signals (passes under load); selftest_engine_sync.py passes whatever runs on the machine (fake home, fake process table).

## Deliverables
- Branch pilot/TEST-STABILITY-2530, change note or document, tests where applicable

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
