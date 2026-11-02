# PLAYBACK-SCRUB-2341 — Smooth recorded playback under fast scrubbing

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
- **R-PLAYBACK-SCRUB-2341-1 / AT-PLAYBACK-SCRUB-2341-1:** Rapid seeks are merged (only the last is sent), each seek closes the old stream before opening the next, a per-minute seek cap (setting, default 30) shows a Hebrew notice, and timeline previews show the nearest available picture within 30 seconds.

## Deliverables
- Change record docs/changes/PLAYBACK-SCRUB-2341.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
