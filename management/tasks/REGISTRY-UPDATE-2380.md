# REGISTRY-UPDATE-2380 — Registry H1: tasks.json and test_catalog brought up to date after v2.35.0

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
- **R-REGISTRY-UPDATE-2380-1 / AT-REGISTRY-UPDATE-2380-1:** management/tasks.json, requirements.json and test_catalog.json match git after v2.35.0 and the 2.36.0 / 2.36.1 / 2.37.0 trains, the WisKey adoption and the 2.38.0 plan; the views are regenerated; DONE only with a release tag containing the work and a PASS record; NOT_RUN and BLOCKED stay explicit.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
