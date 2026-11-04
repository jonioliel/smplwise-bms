# PUSH-GOLIVE-KIT-2380 — Mobile M4: push go-live kit and supervised field-test script

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
- **R-PUSH-GOLIVE-KIT-2380-1 / AT-PUSH-GOLIVE-KIT-2380-1:** An owner session checklist (Firebase, Apple, keystore, TestFlight or internal track), a relay deploy dry-run with fakes, a health and test-push runbook (docs/operations/ARX_PUSH_RELAY_DEPLOY_HE.md) and a supervised field-test script (docs/operations/MOBILE_FIELD_TEST_HE.md: app 2.1.5, session-exchange 303 proof, saved sign-in switch on the lab server only) exist.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
