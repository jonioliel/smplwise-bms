# OWNER-R32-BACKEND-2438 — OWNER-R32-BACKEND-2438 - owner round 32 backend decisions: generator alert roles (O1 a), RTSP passwords in the go2rtc log (Q-SEC-2), go-live permit texts (O9 a)

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
- **R-OWNER-R32-BACKEND-2438-1 / AT-OWNER-R32-BACKEND-2438-1:** Delivered as recorded in docs/changes/OWNER-R32-BACKEND-2438.md: owner round 32 backend decisions: generator alert roles (O1 a), RTSP passwords in the go2rtc log (Q-SEC-2), go-live permit texts (O9 a)

## Deliverables
- Change note docs/changes/OWNER-R32-BACKEND-2438.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
