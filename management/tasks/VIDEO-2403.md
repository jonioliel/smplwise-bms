# VIDEO-2403 — Live video: no video-policy read without live video; the kiosk and the display wall count as automatic quality

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** DONE

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
- **R-VIDEO-2403-1 / AT-VIDEO-2403-1:** The client asks GET /media/video-policy only after /me answered and only with the live_video capability (installation A sends no media request: evidence-nn1-p2:208 passes on every device); the kiosk and the display wall tiles fall back from a sub stream that gives nothing to the main stream on the same transport, as the wall's automatic quality.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
