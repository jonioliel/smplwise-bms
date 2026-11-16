"""`PATCH /settings`, split by group (review 05:P1-10 step 2).

The route was one 397-line function. Its checks now live in the modules of this package, one small handler per key or key
family, and run from a table `{prefix: handler}` in the order the function ran them: of two refusals in one request the earlier
one answers, and the audit rows keep their order (tests/test_settings_patch_audit_order.py pins both).

A handler takes the request on its way (`Patch`) and changes `patch.changes` in place (a normalised value, a helper key popped)
or raises `ApiError`. It runs only when a key of the request starts with its prefix; each handler still checks its exact keys, so
a prefix only has to be wide enough. Nothing here imports `routers.settings` (it imports this package)."""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Any, Callable

from fastapi import Request

from ...rbac import Principal


@dataclass
class Patch:
    """One `PATCH /settings` request: `changes` is the body by setting key (unset fields left out), edited by the handlers."""
    conn: sqlite3.Connection
    request: Request
    principal: Principal
    changes: dict[str, Any]


Handler = Callable[[Patch], None]

from . import content, ui  # noqa: E402 - the handler modules use Patch

# In the order the checks run. Python keeps a dict in insertion order; `run` relies on it.
VALIDATORS: dict[str, Handler] = {
    **ui.VALIDATORS,
    **content.VALIDATORS,
}


def run(patch: Patch, table: dict[str, Handler]) -> None:
    for prefix, handler in table.items():
        if any(key.startswith(prefix) for key in patch.changes):
            handler(patch)


def validate(patch: Patch) -> None:
    """Every check of the table, in order; the first refusal ends the request (nothing was stored yet)."""
    run(patch, VALIDATORS)
