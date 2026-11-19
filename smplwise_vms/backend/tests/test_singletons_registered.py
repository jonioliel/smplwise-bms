"""CR-TEST-SUPPORT-2440 (review 05:P2-17): every module-level singleton of the package is registered for the per-test reset
(`smplwise.test_reset.register_reset`) or recorded in tests/singletons_unregistered.txt.

A singleton here is an object bound at module level whose class is defined in the package: either in that same module
(`REACH = Reach()`, `STATE = SyncState()`, `MANAGER = Manager()`) or in another module of the package and ASSIGNED in this one
(`POLLER = PeriodicWorker(...)`, `_cache = TtlCache(600)`, `_TICK = Every(3000)`, `LIMITER = RateLimiter()`): process-wide state
that one test can leave to the next. CR-BE-COMPLEXITY-2450: the first rule alone was blind to the second kind (a shared class);
a name only imported from another module (`from .x import STORE`) is not an assignment, so the object is counted once, where
it is made. Values that cannot carry state are left out (enum members, exceptions, tuples, frozen dataclasses, pydantic models).

The recorded list is the to-do of this seam, not an exemption for good: a NEW singleton must register a reset (or be added
to the list on purpose, in review), and a listed one that was registered or removed must leave the list (stale entry)."""
from __future__ import annotations

import ast
import dataclasses
import enum
import importlib
import inspect
import pkgutil
import sys
from pathlib import Path

import smplwise
from smplwise import test_reset

HERE = Path(__file__).resolve().parent
UNREGISTERED = HERE / "singletons_unregistered.txt"
MAIN = ".__main__"  # a module of that name starts something when imported


def _stateless(value: object) -> bool:
    cls = type(value)
    if isinstance(value, (enum.Enum, BaseException, tuple, frozenset, str, bytes, int, float, type)):
        return True
    if dataclasses.is_dataclass(value) and cls.__dataclass_params__.frozen:
        return True
    return any(base.__module__.startswith("pydantic") for base in cls.__mro__)


def _assigned(mod: object) -> set[str]:
    """The names a module binds by an assignment at its top level (`NAME = ...`, `NAME: T = ...`), not by an import."""
    try:
        tree = ast.parse(inspect.getsource(mod))  # type: ignore[arg-type]
    except (OSError, TypeError, SyntaxError):
        return set()
    out: set[str] = set()
    for node in tree.body:
        targets = node.targets if isinstance(node, ast.Assign) else [node.target] if isinstance(node, (ast.AnnAssign, ast.AugAssign)) else []
        out.update(n.id for t in targets for n in ast.walk(t) if isinstance(n, ast.Name))
    return out


def _in_package(module: str) -> bool:
    return module == smplwise.__name__ or module.startswith(smplwise.__name__ + ".")


def singletons() -> tuple[set[str], list[str]]:
    """({"<module>.<NAME>"}, [modules that could not be imported]) over every module of the package."""
    found: set[str] = set()
    failed: list[str] = []
    shared: list[tuple[str, str, object]] = []  # (module, name, value): a shared-class candidate, judged after the walk
    own_ids: set[int] = set()
    for info in pkgutil.walk_packages(smplwise.__path__, "smplwise."):
        if info.name.endswith(MAIN):
            continue
        try:
            mod = importlib.import_module(info.name)
        except Exception as exc:  # noqa: BLE001 - an optional dependency that is not installed here
            failed.append(f"{info.name}: {type(exc).__name__}")
            continue
        seen: set[int] = set()
        assigned: set[str] | None = None
        for name, value in sorted(vars(mod).items()):
            if name.startswith("__") or id(value) in seen or _stateless(value):
                continue
            cls_module = type(value).__module__
            if cls_module == mod.__name__:
                seen.add(id(value))  # one object under two names counts once (the first name in order)
                own_ids.add(id(value))
                found.add(f"{mod.__name__}.{name}")
            elif _in_package(cls_module):
                if assigned is None:
                    assigned = _assigned(mod)
                if name in assigned:
                    seen.add(id(value))
                    shared.append((mod.__name__, name, value))
    # a shared-class object counts once: not again when its own module's class rule already counted it under another name,
    # and only under its first assignment in walk order (`ALIAS = other.OBJ` is the same object)
    for module, name, value in shared:
        if id(value) not in own_ids:
            own_ids.add(id(value))
            found.add(f"{module}.{name}")
    return found, failed


def _listed() -> set[str]:
    out: set[str] = set()
    for line in UNREGISTERED.read_text(encoding="utf-8").splitlines():
        text = line.split("#", 1)[0].strip()
        if text:
            assert text.startswith("smplwise.") and " " not in text, f"{UNREGISTERED.name}: malformed line {line!r}"
            out.add(text)
    return out


def _registered() -> set[str]:
    return {f"{module}.{attr}" for module, attrs in test_reset.registered().items() for attr in attrs}


def test_every_module_level_singleton_is_registered_or_recorded():
    found, failed = singletons()
    assert not failed, "modules that could not be imported (their singletons are not checked):\n  " + "\n  ".join(failed)
    registered, listed = _registered(), _listed()
    missing = sorted(found - registered - listed)
    assert not missing, (
        "module-level singletons without a per-test reset: register one with smplwise.test_reset.register_reset(__name__, "
        "(names), reset), or record the name in tests/singletons_unregistered.txt:\n  " + "\n  ".join(missing))
    # a listed name is stale when it is registered now or when the NAME is gone. It is not stale while the name is still bound
    # but to an object this walk does not count (a value replaced at run time by a stateless one, a module rebinding it).
    gone = {n for n in listed - found if not hasattr(sys.modules.get(n.rpartition(".")[0]), n.rpartition(".")[2])}
    stale = sorted(gone | (listed & registered))
    assert not stale, "tests/singletons_unregistered.txt entries that are registered now or no longer exist:\n  " + "\n  ".join(stale)


def test_registered_names_exist_and_resets_run_twice():
    singletons()  # every module imported: every registration made
    for module, attrs in test_reset.registered().items():
        mod = importlib.import_module(module)
        assert attrs, f"{module}: a registration names what it resets"
        for attr in attrs:
            assert hasattr(mod, attr), f"{module}.{attr} is registered for reset but is not a name of the module"
    test_reset.reset_all()
    test_reset.reset_all()  # a reset is safe to call again, and before its state was ever used


def test_shared_class_singletons_are_seen():
    """CR-BE-COMPLEXITY-2450 (REMAINING_WORK 18.11 section B): the walk was blind to a singleton whose class lives in another
    module of the package. It sees one now - once, where it is assigned, and not again where it is only imported."""
    found, _ = singletons()
    assert "smplwise.services.recorder_health.POLLER" in found, "a PeriodicWorker (services.poller) bound in another module"
    assert "smplwise.services.recordings._cache" in found, "a TtlCache (services.ttl_cache) bound in another module"
    assert "smplwise.services.janitors.Every" not in found, "a class is not a singleton"
    assert not {n for n in found if n.startswith("smplwise.services.ttl_cache.")}, "nothing is counted in the class's own module"
    from smplwise.services import recordings

    names = _assigned(recordings)
    assert "_cache" in names and "TtlCache" not in names, "an imported name is not an assignment"
