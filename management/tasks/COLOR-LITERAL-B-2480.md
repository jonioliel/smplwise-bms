# COLOR-LITERAL-B-2480 — Colour-literal ratchet B: skip the module palette tables (about 830 colours)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** IN_PROGRESS

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
- **R-COLOR-LITERAL-B-2480-1 / AT-COLOR-LITERAL-B-2480-1:** Colour-literal ratchet B: skip the module palette tables (about 830 colours): the module palette tables are skipped by the colour-literal count so the number shows the real debt.

## Deliverables
- Branch pilot/COLOR-LITERAL-B-2480, change note docs/changes/COLOR-LITERAL-B-2480.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
