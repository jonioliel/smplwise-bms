"""CR-TEST-SUPPORT-2440 (review 05:P2-17): every module-level singleton of the package is registered for the per-test reset
(`smplwise.test_reset.register_reset`) or recorded in tests/singletons_unregistered.txt.

A singleton here is an object bound at module level whose class is defined in that same module (`REACH = Reach()`,
`STATE = SyncState()`, `MANAGER = Manager()`): process-wide state that one test can leave to the next. Values that cannot
carry state are left out (enum members, exceptions, tuples, frozen dataclasses, pydantic models).

The recorded list is the to-do of this seam, not an exemption for good: a NEW singleton must register a reset (or be added
to the list on purpose, in review), and a listed one that was registered or removed must leave the list (stale entry)."""
from __future__ import annotations

import dataclasses
import enum
import importlib
import pkgutil
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


def singletons() -> tuple[set[str], list[str]]:
    """({"<module>.<NAME>"}, [modules that could not be imported]) over every module of the package."""
    found: set[str] = set()
    failed: list[str] = []
    for info in pkgutil.walk_packages(smplwise.__path__, "smplwise."):
        if info.name.endswith(MAIN):
            continue
        try:
            mod = importlib.import_module(info.name)
        except Exception as exc:  # noqa: BLE001 - an optional dependency that is not installed here
            failed.append(f"{info.name}: {type(exc).__name__}")
            continue
        seen: set[int] = set()
        for name, value in sorted(vars(mod).items()):
            if name.startswith("__") or type(value).__module__ != mod.__name__ or id(value) in seen or _stateless(value):
                continue
            seen.add(id(value))  # one object under two names counts once (the first name in order)
            found.add(f"{mod.__name__}.{name}")
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
    stale = sorted((listed - found) | (listed & registered))
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
