# WISKEY-MEDIA-V2-2530 — Station media over the signed direct transport v2 (opt-in, default off)

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
- **R-WISKEY-MEDIA-V2-2530-1 / AT-WISKEY-MEDIA-V2-2530-1:** With access.station_media_direct_v2 on and bridge 0.10.9+ seen, station media signs v2 with a rotated key and never falls back to v1 or the Home Assistant path; with the gate closed every media path is unchanged.

## Deliverables
- Branch pilot/WISKEY-MEDIA-V2-2530, change note docs/changes/WISKEY-MEDIA-V2-2530.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
