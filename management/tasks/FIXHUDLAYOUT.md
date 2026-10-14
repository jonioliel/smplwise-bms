# FIXHUDLAYOUT — Floor map HUD layout contract (map/hud-layout.ts): corner controls, docked list and level bar never collide

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
- **R316 / AT332:** Floor map HUD layout contract (map/hud-layout.ts): corner controls, docked list and level bar never collide: built on fakes / mocked backends and fixtures (pilot/FIX-hud-layout-2411 @ 157e5fb7); no live device action.

## Deliverables
- Implementation and regression tests in an isolated branch (pilot/FIX-hud-layout-2411)
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
