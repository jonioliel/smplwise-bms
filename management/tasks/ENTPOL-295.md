# ENTPOL-295 — Owner decision 3 of 2026-10-21 (Fable security review 4, V-08): the automatic refusal while the service user is not restricted by an entity policy - fail closed on ambiguous policies and on a stale report (Home Assistant unreachable)

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
  "escalation": "Owner decision 3 of 2026-10-21 (review 4 question 3, option A). Fakes only; no live Home Assistant. The extended mode stays locked; the permit is the lead's separate commit."
}
```

## Acceptance
- **R-ENTPOL-1 / AT-ENTPOL-1:** Before the extended-identity permit: every item only the extended mode admits is refused on both sides while the service user is not restricted, cannot be determined (an unreadable, ambiguous or raising policy / permission check) or the add-on's last report is not current (no accepted directory push for POLICY_REPORT_MAX_AGE_S); restricted + current = admitted; basic-mode items unaffected; EXTENDED_GO_LIVE_PERMITTED and every GO_LIVE_PERMITTED constant unchanged; negative-first tests on fakes; CR-USR2 13.8, DOCS / DOCS_HE and guide chapter 47 updated.

## Deliverables
- Bridge service_identity.py (both copies byte-identical): ambiguous entities.all / all.control values = unknown; Home Assistant's permission object access_all_entities('control') has the last word
- Add-on service_identity.py: a 'true' report counts only while the last directory push is current (bridge.directory_at, 300 s, 60 s skew); otherwise 503 service_identity_policy_default, audited reason policy_stale; status field service_policy_fresh and step service_policy_stale
- Tests: tests/test_entpol295_bridge_policy.py, tests/test_entpol295_addon_policy.py; fixtures in test_service_identity_extended.py / test_service_identity_runnable.py
- Docs: CR-USR2 13.8, DOCS.md / DOCS_HE.md, docs/user-guide/he/47-identity-users_HE.md, GUIDE_ALL_HE.html

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
