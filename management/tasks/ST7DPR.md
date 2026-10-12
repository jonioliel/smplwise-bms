# ST7DPR — Plan Studio 6: dpr_cap is the pixel ratio of the first realistic frame and moves at once (fix of the 2.4.7 known limit)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V2 | **Priority:** P2 | **Status:** REVIEW

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
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R177 / AT177:** Plan Studio 6: dpr_cap is the pixel ratio of the first realistic frame and moves at once (fix of the 2.4.7 known limit): built on fakes / mocked backends and fixtures on branch pilot/ST7-dpr-cap; no live device action; acceptance test NOT_RUN.

## Deliverables
- Implementation and regression tests in an isolated branch (pilot/ST7-dpr-cap)
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
