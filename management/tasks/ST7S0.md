# ST7S0 — Plan Studio 6 S0: plan document 2.2 schema, material library, resolver, look settings

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V2 | **Priority:** P2 | **Status:** IN_PROGRESS

**Owner role:** fullstack | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "deep",
  "review": "deep",
  "effort": "large",
  "model": "opus",
  "estimate_hours": "10-14",
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R258 / AT274:** Plan Studio 6 S0: plan document 2.2 schema, material library, resolver, look settings: Studio 6 material, ceiling, tint, light, north and walk-position fields; material resolver; installation look settings with a per-person override (migration 0074). Verified by the slice tests in CR-029 section 8, with level 1-2 baselines unchanged.

## Deliverables
- Implementation and regression tests in an isolated branch (pilot/ST7-port-s0-s4 for S0 and S4)
- Desktop/mobile/RTL screenshots for UI tasks

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
