# TV-FIT-2380 — Display D1: TV fit - portrait footer chips, crest logo, Hebrew-date fallback, overscan margin

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
- **R-TV-FIT-2380-1 / AT-TV-FIT-2380-1:** On the notice TV page the portrait footer keeps its chips under every "updated" wording, template, V2 and lobby style (two-row footer or priority drop per owner answer Q3); the two specs that pin updated:full are un-pinned and a portrait-chip pixel spec is added; the H7 crest logo is sized by area; the Hebrew date has a fallback; a safe-area / overscan margin setting exists.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
