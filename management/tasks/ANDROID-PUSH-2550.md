# ANDROID-PUSH-2550 — Android push without Google (UnifiedPush), server side, off by default (CR-012 4C, T096)

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
- **R-ANDROID-PUSH-2550-1 / AT-ANDROID-PUSH-2550-1:** With unifiedpush_servers set, a device registers a UnifiedPush endpoint on a listed server and receives content-less RFC 8291 pushes under the app channel's policy; every sign-out path clears it; the endpoint is never returned, logged, audited or exported; an empty option = off.

## Deliverables
- Branch pilot/ANDROID-PUSH-2550, change note docs/changes/ANDROID-PUSH-2550.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
