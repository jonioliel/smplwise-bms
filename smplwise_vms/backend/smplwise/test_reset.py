"""Registry of process-wide state a test run puts back between tests (code review 05:P2-17).

A service that keeps state at module level (a singleton object, a cache, a counter) registers ONE function that puts that
state back to what a freshly started process has:

    register_reset(__name__, ("REACH",), REACH.reset)

In production the call only stores the function: nothing ever calls it (no thread, no route, no start-up step). The test
suite's single autouse fixture (tests/conftest.py) calls `reset_all()` before and after every test, so a module no longer
needs a fixture of its own in conftest - and a forgotten reset shows in one place: tests/test_singletons_registered.py lists
every module-level singleton of the package and fails for one that is neither registered here nor in the recorded
list of not-yet-registered ones (tests/singletons_unregistered.txt).

This module imports nothing from the package (any module may import it)."""
from __future__ import annotations

from collections.abc import Callable, Iterable

_RESETS: dict[str, Callable[[], None]] = {}  # "<module>" -> the module's reset
_ATTRS: dict[str, tuple[str, ...]] = {}  # "<module>" -> the module-level names that reset covers


def register_reset(module: str, attrs: Iterable[str], reset: Callable[[], None]) -> None:
    """`module`: the registering module's `__name__`; `attrs`: the module-level names whose state `reset` puts back
    (for the inventory test); `reset`: no arguments, safe to call any number of times and before the state was ever used."""
    _RESETS[module] = reset
    _ATTRS[module] = tuple(attrs)


def reset_all() -> None:
    """Every registered reset, in registration (import) order. Tests only."""
    for reset in list(_RESETS.values()):
        reset()


def registered() -> dict[str, tuple[str, ...]]:
    """{"<module>": (attribute names)} of what is registered so far (a module registers when it is first imported)."""
    return dict(_ATTRS)
