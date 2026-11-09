# SWITCH-AS-LIGHT-2321 — A switch typed as a light counts and acts as lighting

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** DONE

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
- **R-SWITCH-AS-LIGHT-2321-1 / AT-SWITCH-AS-LIGHT-2321-1:** Switches set to the type "light" count as lights everywhere (synoptic map, home counters, floor and area cards) and are switched by "lights off / on".

## Deliverables
- Code and tests in git history of the merged branch

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
