# CAM-H264-VERIFY-2361 — Verify a bulk encoding change at the camera, per-channel report, skip a refused camera

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** IN_PROGRESS

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
- **R-CAM-H264-VERIFY-2361-1 / AT-CAM-H264-VERIFY-2361-1:** After a bulk encoding apply or undo the stream is verified at the camera and reported per channel; the setting nvr.batch_on_refusal ("skip and continue" by default, or stop) decides what a refused camera does, and undo follows the same setting (owner decision 2B, 02.11); a read-only re-check route exists.

## Deliverables
- Change record docs/changes/CAM-H264-VERIFY-2361.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
