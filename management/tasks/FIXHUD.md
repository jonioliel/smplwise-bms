# FIXHUD — Opaque HUD panels over the plan, the editor, the history map, the event page and the 3D view (menu surface, strong hairline, Tesla HUD fill)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** DONE

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
- **R315 / AT331:** Opaque HUD panels over the plan, the editor, the history map, the event page and the 3D view (menu surface, strong hairline, Tesla HUD fill): built on fakes / mocked backends and fixtures (pilot/FIX-hud-opaque @ 2033522a); no live device action.

## Deliverables
- Implementation and regression tests in an isolated branch (pilot/FIX-hud-opaque)
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
