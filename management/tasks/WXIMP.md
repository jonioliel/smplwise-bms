# WXIMP — WisKey importer on the Arx side (CR-035), stage 1: offline package intake, import manifest, staged install plan (fakes only)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** BLOCKED

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
- **R295 / AT311:** WisKey importer on the Arx side (CR-035), stage 1: offline package intake, import manifest, staged install plan (fakes only): built and verified on fakes and fixtures; no live device action.

## Deliverables
- Implementation and regression tests in an isolated branch (pilot/WISKEY-importer)
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.

## Blocker
Excluded - OBSOLETE by owner decision 2026-11-05 (round 22, Q2 = א on the BOARD-HYGIENE-2403 candidates; relayed by the coordinator, no written answers file): superseded by private/planning/OWNER_DECISIONS_2026-10-20_NIGHT.md round 1 item 7 (package install from Arx frozen) and round 4 item 6. Not to be worked; the card is kept.
