"""CR-014: the add-on's schedule allow-list (services/schedule_policy.SCHEDULE_ACTIONS, owned by backend agent S1) and the
bridge's (integration schedule_policy.py) must not drift: same services, same argument names and ranges, both inside
the bridge's ALLOWED_SERVICES. The comparison is guarded: until the add-on module exists (it lands with S1's branch) the
module is skipped, which is NOT a pass - the release round must see this file run.

SCHEDULE_ACTIONS is read structurally (service ids as keys / list items / "service" fields at any depth) because its
exact container is S1's choice (SCHEDULER_API.md 5.2 fixes the content, not the container)."""
from __future__ import annotations

import re
from typing import Any

import pytest

from bridge_loader import init_allowed_services, load

addon = pytest.importorskip("smplwise.services.schedule_policy")
policy = load("schedule_policy")

SERVICE_ID = re.compile(r"^[a-z_]+\.[a-z_]+$")


def _walk(node: Any, out: dict[str, Any]) -> None:
    if isinstance(node, dict):
        if isinstance(node.get("service"), str) and SERVICE_ID.match(node["service"]):
            out.setdefault(node["service"], node)
        for key, value in node.items():
            if isinstance(key, str) and SERVICE_ID.match(key):
                out.setdefault(key, value)
            _walk(value, out)
    elif isinstance(node, (list, tuple, set, frozenset)):
        for item in node:
            if isinstance(item, str) and SERVICE_ID.match(item):
                out.setdefault(item, None)
            else:
                _walk(item, out)


def addon_services() -> dict[str, Any]:
    found: dict[str, Any] = {}
    _walk(addon.SCHEDULE_ACTIONS, found)
    return found


def _arg_specs(entry: Any) -> dict[str, dict[str, Any]] | None:
    """{name: {min, max, type, choices, required}} of one add-on entry, or None when the entry shows no argument list."""
    if not isinstance(entry, dict):
        return None
    raw = entry.get("args", entry.get("arguments", entry.get("argument_specs")))
    if raw is None:
        return None
    out: dict[str, dict[str, Any]] = {}
    if isinstance(raw, dict):
        for name, spec in raw.items():
            out[name] = spec if isinstance(spec, dict) else {"tuple": spec}
    else:
        for spec in raw:
            if isinstance(spec, dict) and "name" in spec:
                out[spec["name"]] = spec
            elif isinstance(spec, str):
                out[spec] = {}
    return out


def test_same_services_and_inside_allowed_services():
    ours = set(policy.ACTION_ARGS)
    theirs = set(addon_services())
    assert theirs, "no service ids found in SCHEDULE_ACTIONS: teach _walk() its container"
    assert ours == theirs, f"only in the bridge: {sorted(ours - theirs)}; only in the add-on: {sorted(theirs - ours)}"
    assert {tuple(s.split(".", 1)) for s in theirs} <= init_allowed_services()


def test_same_argument_names_and_ranges():
    checked = 0
    for service_id, entry in addon_services().items():
        specs = _arg_specs(entry)
        if specs is None:
            continue
        checked += 1
        ours = {a.name: a for a in policy.ACTION_ARGS[service_id]}
        assert set(specs) == set(ours), f"{service_id}: argument names differ: add-on {sorted(specs)}, bridge {sorted(ours)}"
        for name, spec in specs.items():
            a = ours[name]
            lo, hi = spec.get("min", spec.get("lo")), spec.get("max", spec.get("hi"))
            if "tuple" in spec:  # ("int", lo, hi) / ("enum", choices) / ("str", min, max)
                t = spec["tuple"]
                if t and t[0] in ("int", "float"):
                    lo, hi = t[1], t[2]
                elif t and t[0] == "enum":
                    assert tuple(t[1]) == a.choices, f"{service_id}.{name}: choices differ"
            if lo is not None and a.type in ("int", "float"):
                assert (lo, hi) == (a.lo, a.hi), f"{service_id}.{name}: range differs ({lo}, {hi}) vs ({a.lo}, {a.hi})"
            if "required" in spec:
                assert bool(spec["required"]) == a.required, f"{service_id}.{name}: required differs"
    if not checked:
        pytest.skip("SCHEDULE_ACTIONS does not expose argument specs in a form this test reads; compare by hand at merge")
