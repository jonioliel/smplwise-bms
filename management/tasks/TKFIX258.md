# TKFIX258 — Service management 2.5.8: assignable staff, vendor account screen, no-login staff link (migration 0087), WhatsApp notification channel, handler-page path, TK251 remainder hardening

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
- **R338 / AT354:** Service management 2.5.8: assignable staff (TKSTAFF2), vendor account (TK258), staff link (TKSTAFF1, 0087), WhatsApp notification channel (NOTIFWA), handler-page path (TK255), hardening (TK251R); fakes only (integ/258).

## Deliverables
- Implementation and regression tests on pilot/TKSTAFF2-assign-contacts, pilot/TK258-vendor-accounts, pilot/TKSTAFF1-staff-link, pilot/NOTIFWA-whatsapp-channel, pilot/TK255-support-path, pilot/TK251R-remainder
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
