# GATE-HYGIENE-2402 — Gate hygiene: whole-package scanners always run, a Windows-only demo check, the bridge-install state reset between tests

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

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
- **R-GATE-HYGIENE-2402-1 / AT-GATE-HYGIENE-2402-1:** Every backend test that scans the whole package, the router registry or the repository is listed in gate_always_run.json and selected by every gate selection; test_readiness_96 passes on Windows without hiding a leaked handle; bridge_install.STATE never leaks from one test into another (bridge_install and self_update pass in both orders).

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
