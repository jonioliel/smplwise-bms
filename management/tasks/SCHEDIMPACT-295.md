# SCHEDIMPACT-295 — V-02 (Fable security review 4, medium, pre-existing basic mode): scheduled script / scene runs of Arx-only people go through the runnable allowlist and the bridge impact check

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
  "escalation": "Owner decision 6 of 2026-10-21: the card now, the fix AFTER the extended-identity permit (not a permit blocker - the path exists since 2.6.4). Fakes only; no live Home Assistant, Scheduler or device. A targeted Fable look at the diff before release."
}
```

## Acceptance
- **R-SCHEDIMPACT-1 / AT-SCHEDIMPACT-1:** For an Arx-only (local) principal, a schedule whose action is script.turn_on / scene.turn_on (or a script / scene the schedule runs) is accepted and run only when the item is on BOTH runnable allowlists (security.local_identity_runnable and the bridge's local_identity_runnable) and passes the bridge's runnable.impact_refusal (one nested level, the V-01 rule included) under the service user's entity policy - or, until that is built, script / scene actions in schedules are refused for local principals (audited, closed code); checked when the schedule is written AND again by the bridge when it runs; Home Assistant users' schedules and the 'allowed in schedules' mark (schedule_ops.mark_script) unchanged; negative-first tests on fakes; the amendment draft section 4 item 7 and CR-USR2 updated.

## Deliverables
- Bridge schedule_service.py: for a message screened on behalf of an Arx-only person, script / scene actions judged by runnable.impact_refusal with the bridge's allowlist (or refused); add-on schedule_ops / schedules routes: the same rule before anything is written, with the add-on's allowlist; both copies of the bridge byte-identical; a bridge version bump if the bridge changes
- Tests: negative first (an 'ordinary' script that switches a relay / a template switch, a script not on the list, a nested call, the V-01 decoy, a scene) on both sides; HA users unchanged
- Docs: HA_IDENTITY_RBAC amendment draft section 4 item 7, CR-USR2 (new subsection), bilingual release notes line

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
