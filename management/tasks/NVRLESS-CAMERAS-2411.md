# NVRLESS-CAMERAS-2411 — Camera screens without a recorder, WebRTC server notice, cameras on the floor map (2.41.1)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

**Owner role:** frontend | **Hardware:** False

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
- **R-NVRLESS-CAMERAS-2411-1 / AT-NVRLESS-CAMERAS-2411-1:** The capability cameras_available (nvr OR at least one camera without a recorder) gates the live overview, wall, saved views, kiosk and camera screen instead of nvr; live_video counts a camera without a recorder only when go2rtc exists; without a WebRTC server (go2rtc) adding a camera or testing a stream is disabled with a notice; cameras without a recorder can be placed on the floor map.

## Deliverables
- Implementation and regression tests (merged)
- Change record docs/changes/NVRLESS-CAMERAS-2411.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
