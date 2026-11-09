# EVIDENCE-CAMERAS-2412 — Evidence screenshots for the 2.41.x camera screens (with and without a recorder)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** IN_PROGRESS

**Owner role:** qa | **Hardware:** False

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
- **R-EVIDENCE-CAMERAS-2412-1 / AT-EVIDENCE-CAMERAS-2412-1:** Evidence (screenshot) runs on the runner for the 2.41.0 / 2.41.1 camera screens: installation with an NVR (unchanged), installation with go2rtc and no NVR plus one camera without a recorder (rail, overview, wall, camera screen, area camera card / picker, floor map), the video source dialog and the NVR page card; Hebrew RTL at desktop and phone widths; findings recorded.

## Deliverables
- Evidence specs / screenshots and a change record on docs/EVIDENCE-CAMERAS-2412

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
