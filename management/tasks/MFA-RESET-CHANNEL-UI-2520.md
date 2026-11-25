# MFA-RESET-CHANNEL-UI-2520 — The reset channel on the second-factor tab; step-up dialog wording; a passkey as the enrolment

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
- **R-MFA-RESET-CHANNEL-UI-2520-1 / AT-MFA-RESET-CHANNEL-UI-2520-1:** The factor-reset channel is set on the second-factor tab (back to 'anywhere' only from the local network); the step-up dialog says when a passkey cannot be used in this browser; the sign-in's enrolment step offers a passkey.

## Deliverables
- Branch pilot/MFA-RESET-CHANNEL-UI-2520, change note docs/changes/MFA-RESET-CHANNEL-UI-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
