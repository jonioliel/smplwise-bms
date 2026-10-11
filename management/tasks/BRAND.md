# BRAND — Brand colours, glass screens light/dark scheme, self-update switch, climate-kind backup fix

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** DONE

**Owner role:** fullstack | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "balanced",
  "effort": "medium",
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R275 / AT291:** Brand colours, glass screens light/dark scheme, self-update switch, climate-kind backup fix: merged into 2.4.4 and the tier-L release gate of 2.4.4 passes with no red result.

## Deliverables
- Implementation and regression tests in an isolated branch (integ/244 commits d03591ec, e3327d7d, 22d3d82b, ced2cca9, b31ea0d2, b4d4aed2)
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
