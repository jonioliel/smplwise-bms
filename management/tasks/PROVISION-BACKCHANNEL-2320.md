# PROVISION-BACKCHANNEL-2320 — Provision-ISR live and playback: video-only stream request, talk-back as a recorder setting

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
- **R-PROVISION-BACKCHANNEL-2320-1 / AT-PROVISION-BACKCHANNEL-2320-1:** On a Provision-ISR recorder go2rtc sources ask for video only (#backchannel=0) so live and playback show video; a recorder setting "two-way talk through the recorder" turns talk-back on, off by default.

## Deliverables
- Code and tests in git history of the merged branch

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
