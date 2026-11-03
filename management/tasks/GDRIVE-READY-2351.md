# GDRIVE-READY-2351 — Google Drive backup ready for the owner's first real connection

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
- **R-GDRIVE-READY-2351-1 / AT-GDRIVE-READY-2351-1:** A "בדיקת חיבור Google" check on every Google Drive target tests client, secret, clock, consent screen, Drive API, quota and folder step by step and says what to do (it changes nothing); errors are named correctly; a Hebrew first-connection guide exists (docs/operations/GDRIVE_CONNECT_SETUP_HE.md).

## Deliverables
- Change record docs/changes/GDRIVE-READY-2351.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
