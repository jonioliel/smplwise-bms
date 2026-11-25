# MFA-T095-REST-2530 — The rest of T095: approval on the phone with number matching, the alarm code as step-up

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
- **R-MFA-T095-REST-2530-1 / AT-MFA-T095-REST-2530-1:** With security.push_approval on (default off) a step-up can be approved on the phone that holds the key by typing the two-digit number; never for once-actions or own factor changes; with security.step_up_alarm_pin on (default off) the personal alarm code proves one disarm / bypass.

## Deliverables
- Branch pilot/MFA-T095-REST-2530, change note docs/changes/MFA-T095-REST-2530.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
