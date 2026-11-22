# API-CONTRACT-ADR-2490 - ADR-019: one field-error envelope (L2) and `extra="forbid"` per client (L14)

Documentation and a read-only inventory script; no product code, no envelope change, no pixel change.
Base `origin/release/2470-train` (`4d244a419`), branch `pilot/API-CONTRACT-ADR-2490`.

## What changed

- `docs/architecture/ADR-019-error-envelope-and-request-strictness.md` (new): the inventory of error shapes and request-body
  strictness, who reads what (web UI, HA bridge, phone apps, public pages), the options, the decision and the migration plan
  family by family behind the generated client, compatibility rules and the tests that will guard each step.
- `docs/architecture/DECISIONS.md`: the ADR-019 row.
- `scripts/error_contract_inventory.py` (new): static scan (ast + regex, no import, no write) of error-constructor sites and
  their `details` keys, 422 shapes, router exception translations, direct `JSONResponse` error answers, request-body models with
  their effective `extra` and client, plain-dict bodies, frontend reads of error `details` keys, legacy 422 shapes by family
  (the future ratchet). `--json` for the facts, Markdown by default.
- `smplwise_vms/backend/tests/test_error_contract_inventory_2490.py` (new): the classifier, model / client attribution and
  frontend scan on a small tree, and a run on the real code.

## Decision in one paragraph

The five-key envelope stays. A refusal that names input fields carries `details.fields: string[]` and optionally
`details.problems: [{field, code, message?}]`; `details.field`, `details.key`, `fields` as objects or a map and domain `errors`
issue lists are dual-emitted and retired family by family, after the screens read through one shared reader; a ratchet keeps
the legacy count going down. Web-UI request models move to `extra="forbid"` after an observation step (unknown keys logged,
raised under `SW_REQUEST_STRICT=1`); phone-app, browser-push, bridge and open-bag bodies stay tolerant permanently; the public
app keeps its own vocabulary.

## Not done here (next rows)

Step 0 of the ADR (wire error models + generated `wire-errors.ts`, `errors.field_error`, `fieldsOf` / `problemsOf` in the
client, `fields` / `problems` added by the global validation handler), then one row per family, and the L14 observation base.

## Tests

See the final report of the row for the exact runs. No runner use (the 2.47.0 gate holds it).

Rollback: delete the four files / the DECISIONS row; nothing at run time depends on them.
