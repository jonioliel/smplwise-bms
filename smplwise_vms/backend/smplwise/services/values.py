"""Small value helpers that several service modules had copied word for word - CR-CORE-HELPERS-2438 (code review 2026-11-13,
04:F24). Only the copies that are IDENTICAL are here; the `_num` / `_int` / `_int_in` / `_bool` families differ in signature and
edge cases between their copies and stay where they are.

Nothing adopts these in this branch (wave 2 rule: the helper first, the callers later). Each function names the copies it equals:

* `clip(text, n)`: `services/notices/push.py` `_clip`, `services/notify_policy.py` `_clip`, `services/push.py` `_clip`;
* `checked_setting(conn, registry, key)`: `setting(conn, key)` in `services/offline_field.py`, `services/quiet_windows.py` and
  `services/readiness.py` (each over its own module-level `SETTINGS` registry, passed here as `registry`);
* `object_with_keys(value, name, allowed)`: `_object` in `services/area_row.py` and `services/home_screen_options.py`.

tests/test_values.py compares each helper with every copy it replaces."""
from __future__ import annotations

import sqlite3
from typing import Any, Callable, Mapping

from ..db import get_setting

SettingRegistry = Mapping[str, tuple[str, Callable[[str], bool]]]  # key -> (default, valid)


def clip(text: Any, n: int) -> str:
    """Whitespace collapsed to single spaces; longer than `n` characters: the first n-1 and an ellipsis."""
    text = " ".join(str(text or "").split())
    return text if len(text) <= n else text[: n - 1] + "…"


def checked_setting(conn: sqlite3.Connection, registry: SettingRegistry, key: str) -> str:
    """A text setting from a module registry `{key: (default, valid)}`: the stored value when `valid` accepts it, else the default.
    KeyError for a key the registry does not have."""
    default, valid = registry[key]
    v = get_setting(conn, key, default)
    return v if isinstance(v, str) and valid(v) else default


def object_with_keys(value: Any, name: str, allowed: tuple[str, ...]) -> dict[str, Any]:
    """`value` when it is a dict whose keys are all in `allowed`; ValueError otherwise (the message names `name` and the unknown
    keys, sorted)."""
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be an object")
    unknown = sorted(set(value) - set(allowed))
    if unknown:
        raise ValueError(f"{name}: unknown key " + ", ".join(str(k) for k in unknown))
    return value
