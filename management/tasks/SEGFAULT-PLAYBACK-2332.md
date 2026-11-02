# SEGFAULT-PLAYBACK-2332 — The add-on recovers by itself after a crash during recorded-playback scrubbing

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P0 | **Status:** REVIEW

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
- **R-SEGFAULT-PLAYBACK-2332-1 / AT-SEGFAULT-PLAYBACK-2332-1:** A crash of the add-on server process restarts it within seconds, is recorded and shown in Diagnostics ("restarts after a crash"), leaves a full trace in the log, and after two crashes within six hours the server restarts on slower, steadier networking components for six quiet hours.

## Deliverables
- Change record docs/changes/SEGFAULT-PLAYBACK-2332.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
