# TEMPREPORT-2310 — Temperature report: security review and hardening of the report link and WhatsApp send

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** IN_PROGRESS

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
  "escalation": "F4 (child RLIMITs / sandbox) needs a Linux run on the runner before docread.enabled may be switched on in a release."
}
```

## Acceptance
- **R-SUPPLIERDOCS2-1 / AT-SUPPLIERDOCS2-1:** Temperature report: security review and hardening of the report link and WhatsApp send: built on an isolated branch, green runner entry check, joins release train 3 (2.30.0); no live device action.

## Deliverables
- services/docread/pdftext.py (run_capped), services/docread/certificate_rules.py (IBAN pattern), services/docread/service.py (analyse, read slots, purge of deleted tasks), routers/docread.py
- Tests: tests/test_docread_297.py (test_f1_*, test_f2_*, test_f6_*)
- Docs: docs/changes/CR-SUPPLIERDOCS-297.md section 'Security review'

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
