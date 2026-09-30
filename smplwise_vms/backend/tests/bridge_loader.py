"""Load the bridge integration's dependency-free modules (schedule_policy, schedule_service, signing) without Home
Assistant and without executing the package's `__init__.py` (which imports homeassistant and voluptuous at the top).

The package is registered under a private name with `__path__` pointing at the canonical source, so relative imports
inside the submodules (`from . import schedule_policy`, `from .signing import ...`) resolve normally.
"""
from __future__ import annotations

import ast
import importlib
import sys
import types
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
SRC = REPO / "custom_components" / "smplwise_bridge"
MIRROR = REPO / "smplwise_vms" / "integration" / "smplwise_bridge"
PKG = "smplwise_bridge_under_test"


def load(sub: str) -> types.ModuleType:
    """Import `<package>.<sub>` (for example `schedule_policy`) from the canonical integration source."""
    if PKG not in sys.modules:
        pkg = types.ModuleType(PKG)
        pkg.__path__ = [str(SRC)]  # type: ignore[attr-defined]
        sys.modules[PKG] = pkg
    return importlib.import_module(f"{PKG}.{sub}")


def init_tree() -> ast.Module:
    """The parsed `__init__.py` (the module itself cannot be imported without Home Assistant)."""
    return ast.parse((SRC / "__init__.py").read_text(encoding="utf-8"))


def init_allowed_services() -> set[tuple[str, str]]:
    """`ALLOWED_SERVICES` of `__init__.py`, read from the syntax tree."""
    for node in ast.walk(init_tree()):
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "ALLOWED_SERVICES" for t in node.targets):
            return set(ast.literal_eval(node.value))
    raise AssertionError("ALLOWED_SERVICES not found in the bridge __init__.py")
