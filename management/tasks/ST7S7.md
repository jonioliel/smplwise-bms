# ST7S7 — Plan Studio 6 S7: performance gate, determinism and release

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V2 | **Priority:** P2 | **Status:** BACKLOG

**Owner role:** fullstack | **Hardware:** False

**Dependencies:** ST7S0, ST7S1, ST7S2, ST7S3, ST7S4, ST7S5

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "deep",
  "review": "deep",
  "effort": "large",
  "model": "opus",
  "estimate_hours": "8-12",
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R264 / AT280:** Plan Studio 6 S7: performance gate, determinism and release: R178 gate (level 3, 1,000 objects, 390 px, 30 fps) with the lever table, baselines, CHANGELOG, owner checklist, registry rows. Verified by the slice tests in CR-029 section 8, with level 1-2 baselines unchanged.

## Deliverables
- Implementation and regression tests in an isolated branch (pilot/ST7-port-s0-s4 for S0 and S4)
- Desktop/mobile/RTL screenshots for UI tasks

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
