# NOTICE-BOARD-FOLLOWUPS-295 — Notice board follow-ups: news sources, deletion, TV options, removal fix, nearby bus times

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
- **R-NOTICE-BOARD-FOLLOWUPS-295-1 / AT-NOTICE-BOARD-FOLLOWUPS-295-1:** Editable news (RSS) sources and connection caps of the TV listener, real deletion of a notice, one-row header / "updated" line / weather forecast days options with installation-wide defaults, the "remove from board" fix and nearby bus times (a labelled estimate, off by default).

## Deliverables
- docs/changes/NOTICERSS-295.md, NOTICEREMOVE-295.md, BUSTIMES-295.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
