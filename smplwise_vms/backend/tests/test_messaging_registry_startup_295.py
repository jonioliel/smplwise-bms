"""REGSTART-295: the "identity" (local_reset) and "access" (access_grants) messaging uses are in the registry from application start.

Both join the registry only when their module is imported. create_app now imports them itself, so the Settings messaging accounts
screen never depends on what ran since the restart (same defect as temperature, TEMPREG-295)."""
from __future__ import annotations

import sys

import pytest

import smplwise.services as services_pkg
from smplwise.main import create_app
from smplwise.services import messaging_runtime as mr

CASES = [("smplwise.services.local_reset", "local_reset", "identity"), ("smplwise.services.access_grants", "access_grants", "access")]


def _joined(name: str) -> bool:
    return any(getattr(p, "__module__", "") == name for p in mr._USE_PROVIDERS)  # noqa: SLF001


@pytest.mark.parametrize(("name", "attr", "module_key"), CASES)
def test_the_use_is_registered_by_application_start(settings, monkeypatch, name, attr, module_key):
    """Forget the module and its registry entries (a fresh process where nothing imported it yet): building the app registers them again."""
    monkeypatch.delitem(sys.modules, name, raising=False)
    monkeypatch.delattr(services_pkg, attr, raising=False)  # "from .services import x" returns the package attribute without importing
    monkeypatch.setattr(mr, "_USE_PROVIDERS", [p for p in mr._USE_PROVIDERS if getattr(p, "__module__", "") != name])  # noqa: SLF001
    for reg in ("_LABELS", "_MODULE_LABELS"):
        monkeypatch.setattr(mr, reg, {k: v for k, v in getattr(mr, reg).items() if k != module_key})
    assert not _joined(name)
    create_app(settings)
    assert _joined(name)
    assert module_key in mr._MODULE_LABELS  # noqa: SLF001
    assert module_key in mr._LABELS  # noqa: SLF001
