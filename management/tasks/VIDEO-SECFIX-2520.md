# VIDEO-SECFIX-2520 — go2rtc error frames never reach a viewer; NVR change detail and undo keep the camera scope

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
- **R-VIDEO-SECFIX-2520-1 / AT-VIDEO-SECFIX-2520-1:** Every go2rtc upstream frame passes the shared sanitizer before a viewer sees it (V-01); the NVR change undo / detail / list keep the camera scope, fail closed (V-04).

## Deliverables
- Branch pilot/VIDEO-SECFIX-2520, change note docs/changes/VIDEO-SECFIX-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
