# GATE248 — Release gate: baselines refreshed from the 2.4.8 gate and a tracked per-spec duration seed

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** REVIEW

**Owner role:** qa | **Hardware:** False

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
- **R306 / AT322:** Release gate: baselines refreshed from the 2.4.8 gate and a tracked per-spec duration seed: built on fakes / mocked backends and fixtures on branch pilot/GATE-dur-248; no live device action; acceptance test NOT_RUN.

## Deliverables
- Implementation and regression tests in an isolated branch (pilot/GATE-dur-248)
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
