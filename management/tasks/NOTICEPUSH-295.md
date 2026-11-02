# NOTICEPUSH-295 — Push on publish for the notice board to the phone app channel

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
- **R-NOTICEPUSH-295-1 / AT-NOTICEPUSH-295-1:** Publishing a notice sends a push through the notification core's app channel (generic payload to the relay, text fetched by the app with its device token); it sends nothing until SW_PUSH_RELAY_URL and the key are set.

## Deliverables
- docs/changes/NOTICEPUSH-295.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
