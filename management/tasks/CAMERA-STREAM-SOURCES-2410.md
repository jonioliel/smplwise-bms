# CAMERA-STREAM-SOURCES-2410 — Video source per camera and cameras without a recorder (2.41.0)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

**Owner role:** backend | **Hardware:** False

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
- **R-CAMERA-STREAM-SOURCES-2410-1 / AT-CAMERA-STREAM-SOURCES-2410-1:** A holder of system.configure can set a camera's video source to the recorder (default, unchanged) or to manual main / sub RTSP addresses served through go2rtc streams smplwise_cam_<id>_<main|sub>; can add and remove a camera without a recorder (live and snapshots only, recording / playback / NVR sections hidden with a short explanation); a Test stream button returns one frame, resolution and codec or a fixed error; credentials are stored encrypted and never returned; a failing manual source stays and raises the camera.source notification; every change is audited.

## Deliverables
- Implementation and regression tests (merged)
- Change record docs/changes/CAMERA-STREAM-SOURCES-2410.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
