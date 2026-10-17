# WISKEYID-BUILD — CR-ARX-WISKEY-SHARED-IDENTITY X1-X4 (backend): Arx <-> WisKey person links and time-bounded door grants for external people with a WhatsApp code; OFF, go-live not permitted in code

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
  "escalation": "Second security review (Opus/Fable) of the grant, code and public arrival paths before any switch-on. No live WisKey, door or phone."
}
```

## Acceptance
- **R-WISKEYID-1 / AT-WISKEYID-1:** On fakes only: migrations 0107/0108; access.external.grant (system_admin, station-scoped); request/approve/refuse/revoke/rotate with the owner answers of 2026-10-17 (14 days, one live grant, widening needs approval, code the evening before by WhatsApp to a self-confirmed number, re-decision on permission change, done ends access, vendor/contact/phone triggers, delete-now); the arrival step creates requests only; leak scan clean; the switch cannot be turned on while GO_LIVE_PERMITTED is False.
- **R-WISKEYID-2 / AT-WISKEYID-2:** On the owner's installation with a separate go-live permit: a grant provisioned on a real WisKey station, the code delivered to a real phone and used at a keypad, revoked and removed; offline-device expiry observed.

## Deliverables
- smplwise/migrations/0107_access_person_links_grants.sql, 0108_access_grant_notices.sql, services/access_grants.py, services/access_grant_engine.py, services/access_arrival.py, routers/access_grants.py, hooks in db.py / tickets service / handler_actions, tests/test_access_grants.py, tests/test_access_arrival.py, docs/changes/CR-ARX-WISKEY-SHARED-IDENTITY-BUILD-NOTES.md on pilot/WISKEYID-BUILD

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
