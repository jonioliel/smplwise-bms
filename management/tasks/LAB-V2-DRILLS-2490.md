# LAB-V2-DRILLS-2490 — Disconnect drills a, b and c (V2) closed

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P3 | **Status:** REVIEW

**Owner role:** engineering | **Hardware:** True

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
- **R-LAB-V2-DRILLS-2490-1 / AT-LAB-V2-DRILLS-2490-1:** Disconnect drills a, b and c (V2) closed: drill a (recorder network cable, 3 minutes), drill b (video service stop and restart) and drill c (home system disconnect) are closed as done.

## Deliverables
- Owner-run lab step with a redacted result recorded in docs/changes/

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
