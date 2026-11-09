# LAB-CHECKS-2412 — Owner manual lab checks for the 2.41.0 / 2.41.1 cameras

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** BLOCKED

**Owner role:** owner | **Hardware:** True

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
- **R-LAB-CHECKS-2412-1 / AT-LAB-CHECKS-2412-1:** On the lab, with the owner's approval: one camera with a manual RTSP source and one camera without a recorder through the real go2rtc (live, snapshot, Test stream result and error wording, camera.source notification when the source fails), and an installation view without an NVR showing the camera screens; results recorded without secrets or lab addresses.

## Deliverables
- Owner lab results recorded in a change record (redacted)

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.

## Blocker
Owner action on the lab installation (manual checks; Arx agents have no lab or device access for this). Not a code blocker.
