# XSECFIX-297 — Security review 2026-10-27 (phone apps): the four medium findings M1-M4 - presence gate exact match, device credentials end on sign-out, failure limiter per source, arx://open waits for the app lock

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
  "escalation": "Security core (auth.py / rbac.py / presence): the release gate runs the whole backend; the Android JVM test runs outside the gate."
}
```

## Acceptance
- **R-XSECFIX-1 / AT-XSECFIX-1:** M1 presence.gate_exempt matches the path below root_path and /api/v1 exactly or by whole leading segments and refuses non-canonical paths; M2 presence.end_on_sign_out ends the device token and the push registration on every sign-out path (own, administrator, sign out everywhere for HA and local identities, an app sign-in ended from the sessions list, in-app sign-out, removal of remote access, local-user revokes), a desktop-browser sign-out leaves phones alone, audited as presence.device.credentials_ended, a device token on the remote channel obeys the remote-access policy (403 remote_not_allowed); M3 the token is looked up first (a valid token is never refused), failures count per source address bucket, the global count only logs; M4 web: ?do=run only opens the run confirmation; M4 Android: arx://open waits for the unlock and a link carrying a do parameter opens only after the user confirms; iOS hand-off document; regression tests for every finding; no migration.

## Deliverables
- Backend: services/presence.py (gate_exempt, end_on_sign_out, per-source limiter), routers/presence.py, routers/remote.py, routers/local_identity.py, services/app_session.py, services/ha_user_auth.py, services/local_identity.py, auth.py, rbac.py
- Android: DeepLinks.asksForAction, ServersActivity.openLink (pendingOpen, confirm), WebActivity first load after unlock; DeepLinksTest (JVM)
- iOS: mobile/ios-shell/HANDOFF_IOS_ADDENDUM_3_DEEPLINK_LOCK.md (hand-off; code not in the repository)
- Tests: smplwise_vms/backend/tests/test_xsecfix_297.py
- Docs: docs/api/mobile-presence-contract.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
