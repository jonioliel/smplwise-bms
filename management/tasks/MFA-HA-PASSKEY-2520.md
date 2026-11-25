# MFA-HA-PASSKEY-2520 — Passkey sign-in for users who come in through the home-system identity

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
- **R-MFA-HA-PASSKEY-2520-1 / AT-MFA-HA-PASSKEY-2520-1:** A passkey can be the remote sign-in second step of home-system users, behind security.passkey_remote_factor (default off); pixel baseline of the policy tab refreshed.

## Deliverables
- Branch pilot/MFA-HA-PASSKEY-2520, change note docs/changes/MFA-HA-PASSKEY-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
