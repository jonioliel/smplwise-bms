# SWITCH-LIGHT-DIMMER-2331 — No dimmer on on/off lights; switches in the synoptic lights column; floor lights popup

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
- **R-SWITCH-LIGHT-DIMMER-2331-1 / AT-SWITCH-LIGHT-DIMMER-2331-1:** Switches typed as a light and on/off-only lights show no brightness slider; a setting chooses which switches fill the synoptic lights column; pressing a floor's lights opens that floor's lights popup with "turn all on / off" through the usual confirmation.

## Deliverables
- Change record docs/changes/SWITCH-LIGHT-DIMMER-2331.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
