# TEST-DEBT-2412 — Test debt: wall-clock backend tests and the flaky items of the 2.41.0 / 2.41.1 release gates

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
- **R-TEST-DEBT-2412-1 / AT-TEST-DEBT-2412-1:** The test_nvr_less / test_setup_wizard timing failures are fixed at their cause (FastAPI's lazy per-router build measured inside the timed window); every flaky item of the 2.41.0 and 2.41.1 gates is either fixed at a named cause or quarantined with a ticket and an expiry of at most 7 days; changed test files pass 3 runs in a row locally (docs/changes/TEST-DEBT-2412.md).

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
