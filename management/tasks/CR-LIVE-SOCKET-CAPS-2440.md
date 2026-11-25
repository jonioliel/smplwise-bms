# CR-LIVE-SOCKET-CAPS-2440 — CR-LIVE-SOCKET-CAPS-2440: Code-review batch 16.11, wave 3A (backend). Plan row pilot/CR-LIVE-SOCKET-CAPS-2436 in private/code-review-2026-11-13/MASTER_PLAN.md; findings 03:F07, 03:F19, 03:F23. Base: origin/pilot/CR-WAVE2-COMBINED-2439 (97080bbc4).

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** DONE

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
- **R-CR-LIVE-SOCKET-CAPS-2440-1 / AT-CR-LIVE-SOCKET-CAPS-2440-1:** Delivered as recorded in docs/changes/CR-LIVE-SOCKET-CAPS-2440.md: Code-review batch 16.11, wave 3A (backend). Plan row pilot/CR-LIVE-SOCKET-CAPS-2436 in private/code-review-2026-11-13/MASTER_PLAN.md; findings 03:F07, 03:F19, 03:F23. Base: origin/pilot/CR-WAVE2-COMBINED-2439 (97080bbc4).

## Deliverables
- Change note docs/changes/CR-LIVE-SOCKET-CAPS-2440.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
