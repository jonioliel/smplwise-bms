"""CR-019 decision 1a, guarded statically: switch protection applies to GROUP actions only. Individual control
(routers/ha.py run_action, services/ha_scope.py), schedules (CR-014), automations / scenes / scripts (CR-017) and
notifications (CR-018) never read it - so a later change cannot silently make a protected switch unschedulable or
unautomatable. The globs also cover the CR-017 / CR-018 modules once their branches merge; the bridge never knew the mark."""
from __future__ import annotations

import ast
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "smplwise"
REPO = Path(__file__).resolve().parents[3]
FORBIDDEN = ("device_bulk_protected", "device_switch_classified", "switch_protection", "SwitchPolicy", "bulk_protected")
GUARDED_GLOBS = (
    "services/schedule*.py", "routers/schedules.py",  # CR-014
    "services/automation*.py", "routers/automations.py",  # CR-017 (pilot/CR017-*)
    "services/notify*.py", "routers/notifications.py",  # CR-018 (integ/notify)
    "services/ha_scope.py", "services/ha_actions.py",  # individual control
)


def _guarded_files() -> list[Path]:
    files = sorted({f for g in GUARDED_GLOBS for f in BACKEND.glob(g)})
    assert any(f.name == "schedule_policy.py" for f in files) and any(f.name == "ha_scope.py" for f in files), "the guard is not vacuous"
    return files


def test_schedules_automations_notifications_and_individual_control_never_read_the_protection():
    offenders = [(f.relative_to(BACKEND).as_posix(), word) for f in _guarded_files() for word in FORBIDDEN if word in f.read_text(encoding="utf-8")]
    assert not offenders, offenders


def test_the_single_entity_action_route_never_reads_the_protection():
    src = (BACKEND / "routers" / "ha.py").read_text(encoding="utf-8")
    tree = ast.parse(src)
    fn = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == "run_action")
    body = ast.get_source_segment(src, fn) or ""
    assert body and not [w for w in FORBIDDEN if w in body]


def test_the_bridge_never_knew_the_mark():
    for root in (REPO / "smplwise_vms" / "integration" / "smplwise_bridge", REPO / "custom_components" / "smplwise_bridge"):
        for f in root.glob("*.py") if root.is_dir() else ():
            text = f.read_text(encoding="utf-8")
            assert not [w for w in FORBIDDEN + ("bulk_safe",) if w in text], f
