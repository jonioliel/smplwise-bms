"""TESTDEBT2-295: the messaging use registry (services/messaging_runtime) is process state that other modules join AT IMPORT.

`services/temperature_whatsapp` joins lazily (a temperature route or the first temperature tick imports it), so whether the
"temperature" module and its always-active report use are in the registry depended on whether a temperature test ran earlier in
the same pytest process - the accounts-screen tests (tickets + notification uses only) failed behind a temperature file and
passed alone. `registry_without_lazy_modules` makes the registry the same in every order: it forces the lazy import first (so
nothing joins during the test) and then hides the lazily joined modules from the test's copy of the registry."""
from __future__ import annotations

import importlib

import pytest

from smplwise.services import messaging_runtime as mr

LAZY_MODULES = ("smplwise.services.temperature_whatsapp",)
IMPORTED_FIRST = ("smplwise.services.local_reset", "smplwise.services.access_grants", "smplwise.services.notify_whatsapp")  # TESTDEBT3-295: notify_whatsapp (the "notifications" module) joined only because something imported it at collection; named here so the test registry never depends on that chain. REGSTART-295: create_app imports both at startup now; tests that build a Database without an app still need them first (the "identity" and "access" modules)
LAZY_MODULE_KEYS = ("temperature",)


@pytest.fixture()
def registry_without_lazy_modules(monkeypatch):
    for name in (*IMPORTED_FIRST, *LAZY_MODULES):
        importlib.import_module(name)  # the join (if any) happens now, never in the middle of the test
    monkeypatch.setattr(mr, "_USE_PROVIDERS", [p for p in mr._USE_PROVIDERS if getattr(p, "__module__", "") not in LAZY_MODULES])  # noqa: SLF001
    for attr in ("_LABELS", "_MODULE_LABELS", "_DEPARTMENTS"):
        monkeypatch.setattr(mr, attr, {k: v for k, v in getattr(mr, attr).items() if k not in LAZY_MODULE_KEYS})
    return mr
