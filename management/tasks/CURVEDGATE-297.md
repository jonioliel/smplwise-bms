# CURVEDGATE-297 — Curved walls stage 1a: the two live curved-wall browser specs (evidence-curved-walls, evidence-curve-points) join the release gate's fixture phase

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
  "effort": "low",
  "escalation": "Gate configuration only; a red result of either spec in the first gate is a real curved-wall regression or a fixture gap, triaged before quarantine."
}
```

## Acceptance
- **R-CURVEDGATE-1 / AT-CURVEDGATE-1:** frontend/tests/fixtures/fixture_specs.json marks evidence-curved-walls.spec.ts and evidence-curve-points.spec.ts gate=true (group devices, devices_fake_ha.py); the built-in FIXTURE_SPECS default of scripts/gate/release_gate.py is the same set; test_fixture_job.py pins the JSON, the job and the built-in default; no product code changes; the next L-tier gate runs both specs against the fake backend and they pass on desktop and mobile.

## Deliverables
- Gate list: frontend/tests/fixtures/fixture_specs.json (two gate flags), scripts/gate/release_gate.py (built-in FIXTURE_SPECS), scripts/gate/release_gate.sh (header comment)
- Tests: smplwise_vms/backend/tests/test_fixture_job.py (expected set + built-in default pinned)
- Docs: docs/operations/RUNNER_FIXTURE_JOB.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
