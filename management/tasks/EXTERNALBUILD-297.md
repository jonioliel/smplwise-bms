# EXTERNALBUILD-297 — External access built to full scope (X0-X6 of EXTERNALSPEC-297 + one-time code + CR-VISITOR105 visitors), fakes only, OFF by default

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

**Owner role:** engineering | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "deep",
  "review": "deep",
  "effort": "high",
  "escalation": "Security path (door credentials): the live session with the owner follows docs/operations/EXTERNAL_ACCESS_LIVE_SESSION_RUNBOOK.md, action by action."
}
```

## Acceptance
- **R-EXTBUILD-1 / AT-EXTBUILD-1:** X1 readiness API + Settings block + CLI (read-only); X2 automatic fallback to the service channel instead of a refusal, reason shown, revokes never blocked; X3 owner-session runbook; X5 service-writer adapter behind a port with the expected contract documented (wire not built); one-time code for vendors (request + approver narrowing, entry watch); visitors on the same engine behind access.visitors (off); migration 0180 additive only (number confirmed at the 2.24.1 integration); no default changed; nothing live.

## Deliverables
- Backend: services/access_readiness.py, services/access_service_writer.py, services/access_entries.py, services/access_visitors.py, routers/access_visitors.py; access_grant_engine._write fallback; access_grants code_mode + visitor hooks; migration 0180_external_codes_visitors.sql (confirmed at the 2.24.1 integration); permission access.visitor.invite; notification source access.visitor.arrived
- Frontend: readiness block + main switch in the external-access Settings dialog; code type in the request dialog; one-entry chip
- Tests: smplwise_vms/backend/tests/test_externalbuild_297.py
- Docs: docs/changes/EXTERNALBUILD-297.md, docs/operations/EXTERNAL_ACCESS_LIVE_SESSION_RUNBOOK.md, docs/user-guide/he/52-external-access_HE.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
