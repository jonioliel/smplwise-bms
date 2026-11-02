# AZIA-LIVE-2331 — Provision-ISR live video steadier on a full wall of cameras

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

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
- **R-AZIA-LIVE-2331-1 / AT-AZIA-LIVE-2331-1:** Stream capabilities read from a Provision-ISR recorder are kept for ten minutes and shared, and when the recorder is briefly busy a tile opens on the stream the add-on already has instead of failing. The measurement on the owner's site is BLOCKED (no access; AZIA_LIVE_DIAG_2026-11-01_HE.md in private/).

## Deliverables
- Code and tests in git history of the merged branch

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
