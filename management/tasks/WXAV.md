# WXAV — WisKey local live video and two-way audio (S18)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V2 | **Priority:** P2 | **Status:** BLOCKED

**Owner role:** fullstack | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "balanced",
  "effort": "large",
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval.",
  "estimate_hours": 24
}
```

## Acceptance
- **R303 / AT319:** WisKey local live video and two-way audio (S18): built and verified on fakes and fixtures; no live device action.

## Deliverables
- Implementation and regression tests in an isolated branch
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.

## Blocker
Waiting for W10 (stream descriptor and audio hook) from the WisKey side; the owner asks to start S18 right after stage 1 as soon as W10 arrives.
