# SEC-FIX-2520 — Step-up lockout, attestation chain, backup key classes and restore safety (2.52 deep review)

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
- **R-SEC-FIX-2520-1 / AT-SEC-FIX-2520-1:** The step-up lockout count survives a rollback (SEC-1); the attestation chain is checked by one shared function with CA flags (SEC-2); security / remote keys never travel with a backup (SEC-3); restored settings are validated (CORE-04); a replace restore is FK-safe and the drill restores onto a read-only copy, refusals 409 restore_refused (CORE-01); the daily backup runs from the stored last run (CORE-02).

## Deliverables
- Branch pilot/SEC-FIX-2520, change note docs/changes/SEC-FIX-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
