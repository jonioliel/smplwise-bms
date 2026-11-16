"""CR-MAIN-ROUTERS-TABLE-2440 (review 05:P2-05, P3-01, P3-03): the ordered router table, the start-up step lists and the lifespan.

The proof that the refactor changed nothing is the route table itself (`scripts/api_inventory.py` writes the same file, and the
change note records the before / after comparison of every route in matching order and of the module import order). These
tests keep the table honest from here on: nothing mounted twice, nothing forgotten, the order-sensitive pairs in order."""
from __future__ import annotations

import ast
import importlib
import pkgutil
from pathlib import Path

from fastapi import APIRouter

import smplwise.routers as routers_pkg
from smplwise import main, startup_steps
from smplwise.routers import EAGER, ROUTERS, Load, Mount, Step

PKG = Path(routers_pkg.__file__).parent
MOUNTS = [e for e in ROUTERS if isinstance(e, Mount)]
# routers that another router includes (routers/wiskey_installer.py), so the table mounts their parent only
NESTED = {("wiskey_installer_clock", "router"), ("wiskey_installer_technical", "router"), ("wiskey_installer_lifecycle", "router"),
          ("wiskey_installer_platform", "router")}


def _index(module: str, attr: str = "router") -> int:
    hits = [i for i, e in enumerate(ROUTERS) if isinstance(e, Mount) and (e.module, e.attr) == (module, attr)]
    assert len(hits) == 1, (module, attr, hits)
    return hits[0]


def test_the_package_file_imports_no_router_module():
    tree = ast.parse((PKG / "__init__.py").read_text(encoding="utf-8"))
    relative = [n for n in ast.walk(tree) if isinstance(n, ast.ImportFrom) and n.level > 0]
    assert relative == [], "routers/__init__.py is data: importing one router must not import the others"


def test_every_api_router_is_mounted_exactly_once():
    declared: set[tuple[str, str]] = set()
    for info in pkgutil.iter_modules(routers_pkg.__path__):
        mod = importlib.import_module(f"smplwise.routers.{info.name}")
        for name, value in vars(mod).items():
            if isinstance(value, APIRouter) and getattr(value, "__module__", None) is not None and not name.startswith("_"):
                # a router object another module only re-exports is the same object: counted where it is defined first
                declared.add((info.name, name))
    mounted = [(e.module, e.attr) for e in MOUNTS]
    assert len(mounted) == len(set(mounted)), sorted(m for m in set(mounted) if mounted.count(m) > 1)
    objects = {}
    for module, attr in mounted:
        objects.setdefault(id(getattr(routers_pkg.load(module), attr)), []).append((module, attr))
    assert all(len(v) == 1 for v in objects.values()), [v for v in objects.values() if len(v) > 1]
    unmounted = {(m, a) for m, a in declared if id(getattr(routers_pkg.load(m), a)) not in objects}
    assert unmounted == NESTED, f"a router that the table does not mount: {sorted(unmounted - NESTED)}"
    parent = (PKG / "wiskey_installer.py").read_text(encoding="utf-8")
    assert all(f"router.include_router({m}.router)" in parent for m, _ in NESTED), "each nested router is included by its parent"


def test_every_entry_resolves():
    for e in ROUTERS:
        if isinstance(e, Step):
            assert e.name in startup_steps.WIRING, e
        elif isinstance(e, Load):
            assert (PKG / f"{e.module}.py").is_file(), e
        else:
            assert isinstance(getattr(routers_pkg.load(e.module), e.attr), APIRouter), e
            assert e.when is None or e.when in main.MOUNT_CONDITIONS, e
            assert (e.tag is not None) == e.prefix, e
    steps = [e.name for e in ROUTERS if isinstance(e, Step)]
    assert sorted(steps) == sorted(startup_steps.WIRING) and len(steps) == len(set(steps)), "every wiring step runs exactly once"


def test_the_eager_modules_exist_and_are_unique():
    assert len(EAGER) == len(set(EAGER)) and EAGER[0] == "home_mapping"
    assert all((PKG / f"{m}.py").is_file() for m in EAGER)


def test_the_order_sensitive_pairs_stay_in_order():
    """A router with a fixed path before the router whose `{parameter}` path would answer it first."""
    assert _index("mobile_notifications") < _index("notifications")            # BEFORE /notifications/{nid}
    assert _index("backup_offbox") < _index("backup")                          # before /backups/{name}
    assert _index("camera_sources") < _index("cameras")
    last = _index("tickets")                                                   # /tickets/{ticket_id}
    for module in ("tickets_admin", "tickets_contacts", "tickets_dept_handlers", "tickets_links", "tickets_table", "tickets_budgets",
                   "tickets_visits", "tickets_costs", "tickets_detail", "tickets_rules", "tickets_intake", "tickets_map", "tickets_rfq",
                   "tickets_messages", "tickets_board"):
        assert _index(module) < last, module
    assert _index("tickets", "open_router") < last
    assert _index("tickets_budgets") < _index("tickets_costs")                 # /tickets/costs/budgets... BEFORE the cost routes
    assert _index("local_privacy") < _index("local_identity")
    assert _index("notices", "display_router") < _index("notices") < _index("notices", "page_router")
    assert isinstance(ROUTERS[0], Mount) and ROUTERS[0] == Mount("me", "identity")


def test_the_wiring_steps_sit_where_they_ran():
    def step(name: str) -> int:  # by type: a NamedTuple equals any tuple with the same fields, so Step("x") == Load("x")
        return next(i for i, e in enumerate(ROUTERS) if isinstance(e, Step) and e.name == name)

    def loaded(module: str) -> int:
        return next(i for i, e in enumerate(ROUTERS) if isinstance(e, Load) and e.module == module)

    assert _index("notify_whatsapp") < step("messaging_uses") < _index("presence")
    assert _index("local_passkeys") < step("assetlinks_route") < _index("cast") < step("cast_sessions") < _index("announcements")
    assert _index("announcements") < step("announcements") < step("wa_recipient_guard") < _index("tickets", "open_router")
    assert _index("tickets") < step("tickets_public") < _index("maintenance", "open_router")
    assert _index("emergency_readiness") < step("ha_bridge") < _index("messaging_accounts")
    assert loaded("calendar_feeds") < step("calendar_runtime") < _index("calendar_feeds")
    assert isinstance(ROUTERS[-1], Step) and ROUTERS[-1].name == "tickets_messaging"


def test_the_development_router_is_conditional():
    dev = ROUTERS[_index("ha", "dev_router")]
    assert dev.when == "dev_identity" and _index("ha") < _index("ha", "dev_router")

    class S:
        def __init__(self, dev_user, in_addon):
            self.dev_user, self.in_addon = dev_user, in_addon

    cond = main.MOUNT_CONDITIONS["dev_identity"]
    assert cond(S("joni", False)) is True and cond(S("joni", True)) is False and cond(S(None, False)) is False and cond(S("", False)) is False


def test_after_migrate_order():
    assert [f.__name__ for f in startup_steps.AFTER_MIGRATE] == [
        "keep_home_interface_defaults", "load_mic_mode", "ensure_migration_objects", "ensure_shared_spaces_schema", "record_version",
        "settle_update_run", "note_release_restart", "ensure_notify_policies", "settle_bulk_device_actions", "reconcile_switch_protection",
        "backfill_ha_event_cameras"]
    assert startup_steps.log.name == "smplwise"


def test_the_app_uses_a_lifespan_and_no_event_handlers(client):
    app = client.app
    assert app.router.on_startup == [] and app.router.on_shutdown == []
    src = Path(main.__file__).read_text(encoding="utf-8")
    assert "on_event(" not in src and "lifespan=lifespan" in src


def test_plan_stylize_does_not_import_numpy_at_import():
    from smplwise.services import plan_stylize

    tree = ast.parse(Path(plan_stylize.__file__).read_text(encoding="utf-8"))
    top = [n for n in tree.body if isinstance(n, (ast.Import, ast.ImportFrom)) and any(a.name.split(".")[0] == "numpy" for a in n.names)]
    assert top == []
    assert int(plan_stylize.otsu_threshold(__import__("numpy").zeros((4, 4), dtype="uint8"))) >= 0  # the functions still find it
