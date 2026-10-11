# WXN01 — WisKey native screens S0+S1: WisKey fake, pinned catalogue, last_access removal, background projection, channel guard

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** REVIEW

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
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval.",
  "estimate_hours": 10
}
```

## Acceptance
- **R297 / AT313:** WisKey native screens S0+S1: WisKey fake, pinned catalogue, last_access removal, background projection, channel guard: built and verified on fakes and fixtures; no live device action.

## Deliverables
- Implementation and regression tests in an isolated branch (pilot/WISKEY-native-s0-s1)
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
