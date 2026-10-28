# XSECFOLLOW-297 — Security review 2026-10-27 follow-ups of XSECFIX-297: the presence block on WebSockets, phone credentials end on a password change / reset and a forced second factor, ?do=run and Android tests

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
  "escalation": "Security core (WebSocket identity, presence, local identity, second factor): the release gate runs the whole backend; the Android JVM test runs outside the gate."
}
```

## Acceptance
- **R-XSECFOLLOW-1 / AT-XSECFOLLOW-1:** Follows XSECFIX-297 (review follow-ups). (a) every WebSocket resolves its caller in routers/media._principal_for_ws, which applies the service-account refusal and presence.enforce exactly like auth._principal: a blocked user's socket gets one error frame (presence_required / service_account) and close 4403, audited like the HTTP refusal; HTTP streaming routes (clips, downloads, snapshots, HLS) are refused by auth._principal before the handler; (b) a password change (own), a reset link and a self-service reset, and a required second-factor override (user or role, users without a factor) end the user's device tokens and push registrations (presence.end_on_sign_out everywhere, audited presence.device.credentials_ended with the reason password_changed / second_factor_required); a refused change and an optional override end nothing; (c) ?do=run only opens the run confirmation - automations-logic.addressAction with a Node unit spec and a source guard; (d) Android JVM tests for the arx://open action and lock path; no migration.

## Deliverables
- Backend: routers/media.py (_principal_for_ws, _refuse_socket), services/local_identity.py (_end_phone_credentials, change_password, use_link), services/local_reset.py, routers/second_factor.py (set_override)
- Frontend: src/screens/automations-logic.ts (addressAction), src/screens/automation-drawer.ts (applyAction through it)
- Tests: smplwise_vms/backend/tests/test_xsecfollow_297.py, frontend/tests/unit-xsecfollow-297.spec.ts, mobile/android-shell/app/src/test/java/com/smplwise/arx/app/XsecFollow297Test.kt
- Docs: docs/api/mobile-presence-contract.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
