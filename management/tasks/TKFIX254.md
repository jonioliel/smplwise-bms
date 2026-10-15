# TKFIX254 — Service management 2.5.4: the public handler-page address may include one path prefix such as /support (vendor links built with it; Cloudflare rewrites it to /t)

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
- **R334 / AT350:** Service management 2.5.4: the public handler-page address may include one path prefix such as /support: fakes only (integ/254); no live send; rewrite-before-tunnel ordering UNVERIFIED.

## Deliverables
- Implementation and regression tests on pilot/FIX-support-path-254
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
