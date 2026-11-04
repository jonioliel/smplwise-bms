# VIDEO-SUB-FALLBACK-2402 — Live video, automatic quality: a sub stream that gives nothing moves to the main stream on the same transport

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** IN_PROGRESS

**Owner role:** frontend | **Hardware:** False

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
- **R-VIDEO-SUB-FALLBACK-2402-1 / AT-VIDEO-SUB-FALLBACK-2402-1:** With the automatic quality, a sub stream that gives no media, is refused or never connects moves to the main stream on the same transport (never another transport), shows the tag "עבר לזרם הראשי", is remembered per camera for 10 minutes and is audited as profile_fallback; an explicit quality never switches and names the missing stream.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
