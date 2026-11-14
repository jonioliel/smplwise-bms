"""CR-ROUTER-COMMON (code review 2026-11-13, D5): the request helpers every router copied (`_rid`, `_raw_body`, `_is_json`,
`_db`) live once in smplwise/routers/_common.py; routers import them under their old local names.

The guard is static (AST over smplwise/routers/*.py): a router outside WAITING that defines one of these helpers again fails.
WAITING is the set of routers another open branch holds today; CR-ROUTER-COMMON-TAIL sweeps them and empties it."""
from __future__ import annotations

import ast
from pathlib import Path

import pytest

from smplwise.routers import _common

ROUTERS = Path(__file__).resolve().parents[1] / "smplwise" / "routers"
HELPERS = {"_rid", "_raw_body", "_is_json", "_db"}
WAITING = {
    # CR-ADMIN-GATE
    "access_visitors", "wiskey_managed", "wiskey_switches", "access_station_permissions", "access_grants", "access_wiskey_visits",
    "wiskey_pairing", "access", "ha_users", "bridge_key", "door_automations",
    # path-confine / setting-callers routers
    "plans", "energy_billing", "backup", "cases", "nvr_write",
    # held by other open branches
    "catalog", "wiskey_lineage", "cameras",
}


def _waiting(stem: str) -> bool:
    return stem in WAITING  # the tickets routers: converted by CR-TK-ROUTER-COMMON-2438


def _copies() -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for path in sorted(ROUTERS.glob("*.py")):
        if path.stem == "_common":
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        names = [n.name for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name in HELPERS]
        if names:
            out[path.stem] = names
    return out


def test_no_router_outside_the_waiting_list_copies_a_request_helper():
    offenders = {stem: names for stem, names in _copies().items() if not _waiting(stem)}
    assert offenders == {}, f"import them from routers/_common.py instead: {offenders}"


def test_the_waiting_list_names_only_routers_that_still_hold_a_copy():
    """A router swept by a later branch leaves WAITING in the same commit, so the list only shrinks."""
    stale = sorted(stem for stem in WAITING if stem not in _copies())
    assert stale == [], f"remove from WAITING: {stale}"


@pytest.mark.parametrize("value, expected", [
    ("application/json", True), ("Application/JSON; charset=utf-8", True), ("application/merge-patch+json", True),
    (" application/json ;q=1", True), (None, False), ("", False), ("text/json", False), ("application/jsonp", False),
    ("multipart/form-data; boundary=x", False),
])
def test_is_json(value, expected):
    assert _common.is_json(value) is expected


def test_the_shared_names_are_the_ones_the_routers_use():
    from smplwise.routers import access_control, devices, schedules

    assert access_control._raw_body is devices._raw_body is schedules._raw_body is _common.raw_body
    assert schedules._rid is _common.rid and schedules._is_json is _common.is_json
