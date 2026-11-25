# I18N-RUNTIME-ERRORS-2520 — Run-time refusal texts in English; the service worker's own words in the user's language

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** REVIEW

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
- **R-I18N-RUNTIME-ERRORS-2520-1 / AT-I18N-RUNTIME-ERRORS-2520-1:** Every run-time refusal text is a tpl() with an English template (Hebrew byte-identical); the backend refusal ratchet is 0 run-time f-strings; the service worker's offline page follows the user's language.

## Deliverables
- Branch pilot/I18N-RUNTIME-ERRORS-2520, change note docs/changes/I18N-RUNTIME-ERRORS-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
