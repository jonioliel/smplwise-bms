"""Shared test helpers, imported by name (code review 05:P2-16).

`tests/conftest.py` keeps the fixtures and the pytest hooks; everything a test calls as a plain function lives here:

- `support.apps`    - identities, seeded trees, direct bindings, sample uploads, route warm-up
- `support.waiting` - polling for a condition, the wall-clock bound helpers, pinned clocks
- `support.audit`   - reading the audit log of a test installation

A helper moves here when two or more test files carry the same body; a helper that differs stays in its file. The names
`conftest` exported before this package existed (`as_user`, `bind`, `seed_tree`, `png_bytes`, ...) are still importable
from `conftest`."""
