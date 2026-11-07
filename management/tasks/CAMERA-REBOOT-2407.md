# CAMERA-REBOOT-2407 — Reboot one camera through its NVR (legacy parity P09)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** IN_PROGRESS

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
- **R-CAMERA-REBOOT-2407-1 / AT-CAMERA-REBOOT-2407-1:** A holder of the sensitive permission nvr.camera.reboot (installation and camera scope) can reboot one camera from the camera's settings: Hikvision only (the legacy request GET /ISAPI/ContentMgmt/InputProxy/channels/{ch}/reboot through the NVR, one PUT only when the device proves the GET was not executed), refused while the NVR-writes switch is off, after a confirmation dialog, rate limited per camera and per user, recorded in the NVR change log and audited; Provision-ISR is refused as unsupported; the button is disabled with a plain reason when the permission is missing or NVR changes are off.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
