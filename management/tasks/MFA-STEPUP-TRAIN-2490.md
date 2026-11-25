# MFA-STEPUP-TRAIN-2490 — Two-factor authentication train: step-up before sensitive actions, recovery codes, passkeys, attestation

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V3 | **Priority:** P2 | **Status:** IN_PROGRESS

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
- **R-MFA-STEPUP-TRAIN-2490-1 / AT-MFA-STEPUP-TRAIN-2490-1:** Two-factor authentication train: step-up before sensitive actions, recovery codes, passkeys, attestation: the 2FA design is built as one train after 2.49.0 with the owner decisions; a SETTING can turn step-up off so 2FA is asked only at the initial login; the long token follows the decision below.

## Deliverables
- change note docs/changes/MFA-STEPUP-TRAIN-2490.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
