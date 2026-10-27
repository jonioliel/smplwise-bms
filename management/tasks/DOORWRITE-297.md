# DOORWRITE-297 — Door-window program written from Arx to WisKey (board r129): validate, read-back proof, drift, retries, dry run, write again

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
  "escalation": "Door safety: no activation flag flipped; the one internal-door lab write runs only with the owner present, per the runbook."
}
```

## Acceptance
- **R-DOORWRITE-1 / AT-DOORWRITE-1:** CR-039 4.3 on the Native program commands (technical_program_list / _save / _action pause): the weekly program composed from the Arx schedule is validated before any send (WisKey policy shape, Arx name, catalog size cap), written read-first with pause-before-edit, and counted written only when a read-back proves it (canonical comparison); unchanged programs are never re-sent; program_version +1 per proven write; a door believed written is re-read at most every 15 min and drift (missing / disabled / changed / foreign) is recorded and never corrected automatically; failed writes wait 60 s .. 30 min (5 attempts) then stay failed until a person or a new document; the close direction (pause) always proceeds; a Hebrew sentence per state; GET .../program/preview writes nothing; POST .../program/apply needs access.windows.manage, a person and a confirmation; audit rows carry ids and codes only; migration 0180 additive; PROGRAM_ENGINE_BUILT and EMERGENCY_ENGINE_BUILT stay False.

## Deliverables
- Backend: services/door_window_program.py (validation, canonical comparison, drift, retry, Hebrew messages), services/door_windows.py (_write_program read-back, sync write states, program_preview, write_again, program_view), routers/door_windows.py (program/preview, program/apply, doors[].program), migration 0180_door_window_program_write.sql
- Tests: tests/test_doorwrite_297.py
- Docs: docs/changes/DOORWRITE-297.md, docs/integrations/wiskey/RUNBOOK_DOORWRITE_FIRST_LAB_WRITE.md (prepared, not run)

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
