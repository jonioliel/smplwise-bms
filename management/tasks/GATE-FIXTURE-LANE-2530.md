# GATE-FIXTURE-LANE-2530 — The release gate runs the fixture specs as a lane (one job per fixture group)

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
- **R-GATE-FIXTURE-LANE-2530-1 / AT-GATE-FIXTURE-LANE-2530-1:** The release gate engine runs every fixture spec marked "gate" in fixture_specs.json as one fixture_<group> job per group; the self-tests pass; the engine is installed on the runner only after 2.52 is released (the lead).

## Deliverables
- Branch pilot/GATE-FIXTURE-LANE-2530, change note docs/changes/GATE-FIXTURE-LANE-2530.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
