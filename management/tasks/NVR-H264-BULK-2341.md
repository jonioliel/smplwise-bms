# NVR-H264-BULK-2341 — Switch every camera stream to H.264 from the UI; per-recorder NVR writes switch

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
- **R-NVR-H264-BULK-2341-1 / AT-NVR-H264-BULK-2341-1:** A per-recorder switch "אפשר שינויי הגדרות ב־NVR" gates every setting write (Provision-ISR off by default, Hikvision unchanged) and the bulk encoding dialog has a one-click "convert every stream to H.264" preset. No write to a real recorder was run by the branch.

## Deliverables
- Change record docs/changes/NVR-H264-BULK-2341.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
