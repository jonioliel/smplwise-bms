# I18N-DEFAULT-NAMES-2490 — English: default names saved on the server (such as "(copy)") are translated at creation

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
- **R-I18N-DEFAULT-NAMES-2490-1 / AT-I18N-DEFAULT-NAMES-2490-1:** English: default names saved on the server (such as "(copy)") are translated at creation: server-saved default names are translated at creation time; later comparisons that used the Hebrew name still work.

## Deliverables
- Branch pilot/I18N-EN-2490, change note docs/changes/I18N-DEFAULT-NAMES-2490.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
