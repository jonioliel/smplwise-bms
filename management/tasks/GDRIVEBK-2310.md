# GDRIVEBK-2310 — Google Drive as an off-box backup target (device-flow OAuth, off by default)

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
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization."
}
```

## Acceptance
- **R-GDRIVEBK-2310-1 / AT-GDRIVEBK-2310-1:** Google Drive is an off-box backup target kind: device-flow OAuth, drive.file scope, sealed tokens, off by default (migration 0186; design docs/design/GDRIVE_BACKUP.md). The owner's first real connection is NOT_RUN (see GDRIVE-READY-2351).

## Deliverables
- Code and tests in git history of the merged branch

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
