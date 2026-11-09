# TTS-DEFAULT-ENGINE-2400 — Announcements: a fixed TTS engine and language, overridable per send

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** DONE

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
- **R-TTS-DEFAULT-ENGINE-2400-1 / AT-TTS-DEFAULT-ENGINE-2400-1:** A system administrator sets a fixed announcement engine and language; every announcement dialog preselects them; a per-send pick changes only that send; a missing fixed engine is never replaced silently and blocks the send until another engine is picked.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
