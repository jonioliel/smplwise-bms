# CR-RESPONSE-MODELS-CONSUMPTION-2450 — Response models and the generated client consumption (code-review 07:F8 step 2)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** IN_PROGRESS

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
- **R-CR-RESPONSE-MODELS-CONSUMPTION-2450-1 / AT-CR-RESPONSE-MODELS-CONSUMPTION-2450-1:** Response models and the generated client consumption (code-review 07:F8 step 2): delivered on pilot/CR-RESPONSE-MODELS-CONSUMPTION-2450 with a change note docs/changes/CR-RESPONSE-MODELS-CONSUMPTION-2450.md, focused tests run and NOT_RUN items recorded, UI baselines refreshed on the runner where pixels move.

## Deliverables
- Branch pilot/CR-RESPONSE-MODELS-CONSUMPTION-2450, change note docs/changes/CR-RESPONSE-MODELS-CONSUMPTION-2450.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
