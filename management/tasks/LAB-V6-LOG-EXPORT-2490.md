# LAB-V6-LOG-EXPORT-2490 — Real log export and redaction check (V6)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** BACKLOG

**Owner role:** engineering | **Hardware:** True

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
- **R-LAB-V6-LOG-EXPORT-2490-1 / AT-LAB-V6-LOG-EXPORT-2490-1:** Real log export and redaction check (V6): the redacted log file is exported and scanned for addresses, passwords, keys and serial numbers; the file stays in the private folder (10 minutes).

## Deliverables
- Owner-run lab step with a redacted result recorded in docs/changes/

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
