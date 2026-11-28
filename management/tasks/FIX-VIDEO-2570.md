# FIX-VIDEO-2570 — Deep review fixes VD-02 (settings, reboot, disk check, camera reboot), VD-03 rest, SCR-29, SCR-54, alarm expires_too_far: lost NVR answers are unknown, OSD re-read, schedules bulk on the page

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** REVIEW

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
- **R-FIX-VIDEO-2570-1 / AT-FIX-VIDEO-2570-1:** Deep review fixes VD-02 (settings, reboot, disk check, camera reboot), VD-03 rest, SCR-29, SCR-54, alarm expires_too_far: lost NVR answers are unknown, OSD re-read, schedules bulk on the page; merged into the 2.57.0 train, change note docs/changes/FIX-VIDEO-2570.md.

## Deliverables
- Branch pilot/FIX-VIDEO-2570, change note docs/changes/FIX-VIDEO-2570.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
