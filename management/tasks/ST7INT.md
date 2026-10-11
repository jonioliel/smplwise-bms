# ST7INT — Plan Studio 6: integration on 2.4.6, migrations 0074-0075, gate and release

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V2 | **Priority:** P2 | **Status:** BACKLOG

**Owner role:** fullstack | **Hardware:** False

**Dependencies:** ST7S0, ST7S4, ST7S1, ST7S2, ST7S3

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "balanced",
  "effort": "medium",
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval.",
  "estimate_hours": 6
}
```

## Acceptance
- **R290 / AT306:** Plan Studio 6: integration on 2.4.6, migrations 0074-0075, gate and release: built and verified on fakes and fixtures; no live device action.

## Deliverables
- Implementation and regression tests in an isolated branch (integration branch)
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
