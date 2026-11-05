# WALL-FOLLOWUPS-2380 — Display D5: wall display follow-ups (desktop wall mode, foldable detection, AT221 / AT301 evidence)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** REVIEW

**Owner role:** engineering | **Hardware:** False

**Dependencies:** POLISH4-WP2-LIVEINV-2370, T107

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
- **R-WALL-FOLLOWUPS-2380-1 / AT-WALL-FOLLOWUPS-2380-1:** A "wall mode on desktop" flag exists, foldable devices at 600-700 px are detected correctly, and AT221 and AT301 are run on the runner with evidence.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
