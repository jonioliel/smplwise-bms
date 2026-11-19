# CR-FEED-BASE-2450 — HA feed base (code-review 02:P2-5): one base for the Home Assistant state feed consumers

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
- **R-CR-FEED-BASE-2450-1 / AT-CR-FEED-BASE-2450-1:** HA feed base (code-review 02:P2-5): one base for the Home Assistant state feed consumers: delivered on pilot/CR-FEED-BASE-2450 with a change note docs/changes/CR-FEED-BASE-2450.md, focused tests run and NOT_RUN items recorded, UI baselines refreshed on the runner where pixels move.

## Deliverables
- Branch pilot/CR-FEED-BASE-2450, change note docs/changes/CR-FEED-BASE-2450.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
