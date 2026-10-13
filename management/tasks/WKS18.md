# WKS18 — WisKey native screens S18: live video and push-to-talk in the station drawer (access.station_media)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** DONE

**Owner role:** fullstack | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "balanced",
  "effort": "medium",
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R303 / AT319:** WisKey native screens S18: live video and push-to-talk in the station drawer (access.station_media): built on fakes / mocked backends and fixtures on branch pilot/WISKEY-media-s18; no live device action; acceptance test NOT_RUN.

## Deliverables
- Implementation and regression tests in an isolated branch (pilot/WISKEY-media-s18)
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
