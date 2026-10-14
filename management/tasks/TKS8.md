# TKS8 — Service management: add-on docs, Hebrew guide chapter, public-surface review checklist

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
- **R328 / AT344:** Service management: add-on docs, Hebrew guide chapter, public-surface review checklist: built on fakes / mocked backends and fixtures (pilot/TICKETS-s8 @ bdd391cd); no live device, WhatsApp or tunnel action; spec docs/changes/CR-038-TICKETS-MODULE.md.

## Deliverables
- Implementation and regression tests in an isolated branch (pilot/TICKETS-s8)
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
