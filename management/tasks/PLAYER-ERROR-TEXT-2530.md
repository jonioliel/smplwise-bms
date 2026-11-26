# PLAYER-ERROR-TEXT-2530 — The video player shows the relay's fixed error codes as sentences with a retry hint

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
- **R-PLAYER-ERROR-TEXT-2530-1 / AT-PLAYER-ERROR-TEXT-2530-1:** A live or recording player that receives a fixed relay error code shows a sentence in the page language with a retry hint, never the raw code; an unknown value gets the generic sentence.

## Deliverables
- Branch pilot/PLAYER-ERROR-TEXT-2530, change note or document, tests where applicable

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
