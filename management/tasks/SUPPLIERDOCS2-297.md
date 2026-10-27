# SUPPLIERDOCS2-297 — Supplier documents: migration renumbered to 0182 after release/2241, merge of release/2241, security review with fixes F1-F3 and F6

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
  "escalation": "F4 (child RLIMITs / sandbox) needs a Linux run on the runner before docread.enabled may be switched on in a release."
}
```

## Acceptance
- **R-SUPPLIERDOCS2-1 / AT-SUPPLIERDOCS2-1:** The migration sequence is contiguous on top of release/2241 (0180 external codes, 0181 door-window write, 0182 doc_extractions); F1 the snippet scrubber is linear on a crafted line and the rules run outside the database write lock; F2 the pdftotext child output is read up to the cap and the child killed at the cap or the deadline, with the minimal environment; F3 at most READ_CONCURRENCY reads at once, otherwise 429 busy with nothing stored; F6 proposals of a deleted task are purged at the next janitor pass; docread.enabled stays OFF by default; open findings F4, F5, F7 recorded in the CR.

## Deliverables
- services/docread/pdftext.py (run_capped), services/docread/certificate_rules.py (IBAN pattern), services/docread/service.py (analyse, read slots, purge of deleted tasks), routers/docread.py
- Tests: tests/test_docread_297.py (test_f1_*, test_f2_*, test_f6_*)
- Docs: docs/changes/CR-SUPPLIERDOCS-297.md section 'Security review'

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
