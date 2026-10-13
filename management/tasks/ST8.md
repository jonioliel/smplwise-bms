# ST8 — Plan Studio 8: IFC4 export and import in the plan editor (CR-037)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** DONE

**Owner role:** backend | **Hardware:** False

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
- **R313 / AT329:** Plan Studio 8: IFC4 export and import in the plan editor (CR-037): built on fakes / mocked backends and fixtures (pilot/ST8-ifc @ ed1fd497); no live device action.

## Deliverables
- Implementation and regression tests in an isolated branch (pilot/ST8-ifc)
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
