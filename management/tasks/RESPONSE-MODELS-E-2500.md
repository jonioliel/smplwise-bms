# RESPONSE-MODELS-E-2500 — Response-model ratchet, ExactModel and response models for the next routers (RESPONSE-MODELS-E-2480 on v2.48.0)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** DONE

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
- **R-RESPONSE-MODELS-E-2500-1 / AT-RESPONSE-MODELS-E-2500-1:** The response-model ratchet and ExactModel, with response models for the next routers; the real wire gaps found under SW_WIRE_STRICT fixed; full backend run clean before boarding.

## Deliverables
- Branch pilot/RESPONSE-MODELS-E-2500, change note docs/changes/RESPONSE-MODELS-E-2500.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
