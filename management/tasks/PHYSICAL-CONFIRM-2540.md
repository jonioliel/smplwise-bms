# PHYSICAL-CONFIRM-2540 — Physical actions behind their confirmation, honest outcomes, the call banner does not swap

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
- **R-PHYSICAL-CONFIRM-2540-1 / AT-PHYSICAL-CONFIRM-2540-1:** The NVR alarm-output pulse confirms naming output, recorder and length (focus on cancel) and goes to the confirmed recorder once; physical outcomes read refused vs unknown; the incoming-call banner keeps its front call by id; the automation device test follows each action record.

## Deliverables
- Branch pilot/PHYSICAL-CONFIRM-2540, change note docs/changes/PHYSICAL-CONFIRM-2540.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
