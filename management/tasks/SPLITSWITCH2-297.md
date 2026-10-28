# SPLITSWITCH2-297 — Emergency-buttons switch is a setting (owner q48): default on, admin-only, audited, confirmed when turned off; a gate on the build flags, never an activation

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

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
  "escalation": "Door safety: no build flag flipped; a screen switch never turns an engine on by itself."
}
```

## Acceptance
- **R-SPLITSWITCH2-1 / AT-SPLITSWITCH2-1:** New setting doors.emergency.engine_switch (default on, key/value settings, no migration) gates on top of the permit and EMERGENCY_ENGINE_BUILT, never an activation (build constants still off); live_ok / open_available / enabled / open_enabled / settings_view honour it, releasing an incident never reads it; turning enabled / open_enabled on while the switch is off is refused (engine_switch_off); only PUT /doors/emergency/settings (installation configure permission, named person) writes it, every change audited (settings.changed, before / after); turning it off needs confirm_engine_off and is refused during an active emergency; a Hebrew switch with a confirmation dialog (he/en/ar/ru); the API adds build_ready; tests/test_splitswitch2_297.py; docs/changes/SPLITSWITCH2-297.md.

## Deliverables
- Backend: routers/door_windows.py, services/door_emergency.py
- Frontend: api/door-windows.ts, i18n/door-windows.ts, screens/door-windows.ts
- Tests: smplwise_vms/backend/tests/test_splitswitch2_297.py, frontend/tests/evidence-doorwin-295.spec.ts
- Docs: docs/changes/SPLITSWITCH2-297.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
