# ONVIF-DISCOVERY-2412 — ONVIF discovery of cameras without a recorder (later)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P3 | **Status:** BACKLOG

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
- **R-ONVIF-DISCOVERY-2412-1 / AT-ONVIF-DISCOVERY-2412-1:** Cameras on the local network can be discovered over ONVIF and offered as cameras without a recorder (RTSP addresses filled from the profile), read-only until an administrator saves; scope and timing to be set by the owner.

## Deliverables
- Scope note and owner decision before any work

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
