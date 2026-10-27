# SUPPLIERDOCS-297 — Supplier certificate reading, slice 1: text-layer PDFs into proposed fields decided field by field (OFF by default, PROVISIONAL on owner questions q52-q56)

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
  "review": "deep",
  "effort": "high",
  "escalation": "Enabling in a release is gated by the security review (docs/changes/CR-SUPPLIERDOCS-297.md, finding F4 open)."
}
```

## Acceptance
- **R-SUPPLIERDOCS-1 / AT-SUPPLIERDOCS-1:** docread.enabled defaults to false and every docread route answers the uniform 404 while it is off; reading and deciding need maintenance.manage on the task (audited 403), looking needs maintenance.view; only files already attached to a certificate / vendor_document task are read; a picture or a PDF without a text layer ends in needs_ocr; the read stores proposals only (the task never changes); each field is confirmed, edited or rejected on its own (no approve-all route); the audit carries ids, counts and field names, never a value; drafts are purged 14 days after the last activity or with their file / task; doc_extractions is never in a project backup; migration 0182_doc_extractions.sql is additive.

## Deliverables
- Backend: services/docread/ (ports, pdftext, certificate_rules, service), routers/docread.py, routers/settings.py (docread.enabled), services/backup.py
- Migration: smplwise/migrations/0182_doc_extractions.sql
- Tests: tests/test_docread_297.py, tests/test_docread_certificate_rules.py
- Docs: docs/changes/CR-SUPPLIERDOCS-297.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
