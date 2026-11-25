# MFA-PASSKEY-ADMIN-REMOVE-2520 — An administrator's removal of an Arx-only identity's passkey meets the factor reset's rules

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
- **R-MFA-PASSKEY-ADMIN-REMOVE-2520-1 / AT-MFA-PASSKEY-ADMIN-REMOVE-2520-1:** An administrator's removal of another identity's passkey has a preflight (remove-check) and follows the factor reset's rules (fresh sign-in, last remote administrator, notices).

## Deliverables
- Branch pilot/MFA-PASSKEY-ADMIN-REMOVE-2520, change note docs/changes/MFA-PASSKEY-ADMIN-REMOVE-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
