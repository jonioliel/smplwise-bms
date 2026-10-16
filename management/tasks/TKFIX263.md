# TKFIX263 — Arx 2.6.3 release: combined service-management redesign, requests for quotation, map element, number verification, secrets, Frigate live video (integ/263)

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
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R358 / AT374:** Arx 2.6.3 release: combined service-management redesign, requests for quotation, map element, number verification, secrets, Frigate live video (integ/263); fakes only (integ/263).

## Deliverables
- Implementation and regression tests on integ/263
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
