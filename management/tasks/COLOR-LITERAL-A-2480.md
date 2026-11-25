# COLOR-LITERAL-A-2480 — Colour-literal ratchet A: device palettes file out of the count; shared video text-shadow colour variable now

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** DONE

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
- **R-COLOR-LITERAL-A-2480-1 / AT-COLOR-LITERAL-A-2480-1:** Colour-literal ratchet A: device palettes file out of the count; shared video text-shadow colour variable now: the device palettes file is excluded from the colour-literal count; the video text shadow gets a shared colour variable NOW; no pixel change.

## Deliverables
- Branch pilot/COLOR-LITERAL-A-2480, change note docs/changes/COLOR-LITERAL-A-2480.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
