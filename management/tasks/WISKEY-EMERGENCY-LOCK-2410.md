# WISKEY-EMERGENCY-LOCK-2410 — WisKey T21: emergency LOCK / secure

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** BLOCKED

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
- **R-WISKEY-EMERGENCY-LOCK-2410-1 / AT-WISKEY-EMERGENCY-LOCK-2410-1:** An emergency secure / LOCK command for WisKey doors, behind the emergency switches and approvals.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.

## Blocker
Waits for WisKey: emergency secure support (today emergency_secure_unsupported_v1; plan section 5, Q-WK-7).
