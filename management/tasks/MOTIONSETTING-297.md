# MOTIONSETTING-297 — Motion setting ui.motion (auto | full | reduced), separate from the skin and the scheme

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** REVIEW

**Owner role:** engineering | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "deep",
  "review": "deep",
  "effort": "high",
  "escalation": "Design layer: merging DESIGNTOKENS-297 into 2.25.0 conflicts in design/css.ts (reduced-motion block); keep both MOTIONSETTING selectors."
}
```

## Acceptance
- **R-MOTIONSETTING-1 / AT-MOTIONSETTING-1:** ui.motion in the settings defaults (auto), pattern-validated, a corrupt stored value reads as auto, the same permission model and audit as ui.skin; data-motion on the document root; auto = the OS reduced-motion block as before, full = the OS block is excluded, reduced = the same declarations always; a 'Motion' row next to the skin picker in Settings > General > System look; DEVICE_THEMES.md section 10; no migration.

## Deliverables
- Backend: routers/settings.py (ui.motion)
- Frontend: design/apply.ts (data-motion), design/css.ts, screens/system-design.ts (Motion row), api/media.ts, shell/sw-app.ts
- Tests: smplwise_vms/backend/tests/test_ui_settings.py, frontend/tests/unit-motionsetting-297.spec.ts, frontend/tests/smoke-motionsetting-297.spec.ts
- Docs: docs/design/DEVICE_THEMES.md section 10

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
