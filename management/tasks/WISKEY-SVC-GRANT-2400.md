# WISKEY-SVC-GRANT-2400 — WisKey T17: service-write grant path

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
- **R-WISKEY-SVC-GRANT-2400-1 / AT-WISKEY-SVC-GRANT-2400-1:** Arx shows and requests the WisKey service-write grant from the status page once WisKey publishes a grant writer.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.

## Blocker
Waits for WisKey: a writer for native_service_grants_v1 on a manual install (plan section 5, Q-WK-4).
