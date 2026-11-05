# BOARD-ADMIN-2380 — Display D3: notice board administration (chips providers, screen count, copy link, re-send, editor role)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** REVIEW

**Owner role:** engineering | **Hardware:** False

**Dependencies:** POLISH4-WP8-SETMOD-2370

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
- **R-BOARD-ADMIN-2380-1 / AT-BOARD-ADMIN-2380-1:** Parking and gym status chips get data providers from chosen entities, a per-board screen count exists (migration), "copy link" no longer rotates the token (a separate "replace link" does), a notice can be sent again manually, and the editor role default of notices.manage follows the owner answer.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
